//! The account-linking funnel, resending and hand-resolving linking mails, and manual links.

use std::collections::HashMap;

use headless_lms_models::course_module_suotar_configurations;
use headless_lms_models::credit_registration_account_linking_emails::{
    self, StaleUnclaimedLinkingMails,
};
use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_enrolment_routes::CreditRegistrationEnrolmentRoute;
use headless_lms_models::credit_registration_phase_state;
use headless_lms_models::credit_registration_roster_schedules::{
    self, AccountLinkingCodeCounters, RosterSchedule, ScheduleSelection,
};
use headless_lms_models::credit_registrations::{
    self, AttentionReason, AttentionStanding, CreditRegistrationErrorCode, WaitingPresser,
};
use headless_lms_models::email_deliveries::{EmailSendStatus, EmailSendStatusReport};
use headless_lms_models::library::credit_registration::account_linking::{
    LINKING_MAIL_QUIET_PERIOD, MAX_LINKING_MAILS_PER_PERSON_AND_COURSE, mail_address,
};
use headless_lms_models::library::credit_registration::student_number::parse_student_number;
use headless_lms_models::library::credit_registration::study_registry::RosterPerson;
use headless_lms_models::library::credit_registration::timeline::{Engagement, TimelineStep};
use headless_lms_models::study_registry_student_number_conflicts;
use headless_lms_models::verified_student_numbers::{
    self, LinkConflict, NewVerifiedStudentNumber, StudentNumberVerificationMethod,
};
use headless_lms_utils::secret_string::expose_option;
use secrecy::{ExposeSecret, SecretString};
use utoipa::ToSchema;

use crate::controllers::main_frontend::course_credit_registrations::record_resend_and_fetch_mails;
use crate::domain::credit_registration::linking_candidates::{
    AccountIdentity, LinkingCandidateSimilarity, similarities, similarity_score,
};
use crate::domain::credit_registration::linking_mail_resend::{
    ResendOutcome, ensure_resend_possible,
};
use crate::prelude::*;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_credit_registration::CreditRegistrationPhase;
use headless_lms_credit_registration::account_linking::{
    ManualActionContext, PersonLookupError, RateCapOverride, RegistryPerson,
    list_unlinked_enrolled_before, list_unlinked_on_course_rosters, look_up_person,
    resend_linking_mail_for_target,
};

use super::dashboard::{CreditRegistrationPhaseStatus, to_phase_status};
use super::{
    AdminLinkingEmail, attention_rules, authorize_credit_registration_admin, build_linking_emails,
    required_reason,
};

const STALE_UNCLAIMED_LIMIT: i64 = 200;
const STUDY_REGISTRY_CONFLICT_LIMIT: i64 = 200;
const RECENT_LINKING_EMAIL_LIMIT: i64 = 50;
const WAITING_STUDENT_LIMIT: i64 = 100;
const UNUSED_LINK_LIMIT: i64 = 200;
const RECENT_LINK_LIMIT: i64 = 50;

/// Marks a manual action's study registry call in the call log as something a person set off.
const RESEND_CALLER: &str = "admin-resend";
const RESOLVE_CALLER: &str = "admin-resolve-person";
const MANUAL_LINK_CALLER: &str = "admin-manual-link";
const CANDIDATES_CALLER: &str = "admin-linking-candidates";
const UNLINKED_ENROLEES_CALLER: &str = "admin-unlinked-enrolees";

/// A fat-finger guard on top of the per-person caps, which this endpoint can only override by retiring
/// ledger rows.
const RESEND_QUIET_PERIOD_SECS: i64 = 60;

/// The account-linking funnel. The `_last_run` steps sum each code's last enrolment list, a person
/// counted once per code, and the `_in_window` ones come from the window: there is no single
/// denominator.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingFunnel {
    pub persons_discovered_last_run: i64,
    pub already_linked_last_run: i64,
    pub mails_claimed_in_window: i64,
    pub mails_sent_in_window: i64,
    pub numbers_claimed_in_window: i64,
    /// Never folded into the claimed count: an admin's judgement is not a claim.
    pub manual_links_in_window: i64,
    pub suppressed_by_dedup_last_run: i64,
    pub suppressed_by_rate_cap_last_run: i64,
    pub no_address_in_study_registry_last_run: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingSendStatusTotals {
    /// Claimed, but not yet queued by the `link-emails` phase.
    pub waiting_for_link_emails: i64,
    /// Queued, but not yet attempted by the email worker.
    pub waiting_for_email_worker: i64,
    pub retrying: i64,
    pub sent: i64,
    pub send_failed: i64,
    /// Claimed in the window and used since.
    pub used: i64,
}

/// Hard send failures grouped by recipient domain.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingFailureDomain {
    pub domain: String,
    pub count: i64,
}

/// A module on a course code, which shares the code's enrolment list.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingCodeModule {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    /// When an enrolment list last fed account linking for the module.
    pub last_listed_at: Option<DateTime<Utc>>,
}

/// One course code's enrolment list: when it is fetched, and what the last one did for linking.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingCourseCode {
    pub course_code: String,
    pub modules: Vec<AccountLinkingCodeModule>,
    pub last_fetched_at: Option<DateTime<Utc>>,
    /// The latest fetch that could send linking emails.
    pub last_mailing_fetch_started_at: Option<DateTime<Utc>>,
    /// When it is next due, ignoring the failure backoff.
    pub next_fetch_at: DateTime<Utc>,
    /// An admin's "Fetch now" no fetch has served yet.
    pub fetch_requested_at: Option<DateTime<Utc>>,
    /// People on the code's modules waiting for a student number.
    pub waiting_count: i64,
    /// Everyone on the last list, however long ago they enrolled.
    pub last_listed_person_count: Option<i32>,
    pub consecutive_failures: i32,
    pub retry_not_before: Option<DateTime<Utc>>,
    pub last_error: Option<CreditRegistrationErrorCode>,
    /// `None` until a list has fed account linking.
    pub linking: Option<AccountLinkingCodeCounters>,
    /// People on the same list who enrolled before account linking began and are linked to no
    /// account, so no linking email went to them.
    pub unlinked_enrolled_before_count: Option<i32>,
    /// Pressers on the code's modules still waiting for a student number, since the cutoff.
    pub pressed_waiting_count: i64,
    /// Linking emails on the code whose link can still be used.
    pub unused_link_count: i64,
    pub is_enrolment_list_empty: bool,
    pub is_fetch_failing: bool,
}

/// A student waiting for a student number who pressed "I have enrolled".
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingPresser {
    pub credit_registration_id: Uuid,
    pub user_id: Uuid,
    pub email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub completion_date: DateTime<Utc>,
    pub pressed_at: DateTime<Utc>,
    /// How they enrolled.
    pub enrolment_route: CreditRegistrationEnrolmentRoute,
    pub last_fetched_at: Option<DateTime<Utc>>,
    /// The latest fetch that could send linking emails; the stuck rule counts from here.
    pub last_mailing_fetch_started_at: Option<DateTime<Utc>>,
    pub next_fetch_at: Option<DateTime<Utc>>,
    /// On any course sharing the code since the press; not attributable to this student.
    pub linking_emails_on_code_since_press: i64,
    pub last_linking_email_on_code_at: Option<DateTime<Utc>>,
    pub is_enrolment_list_empty: bool,
    pub is_fetch_failing: bool,
    /// Carries `student_number_stuck`; its actions live on Needs attention.
    pub is_stuck: bool,
    /// Counted in Needs attention: stuck, and neither dismissed nor explained by a blocking problem.
    pub needs_attention: bool,
}

/// Students waiting for a student number since the cutoff, by what they have done. Mutually
/// exclusive, uncapped, and equal to the overview's counts for the same step.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingEngagementCounts {
    pub pressed: i64,
    /// Of `pressed`, those stuck.
    pub pressed_stuck: i64,
    pub visited: i64,
    pub not_started: i64,
}

/// A link that can still be used, and how old it is.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingUnusedLink {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub uh_course_code: Option<String>,
    /// In full: support tells the recipients apart by it.
    pub emailed_to: String,
    pub claimed_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// A student number linked by a linking email or by hand.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingRecentLink {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub verified_at: DateTime<Utc>,
    pub verified_via: StudentNumberVerificationMethod,
    pub verified_from_course_id: Option<Uuid>,
    pub verified_from_course_name: Option<String>,
}

/// One linking email, newest first in the recent list.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingRecentEmail {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    /// In full: support tells the recipients apart by it.
    pub emailed_to: String,
    pub claimed_at: DateTime<Utc>,
    /// When the `link-emails` phase handed it to the email worker.
    pub queued_at: Option<DateTime<Utc>>,
    /// `None` until queued.
    pub send_status: Option<EmailSendStatusReport>,
    pub last_error_message: Option<String>,
}

/// A student whose registration waits for a student number.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingWaitingStudent {
    pub credit_registration_id: Uuid,
    pub user_id: Uuid,
    pub email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub completion_date: DateTime<Utc>,
    pub last_visited_at: Option<DateTime<Utc>>,
    /// The latest check request the student made themselves.
    pub last_check_requested_at: Option<DateTime<Utc>>,
    /// Pressed means their "I have enrolled" press stands.
    pub engagement: Engagement,
}

/// One mail attempt: the address it went to and what we can say about its delivery.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingSendOutcome {
    pub address: String,
    pub send_status: EmailSendStatus,
}

/// A person mailed to the cap for one course whose number was never claimed.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingStaleAddress {
    pub student_number: String,
    pub sisu_person_id: String,
    pub course_id: Uuid,
    pub course_name: String,
    pub mail_count: i64,
    pub first_sent_at: DateTime<Utc>,
    pub last_sent_at: DateTime<Utc>,
    /// In full, newest last, one per mail.
    pub sends: Vec<AccountLinkingSendOutcome>,
}

/// A student number the study registry reported for an account that another live link kept us from
/// linking. The existing link stays until someone acts.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct StudyRegistryStudentNumberConflict {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub user_email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub reported_student_number: String,
    /// The course whose registration reported the number.
    pub course_id: Uuid,
    pub course_name: String,
    /// The link in the way: the same account's link to another number, or another account's link to
    /// the reported one.
    pub conflicting_link_user_id: Uuid,
    pub conflicting_link_user_email: Option<String>,
    pub conflicting_link_student_number: String,
    pub conflicting_link_verified_via: StudentNumberVerificationMethod,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct VerifiedStudentNumberMethodTotal {
    pub verified_via: StudentNumberVerificationMethod,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingStats {
    /// When false, no linking mails are sent and resends are refused.
    pub account_linking_enabled: bool,
    /// Discovery mails only people who enrolled at or after this.
    pub account_linking_since: Option<DateTime<Utc>>,
    pub window_secs: i64,
    pub funnel: AccountLinkingFunnel,
    pub send_status_totals: AccountLinkingSendStatusTotals,
    pub hard_failure_domains: Vec<AccountLinkingFailureDomain>,
    pub course_codes: Vec<AccountLinkingCourseCode>,
    /// Newest first, capped.
    pub recent_linking_emails: Vec<AccountLinkingRecentEmail>,
    pub stale_addresses: Vec<AccountLinkingStaleAddress>,
    pub links_total_by_method: Vec<VerifiedStudentNumberMethodTotal>,
    pub links_in_window_by_method: Vec<VerifiedStudentNumberMethodTotal>,
    /// Accounts with an eligible completion still waiting for a student number.
    pub waiting_for_student_number_count: i64,
    /// Of those, the ones completed since `account_linking_since`, longest waiting first, capped.
    pub waiting_students: Vec<AccountLinkingWaitingStudent>,
    /// `waiting_students` before the cap.
    pub waiting_students_total: i64,
    pub max_mails_per_person_and_course: i64,
    pub quiet_period_secs: i64,
    /// Newest first, capped.
    pub study_registry_conflicts: Vec<StudyRegistryStudentNumberConflict>,
    /// Enrolment discovery and link-emails, the processing phases a linking email goes out
    /// through, for the health banner.
    pub processing_phases: Vec<CreditRegistrationPhaseStatus>,
    /// Every presser waiting for a student number since the cutoff, stuck first, then longest
    /// waiting.
    pub pressers: Vec<AccountLinkingPresser>,
    pub engagement_counts: AccountLinkingEngagementCounts,
    /// Oldest first, capped.
    pub unused_links: Vec<AccountLinkingUnusedLink>,
    /// Newest first, capped; study registry links only as `links_total_by_method`.
    pub recent_links: Vec<AccountLinkingRecentLink>,
}

#[derive(Debug, Deserialize)]
pub struct AccountLinkingStatsQuery {
    window_days: Option<u32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminRequestEnrolmentListFetchPayload {
    pub course_code: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminRequestEnrolmentListFetchResult {
    /// Ignoring the failure backoff, as on the Linking tab.
    pub next_fetch_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminDismissStudyRegistryConflictPayload {
    pub reason: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminResendAccountLinkingEmailPayload {
    #[schema(value_type = String)]
    pub student_number: SecretString,
    pub course_id: Uuid,
    /// Retires the mails a cap is counting, then runs the ordinary send path. Requires a reason.
    pub override_rate_caps: bool,
    pub reason: Option<String>,
    /// The registration whose student the mail is a guess for, from the linking candidates. Must be
    /// on `course_id`; recorded on the audit row.
    pub credit_registration_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminResendAccountLinkingEmailResult {
    pub outcome: ResendOutcome,
    /// Mails retired to get past a cap. Always zero without an override.
    pub retired_mail_count: i64,
    pub linking_emails: Vec<AdminLinkingEmail>,
    pub mails_sent_for_this_course: i64,
    pub max_mails_per_person_and_course: i64,
    pub quiet_period_secs: i64,
}

/// A person on a course's enrolment list whom no account is linked to, whom support can send a
/// linking email.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminLinkingCandidate {
    /// Echoed back to the resend endpoint to mail them.
    pub student_number: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    /// In full: support has to tell the candidates apart before mailing one of them.
    pub email: Option<String>,
    /// `None` when the study registry gave no enrolment time.
    pub enrolled_at: Option<DateTime<Utc>>,
    /// Linking emails they have had for the course, replaced ones included.
    pub linking_emails_for_course: i64,
    /// What they share with the waiting student's account, by which the linking candidates are
    /// ordered. Always empty in [`AdminUnlinkedEnrolees`].
    pub similarities: Vec<LinkingCandidateSimilarity>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminLinkingCandidates {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_code: String,
    pub account_linking_since: DateTime<Utc>,
    /// The study registry gave no usable answer, so an empty `candidates` says nothing.
    pub study_registry_unavailable: bool,
    /// Most like the student's account first.
    pub candidates: Vec<AdminLinkingCandidate>,
}

/// A course support can send a linking email for by hand: one taking part in credit registration
/// with a University of Helsinki course code.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminLinkingCourse {
    pub course_id: Uuid,
    pub course_name: String,
    /// Usually one; a course whose modules have different codes has each of them.
    pub course_codes: Vec<String>,
}

/// Everyone on a course's enrolment lists whom no account is linked to, whenever they enrolled.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminUnlinkedEnrolees {
    /// The study registry gave no usable answer for some code, so `people` says nothing.
    pub study_registry_unavailable: bool,
    /// By last name, then first names, ignoring case; people with no last name last.
    pub people: Vec<AdminLinkingCandidate>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminResolveStudentNumberPayload {
    #[schema(value_type = String)]
    pub student_number: SecretString,
}

/// The preview a manual link is gated on. No addresses from the registry — `resolve-persons` answers
/// with a name and an id only — so the addresses here are the ones we mailed.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminResolveStudentNumberResult {
    pub found: bool,
    pub student_number: String,
    /// Echoed back to the manual-link endpoint, which refuses without it.
    pub sisu_person_id: Option<String>,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    /// The registry's own per-item code, an identifier rather than prose.
    pub code: Option<String>,
    pub study_registry_unavailable: bool,
    /// The registry's per-item code when it answered with an error other than `personNotFound`,
    /// which leaves it unknown whether the number exists.
    pub lookup_error_code: Option<String>,
    pub already_linked_to_user_id: Option<Uuid>,
    pub already_linked_to_user_email: Option<String>,
    pub already_linked_via: Option<StudentNumberVerificationMethod>,
    pub linking_emails: Vec<AdminLinkingEmail>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminManuallyLinkStudentNumberPayload {
    pub user_id: Uuid,
    #[schema(value_type = String)]
    pub student_number: SecretString,
    /// From the preview. Re-resolved on arrival, and a mismatch is refused, so a typo cannot mint a
    /// link to somebody else.
    #[schema(value_type = String)]
    pub sisu_person_id: SecretString,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminManualLinkOutcome {
    Linked,
    /// The registry does not know the number.
    StudentNumberNotFound,
    /// The registry named a different person than the preview did.
    PreviewMismatch,
    /// The number is live on another account. Unlink that one first.
    AlreadyLinkedToAnotherAccount,
    AlreadyLinkedToThisAccount,
    StudyRegistryUnavailable,
    /// The registry answered with a code we do not know; the preview shows it.
    UnexpectedStudyRegistryAnswer,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminManuallyLinkStudentNumberResult {
    pub outcome: AdminManualLinkOutcome,
    pub verified_student_number_id: Option<Uuid>,
    /// Registrations the link unblocked.
    pub affected_registration_count: i64,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/account-linking` - The linking funnel, each
course code's enrolment list, the send-status totals, the recent linking emails, who is waiting for
a student number and the stale-address list.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/account-linking",
    operation_id = "getAccountLinkingStats",
    tag = "credit-registration-admin",
    params(("window_days" = Option<u32>, Query, description = "Window for the windowed funnel steps, in days")),
    responses(
        (status = 200, description = "Where account linking stands", body = AccountLinkingStats)
    )
)]
pub async fn get_account_linking_stats(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<AccountLinkingStatsQuery>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<AccountLinkingStats>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let window_days = i64::from(query.window_days.unwrap_or(30).clamp(1, 365));
    let window_secs = window_days * 24 * 60 * 60;
    let since = Utc::now() - chrono::Duration::days(window_days);

    let account_linking_since = app_conf.suotar_configuration.account_linking_since;
    let presser_rows =
        credit_registrations::get_waiting_pressers(&mut conn, account_linking_since, None).await?;
    let unused_by_code =
        credit_registration_account_linking_emails::count_unused_links_by_course_code(&mut conn)
            .await?;
    let course_codes = build_course_codes(
        &mut conn,
        account_linking_since,
        &presser_rows,
        &unused_by_code,
    )
    .await?;
    let sum = |pick: fn(&AccountLinkingCodeCounters) -> i32| -> i64 {
        course_codes
            .iter()
            .filter_map(|code| code.linking.as_ref())
            .map(|counters| i64::from(pick(counters)))
            .sum::<i64>()
    };

    let now = Utc::now();
    let totals = credit_registration_account_linking_emails::get_send_status_totals_since(
        &mut conn, since, now,
    )
    .await?;
    let send_status_totals = AccountLinkingSendStatusTotals {
        waiting_for_link_emails: totals.waiting_for_link_emails,
        waiting_for_email_worker: totals.waiting_for_email_worker,
        retrying: totals.retrying,
        sent: totals.sent,
        send_failed: totals.send_failed,
        used: totals.used,
    };
    let hard_failure_domains: Vec<AccountLinkingFailureDomain> =
        credit_registration_account_linking_emails::get_send_failure_domains_since(
            &mut conn, since, now,
        )
        .await?
        .into_iter()
        .map(|row| AccountLinkingFailureDomain {
            domain: row.domain,
            count: row.count,
        })
        .collect();

    let method_counts = verified_student_numbers::count_by_method_since(&mut conn, since).await?;
    let links_total_by_method = method_counts
        .iter()
        .map(
            |&(verified_via, total, _)| VerifiedStudentNumberMethodTotal {
                verified_via,
                count: total,
            },
        )
        .collect::<Vec<_>>();
    let links_in_window_by_method = method_counts
        .iter()
        .map(
            |&(verified_via, _, in_window)| VerifiedStudentNumberMethodTotal {
                verified_via,
                count: in_window,
            },
        )
        .collect::<Vec<_>>();
    let in_window = |method: StudentNumberVerificationMethod| -> i64 {
        links_in_window_by_method
            .iter()
            .filter(|row| row.verified_via == method)
            .map(|row| row.count)
            .sum()
    };

    let stale = credit_registration_account_linking_emails::get_stale_unclaimed(
        &mut conn,
        MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
        STALE_UNCLAIMED_LIMIT,
    )
    .await?;
    let stale_addresses = build_stale_addresses(&mut conn, stale).await?;

    let waiting_for_student_number_count = credit_registrations::count_pending_by_reason(&mut conn)
        .await?
        .student_number_count;
    let (waiting, waiting_students_total) = credit_registrations::get_waiting_for_student_number(
        &mut conn,
        account_linking_since,
        WAITING_STUDENT_LIMIT,
    )
    .await?;
    let waiting_students = waiting
        .into_iter()
        .map(|row| AccountLinkingWaitingStudent {
            credit_registration_id: row.credit_registration_id,
            user_id: row.user_id,
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name,
            course_id: row.course_id,
            course_name: row.course_name,
            course_module_name: row.course_module_name,
            uh_course_code: row.uh_course_code,
            completion_date: row.completion_date,
            engagement: Engagement::of(row.pressed_at, row.last_visited_at),
            last_visited_at: row.last_visited_at,
            last_check_requested_at: row.last_check_requested_at,
        })
        .collect();
    let recent_linking_emails = credit_registration_account_linking_emails::get_recent(
        &mut conn,
        RECENT_LINKING_EMAIL_LIMIT,
    )
    .await?
    .into_iter()
    .map(|row| AccountLinkingRecentEmail {
        id: row.id,
        course_id: row.course_id,
        course_name: row.course_name,
        emailed_to: row.emailed_to.expose_secret().to_owned(),
        claimed_at: row.claimed_at,
        queued_at: row.queued_at,
        send_status: row.send_status,
        last_error_message: row.last_error_message,
    })
    .collect();

    let funnel = AccountLinkingFunnel {
        persons_discovered_last_run: sum(|row| row.listed_person_count),
        already_linked_last_run: sum(|row| row.already_linked_count),
        mails_claimed_in_window: totals.mails_in_window,
        mails_sent_in_window: send_status_totals.sent,
        numbers_claimed_in_window: in_window(StudentNumberVerificationMethod::EmailedLink),
        manual_links_in_window: in_window(StudentNumberVerificationMethod::AdminManual),
        suppressed_by_dedup_last_run: sum(|row| row.suppressed_by_dedup_count),
        suppressed_by_rate_cap_last_run: sum(|row| row.suppressed_by_rate_cap_count),
        no_address_in_study_registry_last_run: sum(|row| row.no_address_count),
    };

    let study_registry_conflicts = study_registry_student_number_conflicts::get_unresolved(
        &mut conn,
        STUDY_REGISTRY_CONFLICT_LIMIT,
    )
    .await?
    .into_iter()
    .map(|row| StudyRegistryStudentNumberConflict {
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        user_email: row.user_email,
        first_name: row.first_name,
        last_name: row.last_name,
        reported_student_number: row.reported_student_number.expose_secret().to_owned(),
        course_id: row.course_id,
        course_name: row.course_name,
        conflicting_link_user_id: row.conflicting_link_user_id,
        conflicting_link_user_email: row.conflicting_link_user_email,
        conflicting_link_student_number: row
            .conflicting_link_student_number
            .expose_secret()
            .to_owned(),
        conflicting_link_verified_via: row.conflicting_link_verified_via,
    })
    .collect();

    let rules = attention_rules(&mut conn, &app_conf).await?;
    let presser_ids: Vec<Uuid> = presser_rows
        .iter()
        .map(|row| row.credit_registration_id)
        .collect();
    let attention =
        credit_registrations::get_attention_items(&mut conn, &rules, Some(&presser_ids)).await?;
    let needs_attention_by_stuck_id: HashMap<Uuid, bool> = attention
        .iter()
        .filter(|row| row.reasons.contains(&AttentionReason::StudentNumberStuck))
        .map(|row| {
            (
                row.id,
                row.standing(&rules.blocking) == AttentionStanding::NeedsAttention,
            )
        })
        .collect();
    let mut pressers: Vec<AccountLinkingPresser> = presser_rows
        .into_iter()
        .map(|row| {
            let code = row
                .uh_course_code
                .as_deref()
                .and_then(|code| course_codes.iter().find(|known| known.course_code == code));
            let stuck_needs_attention = needs_attention_by_stuck_id
                .get(&row.credit_registration_id)
                .copied();
            AccountLinkingPresser {
                credit_registration_id: row.credit_registration_id,
                user_id: row.user_id,
                email: row.email,
                first_name: row.first_name,
                last_name: row.last_name,
                course_id: row.course_id,
                course_name: row.course_name,
                course_module_name: row.course_module_name,
                uh_course_code: row.uh_course_code.clone(),
                completion_date: row.completion_date,
                pressed_at: row.pressed_at,
                enrolment_route: row.enrolment_route,
                last_fetched_at: code.and_then(|code| code.last_fetched_at),
                last_mailing_fetch_started_at: code
                    .and_then(|code| code.last_mailing_fetch_started_at),
                next_fetch_at: code.map(|code| code.next_fetch_at),
                linking_emails_on_code_since_press: row.linking_emails_on_code_since_press,
                last_linking_email_on_code_at: row.last_linking_email_on_code_at,
                is_enrolment_list_empty: code.is_some_and(|code| code.is_enrolment_list_empty),
                is_fetch_failing: code.is_some_and(|code| code.is_fetch_failing),
                is_stuck: stuck_needs_attention.is_some(),
                needs_attention: stuck_needs_attention.unwrap_or(false),
            }
        })
        .collect();
    pressers.sort_by_key(|presser| (!presser.is_stuck, presser.pressed_at));

    let mut engagement_counts = AccountLinkingEngagementCounts {
        pressed: 0,
        pressed_stuck: pressers.iter().filter(|presser| presser.is_stuck).count() as i64,
        visited: 0,
        not_started: 0,
    };
    for row in credit_registrations::count_by_step_and_engagement(&mut conn, account_linking_since)
        .await?
        .into_iter()
        .filter(|row| row.step == TimelineStep::WaitingForStudentNumber)
    {
        match row.engagement {
            Some(Engagement::Pressed) => engagement_counts.pressed += row.count,
            Some(Engagement::Visited) => engagement_counts.visited += row.count,
            Some(Engagement::NotStarted) => engagement_counts.not_started += row.count,
            None => {}
        }
    }

    let now = Utc::now();
    let processing_phases = credit_registration_phase_state::get_all(&mut conn)
        .await?
        .into_iter()
        .filter(|row| {
            [
                CreditRegistrationPhase::EnrolmentDiscovery,
                CreditRegistrationPhase::LinkEmails,
            ]
            .iter()
            .any(|phase| phase.as_str() == row.phase)
        })
        .map(|row| to_phase_status(row, now))
        .collect();
    let unused_links =
        credit_registration_account_linking_emails::get_unused_links(&mut conn, UNUSED_LINK_LIMIT)
            .await?
            .into_iter()
            .map(|row| AccountLinkingUnusedLink {
                id: row.id,
                course_id: row.course_id,
                course_name: row.course_name,
                uh_course_code: row.uh_course_code,
                emailed_to: row.emailed_to.expose_secret().to_owned(),
                claimed_at: row.claimed_at,
                expires_at: row.expires_at,
            })
            .collect();
    let recent_links =
        verified_student_numbers::get_recent_linked_by_email_or_hand(&mut conn, RECENT_LINK_LIMIT)
            .await?
            .into_iter()
            .map(|row| AccountLinkingRecentLink {
                user_id: row.user_id,
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email,
                verified_at: row.verified_at,
                verified_via: row.verified_via,
                verified_from_course_id: row.verified_from_course_id,
                verified_from_course_name: row.verified_from_course_name,
            })
            .collect();

    token.authorized_ok(web::Json(AccountLinkingStats {
        processing_phases,
        pressers,
        engagement_counts,
        unused_links,
        recent_links,
        account_linking_enabled: app_conf.suotar_configuration.is_account_linking_enabled(),
        account_linking_since,
        window_secs,
        funnel,
        send_status_totals,
        hard_failure_domains,
        course_codes,
        recent_linking_emails,
        stale_addresses,
        links_total_by_method,
        links_in_window_by_method,
        waiting_for_student_number_count,
        waiting_students,
        waiting_students_total,
        max_mails_per_person_and_course: MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
        quiet_period_secs: LINKING_MAIL_QUIET_PERIOD.num_seconds(),
        study_registry_conflicts,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/fetch-enrolment-list` - Makes
one course code's enrolment list due at its next grid point.

The fetch still waits for the rate limiter and any failure backoff, like any other.
*/
#[instrument(skip(pool, payload, app_conf))]
#[utoipa::path(
    post,
    path = "/account-linking/fetch-enrolment-list",
    operation_id = "adminRequestEnrolmentListFetch",
    tag = "credit-registration-admin",
    request_body = AdminRequestEnrolmentListFetchPayload,
    responses(
        (status = 200, description = "When the list is now due", body = AdminRequestEnrolmentListFetchResult),
        (status = 404, description = "No active module has the course code")
    )
)]
pub async fn admin_request_enrolment_list_fetch(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminRequestEnrolmentListFetchPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<AdminRequestEnrolmentListFetchResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let course_code = payload.course_code.trim();
    let mut schedule = credit_registration_roster_schedules::get_schedules(
        &mut conn,
        None,
        ScheduleSelection::Code(course_code),
        app_conf.suotar_configuration.account_linking_since,
    )
    .await?
    .into_iter()
    .next()
    .ok_or_else(|| {
        controller_err!(
            NotFound,
            "No module with credit registration has this course code.".to_string()
        )
    })?;

    let mut tx = conn.begin().await?;
    let schedule_id = credit_registration_roster_schedules::request_fetch(&mut tx, course_code)
        .await?
        .ok_or_else(|| controller_err!(NotFound, "No such course code.".to_string()))?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(schedule_id),
            details: Some(serde_json::json!({ "course_code": course_code })),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::RequestEnrolmentListFetch,
                CreditRegistrationAdminActionTarget::RosterSchedule,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;
    info!(actor = %user.id, course_code, "Admin requested an enrolment list fetch");

    let now = Utc::now();
    schedule.fetch_requested_at = Some(now);
    token.authorized_ok(web::Json(AdminRequestEnrolmentListFetchResult {
        next_fetch_at: schedule.next_fetch_at(now),
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/study-registry-conflicts/{conflict_id}/dismiss` -
Takes a student number clash off the list for good.

The links stay as they are. A reason is required, so the request carries a body.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/account-linking/study-registry-conflicts/{conflict_id}/dismiss",
    operation_id = "adminDismissStudyRegistryConflict",
    tag = "credit-registration-admin",
    params(("conflict_id" = Uuid, Path, description = "The clash's id")),
    request_body = AdminDismissStudyRegistryConflictPayload,
    responses(
        (status = 200, description = "Dismissed"),
        (status = 422, description = "No reason given"),
        (status = 404, description = "No such clash, or already dismissed")
    )
)]
pub async fn admin_dismiss_study_registry_conflict(
    user: AuthUser,
    pool: web::Data<PgPool>,
    conflict_id: web::Path<Uuid>,
    payload: web::Json<AdminDismissStudyRegistryConflictPayload>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let id = *conflict_id;
    let mut tx = conn.begin().await?;
    if !study_registry_student_number_conflicts::dismiss(&mut tx, id).await? {
        return Err(controller_err!(
            NotFound,
            "No such student number clash.".to_string()
        ));
    }
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(id),
            reason: Some(reason.to_string()),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::DismissStudyRegistryConflict,
                CreditRegistrationAdminActionTarget::StudyRegistryStudentNumberConflict,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;
    info!(actor = %user.id, conflict_id = %id, "Admin dismissed a student number clash");

    token.authorized_ok(web::Json(()))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/resend` - Sets off another
account-linking mail for one person on one course.

The mail goes to the addresses the study registry holds, and the recipient still has to open the link
while signed in, so the ownership proof is intact. An override does not ask a cap for an exemption: it
retires the ledger rows the cap is counting, as its own audited action, then runs the ordinary path.
*/
#[instrument(skip(pool, payload, app_conf, suotar_client))]
#[utoipa::path(
    post,
    path = "/account-linking/resend",
    operation_id = "adminResendAccountLinkingEmail",
    tag = "credit-registration-admin",
    request_body = AdminResendAccountLinkingEmailPayload,
    responses(
        (status = 200, description = "What the attempt did", body = AdminResendAccountLinkingEmailResult),
        (status = 422, description = "An override without a reason, or too soon after the last resend")
    )
)]
pub async fn admin_resend_account_linking_email(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminResendAccountLinkingEmailPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminResendAccountLinkingEmailResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;
    ensure_resend_possible(&mut conn, &app_conf, payload.course_id).await?;

    let student_number = required_student_number(&payload.student_number)?;
    let override_reason = if payload.override_rate_caps {
        Some(required_reason(payload.reason.as_deref().unwrap_or(""))?.to_string())
    } else {
        None
    };

    let recent = models::credit_registration_admin_actions::count_queued_resends_by_actor_since(
        &mut conn,
        user.id,
        Utc::now() - chrono::Duration::seconds(RESEND_QUIET_PERIOD_SECS),
    )
    .await?;
    if recent > 0 {
        return Err(controller_err!(
            BadRequest,
            "Wait a minute between resends.".to_string()
        ));
    }

    if let Some(credit_registration_id) = payload.credit_registration_id
        && credit_registrations::get_by_id(&mut conn, credit_registration_id)
            .await?
            .course_id
            != payload.course_id
    {
        return Err(controller_err!(
            BadRequest,
            "The registration is on another course.".to_string()
        ));
    }

    let ctx = ManualActionContext::new(&pool, &suotar_client, RESEND_CALLER);
    // Released so the Suotar call does not pin a pool connection for its whole timeout.
    drop(conn);
    info!(
        actor = %user.id,
        course_id = %payload.course_id,
        override_rate_caps = payload.override_rate_caps,
        "Admin requested a linking mail resend"
    );
    let rate_cap_override = override_reason.as_deref().map(|reason| RateCapOverride {
        actor_user_id: user.id,
        actor_role: GLOBAL_ADMIN_ROLE,
        reason,
    });
    let attempt =
        resend_linking_mail_for_target(&ctx, payload.course_id, &student_number, rate_cap_override)
            .await?;
    let mut conn = pool.acquire().await?;
    let outcome = ResendOutcome::from(attempt.outcome);
    info!(
        ?outcome,
        retired_mail_count = attempt.retired_mail_count,
        "Admin linking mail resend finished"
    );

    finish_resend(
        &mut conn,
        &user,
        &payload,
        &student_number,
        outcome,
        attempt.retired_mail_count,
        token,
    )
    .await
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/registrations/{credit_registration_id}/linking-candidates`
- Who on the code's enrolment list a student stuck waiting for a student number may be.

Lists the roster live and keeps the people no account is linked to who enrolled before account
linking began, whom no linking email went to. Ranked by resemblance to the student's account, which
is only a hint. Stores nothing beyond the call log row every study registry call writes.
*/
#[instrument(skip(pool, app_conf, suotar_client))]
#[utoipa::path(
    get,
    path = "/registrations/{credit_registration_id}/linking-candidates",
    operation_id = "getCreditRegistrationLinkingCandidates",
    tag = "credit-registration-admin",
    params(("credit_registration_id" = Uuid, Path, description = "Credit registration id")),
    responses(
        (status = 200, description = "The candidates", body = AdminLinkingCandidates),
        (status = 400, description = "Account linking is off, or the row is not stuck waiting for a student number")
    )
)]
pub async fn get_credit_registration_linking_candidates(
    user: AuthUser,
    pool: web::Data<PgPool>,
    credit_registration_id: web::Path<Uuid>,
    app_conf: web::Data<ApplicationConfiguration>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminLinkingCandidates>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let Some(since) = app_conf.suotar_configuration.account_linking_since else {
        return Err(controller_err!(
            BadRequest,
            "Account linking is switched off.".to_string()
        ));
    };
    let rules = attention_rules(&mut conn, &app_conf).await?;
    let row = credit_registrations::get_attention_items(
        &mut conn,
        &rules,
        Some(&[*credit_registration_id]),
    )
    .await?
    .into_iter()
    .next()
    .filter(|row| row.reasons.contains(&AttentionReason::StudentNumberStuck));
    let Some((row, course_code)) =
        row.and_then(|row| row.uh_course_code.clone().map(|code| (row, code)))
    else {
        return Err(controller_err!(
            BadRequest,
            "This registration is not stuck waiting for a student number.".to_string()
        ));
    };

    let ctx = ManualActionContext::new(&pool, &suotar_client, CANDIDATES_CALLER);
    // Released so the Suotar call does not pin a pool connection for its whole timeout.
    drop(conn);
    info!(actor = %user.id, credit_registration_id = %row.id, "Admin listing linking candidates");
    let people = list_unlinked_enrolled_before(&ctx, &course_code, since).await?;
    let mut conn = pool.acquire().await?;

    let study_registry_unavailable = people.is_none();
    let people = people.unwrap_or_default();
    let mails_by_person =
        count_linking_emails_for_course(&mut conn, &people, row.course_id).await?;

    let account = AccountIdentity {
        first_name: row.first_name.as_deref(),
        last_name: row.last_name.as_deref(),
        email: row.email.as_deref(),
    };
    let mut ranked: Vec<(u32, AdminLinkingCandidate)> = people
        .iter()
        .map(|person| {
            let found = similarities(&account, person);
            let score = similarity_score(&found);
            (score, to_linking_candidate(person, &mails_by_person, found))
        })
        .collect();
    ranked.sort_by(|(a_score, a), (b_score, b)| b_score.cmp(a_score).then_with(|| by_name(a, b)));

    token.authorized_ok(web::Json(AdminLinkingCandidates {
        course_id: row.course_id,
        course_name: row.course_name,
        course_code,
        account_linking_since: since,
        study_registry_unavailable,
        candidates: ranked.into_iter().map(|(_, candidate)| candidate).collect(),
    }))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/account-linking/courses` - The courses support
can send a linking email for by hand.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/account-linking/courses",
    operation_id = "getAccountLinkingCourses",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "By course name", body = Vec<AdminLinkingCourse>)
    )
)]
pub async fn get_account_linking_courses(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<AdminLinkingCourse>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let mut courses: Vec<AdminLinkingCourse> = Vec::new();
    for row in course_module_suotar_configurations::get_active_discovery_reports(&mut conn).await? {
        let Some(code) = row
            .uh_course_code
            .as_deref()
            .map(str::trim)
            .filter(|code| !code.is_empty())
        else {
            continue;
        };
        let course = match courses
            .iter_mut()
            .find(|course| course.course_id == row.course_id)
        {
            Some(course) => course,
            None => {
                courses.push(AdminLinkingCourse {
                    course_id: row.course_id,
                    course_name: row.course_name,
                    course_codes: Vec::new(),
                });
                courses.last_mut().expect("just pushed")
            }
        };
        if !course.course_codes.iter().any(|known| known == code) {
            course.course_codes.push(code.to_string());
        }
    }

    token.authorized_ok(web::Json(courses))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/account-linking/courses/{course_id}/unlinked-enrolees`
- Everyone on the course's enrolment lists whom no account is linked to, for sending one of them a
linking email by hand.

Lists the rosters live. Stores nothing beyond the call log row every study registry call writes.
*/
#[instrument(skip(pool, app_conf, suotar_client))]
#[utoipa::path(
    get,
    path = "/account-linking/courses/{course_id}/unlinked-enrolees",
    operation_id = "getAccountLinkingUnlinkedEnrolees",
    tag = "credit-registration-admin",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses(
        (status = 200, description = "The unlinked people", body = AdminUnlinkedEnrolees),
        (status = 400, description = "Account linking is off, or the course takes no part in credit registration")
    )
)]
pub async fn get_account_linking_unlinked_enrolees(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    app_conf: web::Data<ApplicationConfiguration>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminUnlinkedEnrolees>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;
    let course_id = course_id.into_inner();
    ensure_resend_possible(&mut conn, &app_conf, course_id).await?;

    let ctx = ManualActionContext::new(&pool, &suotar_client, UNLINKED_ENROLEES_CALLER);
    // Released so the Suotar call does not pin a pool connection for its whole timeout.
    drop(conn);
    info!(actor = %user.id, course_id = %course_id, "Admin listing unlinked enrolees");
    let people = list_unlinked_on_course_rosters(&ctx, course_id).await?;
    let mut conn = pool.acquire().await?;

    let study_registry_unavailable = people.is_none();
    let people = people.unwrap_or_default();
    let mails_by_person = count_linking_emails_for_course(&mut conn, &people, course_id).await?;
    let mut people: Vec<AdminLinkingCandidate> = people
        .iter()
        .map(|person| to_linking_candidate(person, &mails_by_person, Vec::new()))
        .collect();
    people.sort_by(by_name);

    token.authorized_ok(web::Json(AdminUnlinkedEnrolees {
        study_registry_unavailable,
        people,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/resolve-person` - Looks one
student number up in the study registry without changing anything.

The preview a manual link is gated on. Writes nothing but the call log row every study registry call
writes.
*/
#[instrument(skip(pool, payload, suotar_client))]
#[utoipa::path(
    post,
    path = "/account-linking/resolve-person",
    operation_id = "adminResolveStudentNumberForLinking",
    tag = "credit-registration-admin",
    request_body = AdminResolveStudentNumberPayload,
    responses(
        (status = 200, description = "Who the study registry says the number belongs to", body = AdminResolveStudentNumberResult),
        (status = 422, description = "No student number given")
    )
)]
pub async fn admin_resolve_student_number_for_linking(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminResolveStudentNumberPayload>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminResolveStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    if !models::course_modules::any_credit_registration_enabled(&mut conn).await? {
        return Err(controller_err!(
            BadRequest,
            "No course has credit registration configured.".to_string()
        ));
    }

    let student_number = typed_student_number(&payload.student_number)?;

    let ctx = ManualActionContext::new(&pool, &suotar_client, RESOLVE_CALLER);
    // Released so the Suotar call does not pin a pool connection for its whole timeout.
    drop(conn);
    info!(actor = %user.id, "Admin resolving a student number for linking");
    let resolved = look_up_person(&ctx, &student_number).await;
    debug!(
        found = resolved.as_ref().is_ok_and(Option::is_some),
        "Student number resolution result"
    );
    let mut conn = pool.acquire().await?;
    let existing =
        verified_student_numbers::get_by_student_number(&mut conn, student_number.expose_secret())
            .await?
            .or(match &resolved {
                Ok(Some(person)) => verified_student_numbers::get_by_sisu_person_ids(
                    &mut conn,
                    &[person.sisu_person_id.expose_secret().to_owned()],
                )
                .await?
                .into_iter()
                .next(),
                _ => None,
            });
    let already_linked_to_user_email = match &existing {
        Some(link) => {
            match models::user_details::get_user_details_by_user_id(&mut conn, link.user_id).await {
                Ok(details) => Some(details.email),
                Err(error)
                    if matches!(
                        error.error_type(),
                        models::ModelErrorType::RecordNotFound | models::ModelErrorType::NotFound
                    ) =>
                {
                    None
                }
                Err(error) => return Err(error.into()),
            }
        }
        None => None,
    };

    let mails = match &resolved {
        Ok(Some(person)) => {
            credit_registration_account_linking_emails::get_by_sisu_person_id(
                &mut conn,
                person.sisu_person_id.expose_secret(),
            )
            .await?
        }
        _ => Vec::new(),
    };
    let linking_emails = build_linking_emails(&mut conn, mails).await?;

    let shared = AdminResolveStudentNumberResult {
        found: false,
        student_number: student_number.expose_secret().to_owned(),
        sisu_person_id: None,
        first_names: None,
        last_name: None,
        code: None,
        study_registry_unavailable: false,
        lookup_error_code: None,
        already_linked_to_user_id: existing.as_ref().map(|link| link.user_id),
        already_linked_to_user_email,
        already_linked_via: existing.as_ref().map(|link| link.verified_via),
        linking_emails,
    };
    let result = match resolved {
        Ok(Some(person)) => AdminResolveStudentNumberResult {
            found: true,
            sisu_person_id: Some(person.sisu_person_id.expose_secret().to_owned()),
            first_names: expose_option(&person.first_names).map(str::to_owned),
            last_name: expose_option(&person.last_name).map(str::to_owned),
            code: Some(person.code),
            ..shared
        },
        Ok(None) => AdminResolveStudentNumberResult { ..shared },
        Err(PersonLookupError::UnexpectedAnswer { code }) => AdminResolveStudentNumberResult {
            lookup_error_code: Some(code),
            ..shared
        },
        Err(
            PersonLookupError::StudyRegistryUnavailable
            | PersonLookupError::ItemMissingFromResponse,
        ) => AdminResolveStudentNumberResult {
            study_registry_unavailable: true,
            ..shared
        },
    };

    token.authorized_ok(web::Json(result))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/manual-link` - Links a student
number to an account on an admin's judgement.

The last resort, for a student whose mailbox host will not accept our mail at all. An admin's judgement
stands in for proof of mailbox control, so the link is marked `admin_manual` forever, carries the
reason and names the admin.
*/
#[instrument(skip(pool, payload, suotar_client))]
#[utoipa::path(
    post,
    path = "/account-linking/manual-link",
    operation_id = "adminManuallyLinkStudentNumber",
    tag = "credit-registration-admin",
    request_body = AdminManuallyLinkStudentNumberPayload,
    responses(
        (status = 200, description = "What the attempt did", body = AdminManuallyLinkStudentNumberResult),
        (status = 422, description = "No reason, no student number, or no person id from the preview")
    )
)]
pub async fn admin_manually_link_student_number(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminManuallyLinkStudentNumberPayload>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminManuallyLinkStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    if !models::course_modules::any_credit_registration_enabled(&mut conn).await? {
        return Err(controller_err!(
            BadRequest,
            "No course has credit registration configured.".to_string()
        ));
    }

    let ManualLinkRequest {
        reason,
        student_number,
        previewed_person_id,
    } = manual_link_request(&payload)?;
    let reason = reason.to_string();

    let refused = |outcome: AdminManualLinkOutcome| {
        debug!(?outcome, "Admin manual link refused");
        AdminManuallyLinkStudentNumberResult {
            outcome,
            verified_student_number_id: None,
            affected_registration_count: 0,
        }
    };
    let ctx = ManualActionContext::new(&pool, &suotar_client, MANUAL_LINK_CALLER);
    // Released so the Suotar call does not pin a pool connection for its whole timeout.
    drop(conn);
    info!(actor = %user.id, target_user_id = %payload.user_id, "Admin manually linking a student number");
    let person: RegistryPerson = match look_up_person(&ctx, &student_number).await {
        Ok(Some(person)) => person,
        Ok(None) => {
            return token.authorized_ok(web::Json(refused(
                AdminManualLinkOutcome::StudentNumberNotFound,
            )));
        }
        Err(PersonLookupError::UnexpectedAnswer { .. }) => {
            return token.authorized_ok(web::Json(refused(
                AdminManualLinkOutcome::UnexpectedStudyRegistryAnswer,
            )));
        }
        Err(
            PersonLookupError::StudyRegistryUnavailable
            | PersonLookupError::ItemMissingFromResponse,
        ) => {
            return token.authorized_ok(web::Json(refused(
                AdminManualLinkOutcome::StudyRegistryUnavailable,
            )));
        }
    };
    if person.sisu_person_id.expose_secret() != previewed_person_id.expose_secret() {
        return token.authorized_ok(web::Json(refused(AdminManualLinkOutcome::PreviewMismatch)));
    }
    let mut conn = pool.acquire().await?;

    if let Some(conflict) = verified_student_numbers::find_link_conflict(
        &mut conn,
        student_number.expose_secret(),
        person.sisu_person_id.expose_secret(),
        payload.user_id,
    )
    .await?
    {
        let outcome = match conflict {
            LinkConflict::SameAccount => AdminManualLinkOutcome::AlreadyLinkedToThisAccount,
            LinkConflict::AnotherAccount => AdminManualLinkOutcome::AlreadyLinkedToAnotherAccount,
        };
        return token.authorized_ok(web::Json(refused(outcome)));
    }

    let mut tx = conn.begin().await?;
    // A student who changed programmes has a new number; the old link is retired, not deleted, so the
    // audit trail survives.
    let current_link_id = verified_student_numbers::get_by_user_id(&mut tx, payload.user_id)
        .await?
        .map(|current| current.id);
    let (verified_student_number_id, affected_registration_count) =
        verified_student_numbers::replace_verified_student_number(
            &mut tx,
            current_link_id,
            &NewVerifiedStudentNumber {
                user_id: payload.user_id,
                student_number: student_number.clone().into(),
                sisu_person_id: person.sisu_person_id.clone().into(),
                first_names: person.first_names.clone().map(Into::into),
                last_name: person.last_name.clone().map(Into::into),
                verified_via: StudentNumberVerificationMethod::AdminManual,
                // No mailbox was proved, so there is no address the proof could rest on.
                verified_via_email: None,
                linked_by_user_id: Some(user.id),
                link_reason: Some(reason.clone()),
                verified_from_course_id: None,
            },
            Some(user.id),
            models::credit_registration_events::CreditRegistrationEventKind::AdminAction,
            "An administrator linked this student number by hand.",
        )
        .await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(verified_student_number_id),
            reason: Some(reason),
            details: Some(serde_json::json!({
                "user_id": payload.user_id,
                "student_number": student_number.expose_secret(),
            })),
            affected_row_count: Some(
                i32::try_from(affected_registration_count).unwrap_or(i32::MAX),
            ),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::ManualLinkStudentNumber,
                CreditRegistrationAdminActionTarget::VerifiedStudentNumber,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;
    info!(
        verified_student_number_id = %verified_student_number_id,
        affected_registration_count,
        "Admin manual link finished"
    );

    token.authorized_ok(web::Json(AdminManuallyLinkStudentNumberResult {
        outcome: AdminManualLinkOutcome::Linked,
        verified_student_number_id: Some(verified_student_number_id),
        affected_registration_count,
    }))
}

/// The three values a manual link may not be attempted without.
struct ManualLinkRequest<'a> {
    reason: &'a str,
    student_number: SecretString,
    previewed_person_id: SecretString,
}

/// Refuses a manual link that skipped the preview or gave no reason, before anything is asked of the
/// study registry. The person id can only have come from the preview: it is the registry's own
/// identifier, not something a caller could produce from the student number in front of them.
fn manual_link_request(
    payload: &AdminManuallyLinkStudentNumberPayload,
) -> Result<ManualLinkRequest<'_>, ControllerError> {
    let reason = required_reason(&payload.reason)?;
    let student_number = typed_student_number(&payload.student_number)?;
    let previewed_person_id = SecretString::from(payload.sisu_person_id.expose_secret().trim());
    if previewed_person_id.expose_secret().is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Check the number in the study registry first.".to_string()
        ));
    }
    Ok(ManualLinkRequest {
        reason,
        student_number,
        previewed_person_id,
    })
}

fn required_student_number(raw: &SecretString) -> Result<SecretString, ControllerError> {
    let student_number = SecretString::from(raw.expose_secret().trim());
    if student_number.expose_secret().is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Name a student number.".to_string()
        ));
    }
    Ok(student_number)
}

/// [`required_student_number`] for a number an admin typed to verify a link, which must also pass
/// [`parse_student_number`]: a typo would otherwise link a stranger's number. Numbers from the
/// study registry are never held to this, as their format is Sisu's to change.
fn typed_student_number(raw: &SecretString) -> Result<SecretString, ControllerError> {
    required_student_number(raw)?;
    parse_student_number(raw.expose_secret())
        .map(SecretString::from)
        .map_err(|invalid| controller_err!(BadRequest, invalid.message().to_string()))
}

/// Linking emails each Sisu person id has had for the course, replaced ones included.
async fn count_linking_emails_for_course(
    conn: &mut PgConnection,
    people: &[RosterPerson],
    course_id: Uuid,
) -> Result<HashMap<String, i64>, ControllerError> {
    let person_ids: Vec<String> = people
        .iter()
        .map(|person| person.person_id.expose_secret().to_owned())
        .collect();
    let mails_by_person =
        credit_registration_account_linking_emails::count_mails_per_person_for_course(
            conn,
            &person_ids,
            course_id,
        )
        .await?
        .into_iter()
        .collect();
    Ok(mails_by_person)
}

fn to_linking_candidate(
    person: &RosterPerson,
    mails_by_person: &HashMap<String, i64>,
    similarities: Vec<LinkingCandidateSimilarity>,
) -> AdminLinkingCandidate {
    AdminLinkingCandidate {
        student_number: person.student_number.expose_secret().to_owned(),
        first_names: person
            .first_names
            .as_ref()
            .map(|names| names.expose_secret().to_owned()),
        last_name: person
            .last_name
            .as_ref()
            .map(|name| name.expose_secret().to_owned()),
        email: mail_address(person).map(|address| address.expose_secret().to_owned()),
        enrolled_at: person.enrolled_at(),
        linking_emails_for_course: mails_by_person
            .get(person.person_id.expose_secret())
            .copied()
            .unwrap_or(0),
        similarities,
    }
}

fn by_name(a: &AdminLinkingCandidate, b: &AdminLinkingCandidate) -> std::cmp::Ordering {
    let folded = |name: &Option<String>| name.as_ref().map(|name| name.to_lowercase());
    // `None` sorts first, so reversing the flag puts people with no last name last.
    let (a_last, b_last) = (folded(&a.last_name), folded(&b.last_name));
    a_last
        .is_none()
        .cmp(&b_last.is_none())
        .then_with(|| a_last.cmp(&b_last))
        .then_with(|| folded(&a.first_names).cmp(&folded(&b.first_names)))
}

/// Audits the resend whatever it did, and reports where this person's mails now stand.
async fn finish_resend(
    conn: &mut PgConnection,
    user: &AuthUser,
    payload: &AdminResendAccountLinkingEmailPayload,
    student_number: &SecretString,
    outcome: ResendOutcome,
    retired_mail_count: i64,
    token: crate::domain::authorization::AuthorizationToken,
) -> ControllerResult<web::Json<AdminResendAccountLinkingEmailResult>> {
    let (mails, mails_sent_for_this_course) = record_resend_and_fetch_mails(
        conn,
        payload.course_id,
        Some(student_number.expose_secret()),
        user.id,
        GLOBAL_ADMIN_ROLE,
        None,
        payload.reason.clone(),
        serde_json::json!({
            "outcome": outcome,
            "student_number": student_number.expose_secret(),
            "override_rate_caps": payload.override_rate_caps,
            "retired_mail_count": retired_mail_count,
            "credit_registration_id": payload.credit_registration_id,
        }),
    )
    .await?;
    let linking_emails = build_linking_emails(conn, mails).await?;

    token.authorized_ok(web::Json(AdminResendAccountLinkingEmailResult {
        outcome,
        retired_mail_count,
        linking_emails,
        mails_sent_for_this_course,
        max_mails_per_person_and_course: MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
        quiet_period_secs: LINKING_MAIL_QUIET_PERIOD.num_seconds(),
    }))
}

/// Every active course code's schedule, with the modules that share its enrolment list.
async fn build_course_codes(
    conn: &mut PgConnection,
    account_linking_since: Option<DateTime<Utc>>,
    pressers: &[WaitingPresser],
    unused_by_code: &[(String, i64)],
) -> Result<Vec<AccountLinkingCourseCode>, ControllerError> {
    let mut modules_by_code: HashMap<String, Vec<AccountLinkingCodeModule>> = HashMap::new();
    for row in course_module_suotar_configurations::get_active_discovery_reports(conn).await? {
        let Some(code) = row.uh_course_code.as_deref().map(str::trim) else {
            continue;
        };
        modules_by_code
            .entry(code.to_string())
            .or_default()
            .push(AccountLinkingCodeModule {
                course_id: row.course_id,
                course_name: row.course_name,
                course_module_id: row.course_module_id,
                course_module_name: row.course_module_name,
                last_listed_at: row.last_listed_at,
            });
    }
    let now = Utc::now();
    let schedules = credit_registration_roster_schedules::get_schedules(
        conn,
        None,
        ScheduleSelection::Every,
        account_linking_since,
    )
    .await?;
    Ok(schedules
        .into_iter()
        .map(|schedule: RosterSchedule| AccountLinkingCourseCode {
            pressed_waiting_count: pressers
                .iter()
                .filter(|presser| {
                    presser.uh_course_code.as_deref() == Some(schedule.course_code.as_str())
                })
                .count() as i64,
            unused_link_count: unused_by_code
                .iter()
                .find(|(code, _)| *code == schedule.course_code)
                .map_or(0, |(_, count)| *count),
            is_enrolment_list_empty: schedule.last_listed_person_count == Some(0),
            is_fetch_failing: schedule.consecutive_failures > 0,
            last_mailing_fetch_started_at: schedule.last_mailing_fetch_started_at,
            modules: modules_by_code
                .remove(&schedule.course_code)
                .unwrap_or_default(),
            next_fetch_at: schedule.next_fetch_at(now),
            fetch_requested_at: schedule.unserved_fetch_request_at(),
            last_fetched_at: schedule.last_fetched_at,
            waiting_count: schedule.waiting_count,
            last_listed_person_count: schedule.last_listed_person_count,
            consecutive_failures: schedule.consecutive_failures,
            retry_not_before: schedule.retry_not_before,
            last_error: schedule.last_error,
            linking: schedule.linking_counters,
            unlinked_enrolled_before_count: schedule.unlinked_enrolled_before_count,
            course_code: schedule.course_code,
        })
        .collect())
}

async fn build_stale_addresses(
    conn: &mut PgConnection,
    rows: Vec<StaleUnclaimedLinkingMails>,
) -> Result<Vec<AccountLinkingStaleAddress>, ControllerError> {
    let ids: Vec<Uuid> = rows.iter().flat_map(|row| row.mail_ids.clone()).collect();
    let reports =
        credit_registration_account_linking_emails::get_send_status_reports(conn, &ids).await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let sends = row
                .mail_ids
                .iter()
                .zip(row.addresses)
                .map(|(id, address)| AccountLinkingSendOutcome {
                    address: address.expose_secret().to_owned(),
                    send_status: reports
                        .get(id)
                        .map(|report| report.email_send_status)
                        .unwrap_or(EmailSendStatus::Queued),
                })
                .collect();
            AccountLinkingStaleAddress {
                sends,
                student_number: row.student_number.expose_secret().to_owned(),
                sisu_person_id: row.sisu_person_id.expose_secret().to_owned(),
                course_id: row.course_id,
                course_name: row.course_name,
                mail_count: row.mail_count,
                first_sent_at: row.first_sent_at,
                last_sent_at: row.last_sent_at,
            }
        })
        .collect())
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/account-linking", web::get().to(get_account_linking_stats))
        .route(
            "/account-linking/resend",
            web::post().to(admin_resend_account_linking_email),
        )
        .route(
            "/account-linking/resolve-person",
            web::post().to(admin_resolve_student_number_for_linking),
        )
        .route(
            "/account-linking/manual-link",
            web::post().to(admin_manually_link_student_number),
        )
        .route(
            "/account-linking/fetch-enrolment-list",
            web::post().to(admin_request_enrolment_list_fetch),
        )
        .route(
            "/account-linking/study-registry-conflicts/{conflict_id}/dismiss",
            web::post().to(admin_dismiss_study_registry_conflict),
        )
        .route(
            "/account-linking/courses",
            web::get().to(get_account_linking_courses),
        )
        .route(
            "/account-linking/courses/{course_id}/unlinked-enrolees",
            web::get().to(get_account_linking_unlinked_enrolees),
        )
        .route(
            "/registrations/{credit_registration_id}/linking-candidates",
            web::get().to(get_credit_registration_linking_candidates),
        );
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manual_link_payload(
        reason: &str,
        student_number: &str,
        sisu_person_id: &str,
    ) -> AdminManuallyLinkStudentNumberPayload {
        AdminManuallyLinkStudentNumberPayload {
            user_id: Uuid::new_v4(),
            student_number: student_number.into(),
            sisu_person_id: sisu_person_id.into(),
            reason: reason.to_string(),
        }
    }

    #[test]
    fn a_manual_link_is_refused_without_a_preview_a_reason_or_a_valid_number() {
        assert!(
            manual_link_request(&manual_link_payload(
                "Host bounces our mail.",
                "012345672",
                ""
            ))
            .is_err()
        );
        assert!(manual_link_request(&manual_link_payload("   ", "012345672", "hy-hlo-1")).is_err());
        assert!(manual_link_request(&manual_link_payload("", "012345672", "hy-hlo-1")).is_err());
        assert!(
            manual_link_request(&manual_link_payload(
                "Host bounces our mail.",
                "",
                "hy-hlo-1"
            ))
            .is_err()
        );
        for mistyped in ["012345678", "12345672", "0123456721"] {
            assert!(
                manual_link_request(&manual_link_payload(
                    "Host bounces our mail.",
                    mistyped,
                    "hy-hlo-1"
                ))
                .is_err(),
                "{mistyped}"
            );
        }
        let payload =
            manual_link_payload("  Host bounces our mail.  ", " 012345672 ", " hy-hlo-1 ");
        let allowed = manual_link_request(&payload)
            .expect("a reason, a number and a previewed person id are all there");
        assert_eq!(allowed.reason, "Host bounces our mail.");
        assert_eq!(allowed.student_number.expose_secret(), "012345672");
        assert_eq!(allowed.previewed_person_id.expose_secret(), "hy-hlo-1");
    }
}
