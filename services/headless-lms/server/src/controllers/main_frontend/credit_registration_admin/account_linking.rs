//! The account-linking funnel, resending and hand-resolving linking mails, and manual links.

use headless_lms_models::course_module_suotar_realisations;
use headless_lms_models::credit_registration_account_linking_emails::{
    self, StaleUnclaimedLinkingMails,
};
use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registrations::CreditRegistrationState;
use headless_lms_models::email_deliveries::EmailSendStatus;
use headless_lms_models::library::credit_registration::account_linking::{
    LINKING_MAIL_QUIET_PERIOD_SECS, MAX_LINKING_MAILS_PER_PERSON_AND_COURSE, retire_capped_mails,
};
use headless_lms_models::verified_student_numbers::{
    self, NewVerifiedStudentNumber, StudentNumberVerificationMethod,
};
use headless_lms_models::{credit_registrations, student_number_verification_tokens};
use utoipa::ToSchema;

use crate::domain::credit_registration_phases::PhaseContext;
use crate::domain::credit_registration_phases::linking_mail_resend::{
    LinkingMailResendOutcome, ResolvedPerson, resend_linking_mail, resolve_person,
};
use crate::prelude::*;
use headless_lms_base::config::ApplicationConfiguration;

use super::{
    AdminLinkingEmail, authorize_credit_registration_admin, build_linking_emails, required_reason,
};

const STALE_UNCLAIMED_LIMIT: i64 = 200;

/// Marks a manual action's study registry call in the call log as something a person set off.
const RESEND_CALLER: &str = "admin-resend";
const RESOLVE_CALLER: &str = "admin-resolve-person";

/// A fat-finger guard on top of the per-person caps, which this endpoint can only override by retiring
/// ledger rows.
const RESEND_QUIET_PERIOD_SECS: i64 = 60;

fn phase_context<'a>(
    pool: &'a web::Data<PgPool>,
    suotar_client: &'a web::Data<headless_lms_utils::services::suotar::SuotarClient>,
    app_conf: &'a ApplicationConfiguration,
    caller: &'a str,
) -> PhaseContext<'a> {
    PhaseContext {
        pool,
        suotar_client,
        test_mode: app_conf.test_mode,
        caller,
        base_url: &app_conf.base_url,
    }
}

/// The account-linking funnel. The `_last_run` steps come from counters the discovery phase overwrites
/// whole, the `_in_window` ones from the window: there is no single denominator.
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
    pub queued: i64,
    pub retrying: i64,
    pub sent: i64,
    pub send_failed: i64,
}

/// Hard send failures grouped by recipient domain.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingFailureDomain {
    pub domain: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingRealisationCounters {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_unit_realisation_id: String,
    pub label: Option<String>,
    pub uh_course_code: Option<String>,
    /// When the counters below were collected. Not the last attempt: a failing realisation keeps the
    /// last roster that arrived.
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    /// Set while the listing attempts since `last_listed_at` are failing, so an empty course and an
    /// unreachable one do not read alike.
    pub last_listing_error:
        Option<headless_lms_models::credit_registrations::CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
    pub listed_person_count: Option<i32>,
    pub already_linked_count: Option<i32>,
    pub mailed_count: Option<i32>,
    pub suppressed_by_dedup_count: Option<i32>,
    pub suppressed_by_rate_cap_count: Option<i32>,
    /// Persons the registry holds no address for: the one population no remedy here can reach.
    pub no_address_count: Option<i32>,
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
    pub addresses: Vec<String>,
    pub send_statuses: Vec<EmailSendStatus>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct VerifiedStudentNumberMethodTotal {
    pub verified_via: StudentNumberVerificationMethod,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingStats {
    pub window_secs: i64,
    pub funnel: AccountLinkingFunnel,
    pub send_status_totals: AccountLinkingSendStatusTotals,
    pub hard_failure_domains: Vec<AccountLinkingFailureDomain>,
    pub realisations: Vec<AccountLinkingRealisationCounters>,
    pub stale_addresses: Vec<AccountLinkingStaleAddress>,
    pub links_total_by_method: Vec<VerifiedStudentNumberMethodTotal>,
    pub links_in_window_by_method: Vec<VerifiedStudentNumberMethodTotal>,
    /// Accounts with a consented completion still waiting for a number.
    pub waiting_for_student_number_count: i64,
    pub max_mails_per_person_and_course: i64,
    pub quiet_period_secs: i64,
}

#[derive(Debug, Deserialize)]
pub struct AccountLinkingStatsQuery {
    window_days: Option<u32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminResendAccountLinkingEmailPayload {
    pub student_number: String,
    pub course_id: Uuid,
    /// Retires the mails a cap is counting, then runs the ordinary send path. Requires a reason.
    pub override_rate_caps: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminResendOutcome {
    /// A mail is owed and the sender is handed it on the next run.
    Queued,
    AlreadyMailedToEveryKnownAddress,
    /// A cap refused it. Overridable here, and nowhere else.
    RefusedByRateCap,
    NoAddressInStudyRegistry,
    NotOnTheCourseRoster,
    /// A link already exists, so no mail is owed.
    AlreadyLinked,
    StudyRegistryUnavailable,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminResendAccountLinkingEmailResult {
    pub outcome: AdminResendOutcome,
    /// Mails retired to get past a cap. Always zero without an override.
    pub retired_mail_count: i64,
    pub linking_emails: Vec<AdminLinkingEmail>,
    pub mails_sent_for_this_course: i64,
    pub max_mails_per_person_and_course: i64,
    pub quiet_period_secs: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminResolveStudentNumberPayload {
    pub student_number: String,
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
    pub already_linked_to_user_id: Option<Uuid>,
    pub already_linked_to_user_email: Option<String>,
    pub already_linked_via: Option<StudentNumberVerificationMethod>,
    pub linking_emails: Vec<AdminLinkingEmail>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminManuallyLinkStudentNumberPayload {
    pub user_id: Uuid,
    pub student_number: String,
    /// From the preview. Re-resolved on arrival, and a mismatch is refused, so a typo cannot mint a
    /// link to somebody else.
    pub sisu_person_id: String,
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
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminManuallyLinkStudentNumberResult {
    pub outcome: AdminManualLinkOutcome,
    pub verified_student_number_id: Option<Uuid>,
    /// Registrations the link unblocked.
    pub affected_registration_count: i64,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/account-linking` - The linking funnel, the
per-realisation counters, the send-status totals and the stale-address list.
*/
#[instrument(skip(pool))]
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
) -> ControllerResult<web::Json<AccountLinkingStats>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let window_days = i64::from(query.window_days.unwrap_or(30).clamp(1, 365));
    let window_secs = window_days * 24 * 60 * 60;
    let since = Utc::now() - chrono::Duration::days(window_days);

    let realisations = course_module_suotar_realisations::get_active_discovery_reports(&mut conn)
        .await?
        .into_iter()
        .map(|row| AccountLinkingRealisationCounters {
            course_id: row.course_id,
            course_name: row.course_name,
            course_module_id: row.course_module_id,
            course_module_name: row.course_module_name,
            course_unit_realisation_id: row.course_unit_realisation_id,
            label: row.label,
            uh_course_code: row.uh_course_code,
            last_listed_at: row.last_listed_at,
            last_listing_attempted_at: row.last_listing_attempted_at,
            last_listing_error: row.last_listing_error,
            consecutive_listing_failures: row.consecutive_listing_failures,
            listed_person_count: row.last_listed_person_count,
            already_linked_count: row.last_already_linked_count,
            mailed_count: row.last_mailed_count,
            suppressed_by_dedup_count: row.last_suppressed_by_dedup_count,
            suppressed_by_rate_cap_count: row.last_suppressed_by_rate_cap_count,
            no_address_count: row.last_no_address_count,
        })
        .collect::<Vec<_>>();
    let sum = |pick: fn(&AccountLinkingRealisationCounters) -> Option<i32>| -> i64 {
        realisations
            .iter()
            .filter_map(pick)
            .map(i64::from)
            .sum::<i64>()
    };

    let now = Utc::now();
    let totals = credit_registration_account_linking_emails::get_send_status_totals_since(
        &mut conn, since, now,
    )
    .await?;
    let send_status_totals = AccountLinkingSendStatusTotals {
        queued: totals.queued,
        retrying: totals.retrying,
        sent: totals.sent,
        send_failed: totals.send_failed,
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

    let links_total_by_method = verified_student_numbers::count_by_method_since(&mut conn, None)
        .await?
        .into_iter()
        .map(|(verified_via, count)| VerifiedStudentNumberMethodTotal {
            verified_via,
            count,
        })
        .collect::<Vec<_>>();
    let links_in_window_by_method =
        verified_student_numbers::count_by_method_since(&mut conn, Some(since))
            .await?
            .into_iter()
            .map(|(verified_via, count)| VerifiedStudentNumberMethodTotal {
                verified_via,
                count,
            })
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

    let waiting_for_student_number_count = credit_registrations::count_by_state(&mut conn)
        .await?
        .into_iter()
        .find(|(state, _)| *state == CreditRegistrationState::PendingStudentNumber)
        .map_or(0, |(_, count)| count);

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

    token.authorized_ok(web::Json(AccountLinkingStats {
        window_secs,
        funnel,
        send_status_totals,
        hard_failure_domains,
        realisations,
        stale_addresses,
        links_total_by_method,
        links_in_window_by_method,
        waiting_for_student_number_count,
        max_mails_per_person_and_course: MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
        quiet_period_secs: LINKING_MAIL_QUIET_PERIOD_SECS,
    }))
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
        (status = 400, description = "An override without a reason, or too soon after the last resend")
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

    let student_number = payload.student_number.trim();
    if student_number.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Name a student number.".to_string()
        ));
    }
    let override_reason = if payload.override_rate_caps {
        Some(required_reason(payload.reason.as_deref().unwrap_or(""))?.to_string())
    } else {
        None
    };

    let recent = models::credit_registration_admin_actions::count_by_actor_since(
        &mut conn,
        user.id,
        CreditRegistrationAdminAction::ResendLinkEmail,
        Utc::now() - chrono::Duration::seconds(RESEND_QUIET_PERIOD_SECS),
    )
    .await?;
    if recent > 0 {
        return Err(controller_err!(
            BadRequest,
            "Wait a minute between resends.".to_string()
        ));
    }

    if verified_student_numbers::get_by_student_number(&mut conn, student_number)
        .await?
        .is_some()
    {
        return finish_resend(
            &mut conn,
            &user,
            &payload,
            student_number,
            AdminResendOutcome::AlreadyLinked,
            0,
            token,
        )
        .await;
    }

    let retired_mail_count = match &override_reason {
        Some(reason) => {
            retire_capped_mails(
                &mut conn,
                user.id,
                GLOBAL_ADMIN_ROLE,
                payload.course_id,
                student_number,
                reason,
            )
            .await?
        }
        None => 0,
    };

    let ctx = phase_context(&pool, &suotar_client, &app_conf, RESEND_CALLER);
    let outcome = match resend_linking_mail(&ctx, payload.course_id, student_number).await? {
        LinkingMailResendOutcome::Claimed => AdminResendOutcome::Queued,
        LinkingMailResendOutcome::AlreadyMailedToEveryKnownAddress => {
            AdminResendOutcome::AlreadyMailedToEveryKnownAddress
        }
        LinkingMailResendOutcome::RefusedByRateCap => AdminResendOutcome::RefusedByRateCap,
        LinkingMailResendOutcome::NoAddressInStudyRegistry => {
            AdminResendOutcome::NoAddressInStudyRegistry
        }
        LinkingMailResendOutcome::NotOnTheCourseRoster => AdminResendOutcome::NotOnTheCourseRoster,
        LinkingMailResendOutcome::StudyRegistryUnavailable => {
            AdminResendOutcome::StudyRegistryUnavailable
        }
    };

    finish_resend(
        &mut conn,
        &user,
        &payload,
        student_number,
        outcome,
        retired_mail_count,
        token,
    )
    .await
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/resolve-person` - Looks one
student number up in the study registry without changing anything.

The preview a manual link is gated on. Writes nothing but the call log row every study registry call
writes.
*/
#[instrument(skip(pool, payload, app_conf, suotar_client))]
#[utoipa::path(
    post,
    path = "/account-linking/resolve-person",
    operation_id = "adminResolveStudentNumberForLinking",
    tag = "credit-registration-admin",
    request_body = AdminResolveStudentNumberPayload,
    responses(
        (status = 200, description = "Who the study registry says the number belongs to", body = AdminResolveStudentNumberResult),
        (status = 400, description = "No student number given")
    )
)]
pub async fn admin_resolve_student_number_for_linking(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminResolveStudentNumberPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminResolveStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let student_number = payload.student_number.trim();
    if student_number.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Name a student number.".to_string()
        ));
    }

    let ctx = phase_context(&pool, &suotar_client, &app_conf, RESOLVE_CALLER);
    let resolved = resolve_person(&ctx, student_number).await;
    let existing = verified_student_numbers::get_by_student_number(&mut conn, student_number)
        .await?
        .or(match &resolved {
            Ok(Some(person)) => verified_student_numbers::get_by_sisu_person_ids(
                &mut conn,
                std::slice::from_ref(&person.sisu_person_id),
            )
            .await?
            .into_iter()
            .next(),
            _ => None,
        });
    let already_linked_to_user_email = match &existing {
        Some(link) => models::user_details::get_user_details_by_user_id(&mut conn, link.user_id)
            .await
            .ok()
            .map(|details| details.email),
        None => None,
    };

    let mails = match &resolved {
        Ok(Some(person)) => {
            credit_registration_account_linking_emails::get_by_sisu_person_id(
                &mut conn,
                &person.sisu_person_id,
            )
            .await?
        }
        _ => Vec::new(),
    };
    let linking_emails = build_linking_emails(&mut conn, mails).await?;

    let result = match resolved {
        Ok(Some(person)) => AdminResolveStudentNumberResult {
            found: true,
            student_number: student_number.to_string(),
            sisu_person_id: Some(person.sisu_person_id),
            first_names: Some(person.first_names),
            last_name: Some(person.last_name),
            code: Some(person.code),
            study_registry_unavailable: false,
            already_linked_to_user_id: existing.as_ref().map(|link| link.user_id),
            already_linked_to_user_email,
            already_linked_via: existing.as_ref().map(|link| link.verified_via),
            linking_emails,
        },
        Ok(None) => AdminResolveStudentNumberResult {
            found: false,
            student_number: student_number.to_string(),
            sisu_person_id: None,
            first_names: None,
            last_name: None,
            code: None,
            study_registry_unavailable: false,
            already_linked_to_user_id: existing.as_ref().map(|link| link.user_id),
            already_linked_to_user_email,
            already_linked_via: existing.as_ref().map(|link| link.verified_via),
            linking_emails,
        },
        Err(()) => AdminResolveStudentNumberResult {
            found: false,
            student_number: student_number.to_string(),
            sisu_person_id: None,
            first_names: None,
            last_name: None,
            code: None,
            study_registry_unavailable: true,
            already_linked_to_user_id: existing.as_ref().map(|link| link.user_id),
            already_linked_to_user_email,
            already_linked_via: existing.as_ref().map(|link| link.verified_via),
            linking_emails,
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
#[instrument(skip(pool, payload, app_conf, suotar_client))]
#[utoipa::path(
    post,
    path = "/account-linking/manual-link",
    operation_id = "adminManuallyLinkStudentNumber",
    tag = "credit-registration-admin",
    request_body = AdminManuallyLinkStudentNumberPayload,
    responses(
        (status = 200, description = "What the attempt did", body = AdminManuallyLinkStudentNumberResult),
        (status = 400, description = "No reason, no student number, or no person id from the preview")
    )
)]
pub async fn admin_manually_link_student_number(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminManuallyLinkStudentNumberPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminManuallyLinkStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let ManualLinkRequest {
        reason,
        student_number,
        previewed_person_id,
    } = manual_link_request(&payload)?;
    let reason = reason.to_string();

    let refused = |outcome| AdminManuallyLinkStudentNumberResult {
        outcome,
        verified_student_number_id: None,
        affected_registration_count: 0,
    };
    let ctx = phase_context(&pool, &suotar_client, &app_conf, RESOLVE_CALLER);
    let person: ResolvedPerson = match resolve_person(&ctx, student_number).await {
        Ok(Some(person)) => person,
        Ok(None) => {
            return token.authorized_ok(web::Json(refused(
                AdminManualLinkOutcome::StudentNumberNotFound,
            )));
        }
        Err(()) => {
            return token.authorized_ok(web::Json(refused(
                AdminManualLinkOutcome::StudyRegistryUnavailable,
            )));
        }
    };
    if person.sisu_person_id != previewed_person_id {
        return token.authorized_ok(web::Json(refused(AdminManualLinkOutcome::PreviewMismatch)));
    }

    let holder = verified_student_numbers::get_by_student_number(&mut conn, student_number).await?;
    if let Some(holder) = &holder {
        let outcome = if holder.user_id == payload.user_id {
            AdminManualLinkOutcome::AlreadyLinkedToThisAccount
        } else {
            AdminManualLinkOutcome::AlreadyLinkedToAnotherAccount
        };
        return token.authorized_ok(web::Json(refused(outcome)));
    }

    let mut tx = conn.begin().await?;
    // A student who changed programmes has a new number; the old link is retired, not deleted, so the
    // audit trail survives.
    if let Some(current) =
        verified_student_numbers::get_by_user_id(&mut tx, payload.user_id).await?
    {
        verified_student_numbers::soft_delete(&mut tx, current.id).await?;
    }
    let verified_student_number_id = verified_student_numbers::insert(
        &mut tx,
        PKeyPolicy::Generate,
        &NewVerifiedStudentNumber {
            user_id: payload.user_id,
            student_number: student_number.to_string(),
            sisu_person_id: person.sisu_person_id.clone(),
            first_names: Some(person.first_names.clone()),
            last_name: Some(person.last_name.clone()),
            verified_via: StudentNumberVerificationMethod::AdminManual,
            // No mailbox was proved, so there is no address the proof could rest on.
            verified_via_email: None,
            verified_via_email_match_field: None,
            account_email_verified_at: None,
            linked_by_user_id: Some(user.id),
            link_reason: Some(reason.clone()),
            verified_from_course_id: None,
        },
    )
    .await?;
    // The number is established, so the outstanding mailed links to it are no longer owed.
    student_number_verification_tokens::soft_delete_unused_for_student_number(
        &mut tx,
        student_number,
    )
    .await?;
    let affected_registration_count =
        models::library::credit_registration::student_number_change::record_student_number_change(
            &mut tx,
            payload.user_id,
            user.id,
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
                "student_number": student_number,
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

    token.authorized_ok(web::Json(AdminManuallyLinkStudentNumberResult {
        outcome: AdminManualLinkOutcome::Linked,
        verified_student_number_id: Some(verified_student_number_id),
        affected_registration_count,
    }))
}

/// The three values a manual link may not be attempted without.
struct ManualLinkRequest<'a> {
    reason: &'a str,
    student_number: &'a str,
    previewed_person_id: &'a str,
}

/// Refuses a manual link that skipped the preview or gave no reason, before anything is asked of the
/// study registry. The person id can only have come from the preview: it is the registry's own
/// identifier, not something a caller could produce from the student number in front of them.
fn manual_link_request(
    payload: &AdminManuallyLinkStudentNumberPayload,
) -> Result<ManualLinkRequest<'_>, ControllerError> {
    let reason = required_reason(&payload.reason)?;
    let student_number = payload.student_number.trim();
    if student_number.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Name a student number.".to_string()
        ));
    }
    let previewed_person_id = payload.sisu_person_id.trim();
    if previewed_person_id.is_empty() {
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

/// Audits the resend whatever it did, and reports where this person's mails now stand.
async fn finish_resend(
    conn: &mut PgConnection,
    user: &AuthUser,
    payload: &AdminResendAccountLinkingEmailPayload,
    student_number: &str,
    outcome: AdminResendOutcome,
    retired_mail_count: i64,
    token: crate::domain::authorization::AuthorizationToken,
) -> ControllerResult<web::Json<AdminResendAccountLinkingEmailResult>> {
    models::credit_registration_admin_actions::record(
        conn,
        &NewCreditRegistrationAdminAction {
            target_id: Some(payload.course_id),
            reason: payload.reason.clone(),
            details: Some(serde_json::json!({
                "outcome": outcome,
                "student_number": student_number,
                "override_rate_caps": payload.override_rate_caps,
                "retired_mail_count": retired_mail_count,
            })),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::ResendLinkEmail,
                CreditRegistrationAdminActionTarget::Course,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;

    let mails = credit_registration_account_linking_emails::get_by_course_id_and_student_number(
        conn,
        payload.course_id,
        student_number,
    )
    .await?;
    let mails_sent_for_this_course = mails.len() as i64;
    let linking_emails = build_linking_emails(conn, mails).await?;

    token.authorized_ok(web::Json(AdminResendAccountLinkingEmailResult {
        outcome,
        retired_mail_count,
        linking_emails,
        mails_sent_for_this_course,
        max_mails_per_person_and_course: MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
        quiet_period_secs: LINKING_MAIL_QUIET_PERIOD_SECS,
    }))
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
        .map(|row| AccountLinkingStaleAddress {
            send_statuses: row
                .mail_ids
                .iter()
                .map(|id| {
                    reports
                        .get(id)
                        .map(|report| report.email_send_status)
                        .unwrap_or(EmailSendStatus::Queued)
                })
                .collect(),
            student_number: row.student_number,
            sisu_person_id: row.sisu_person_id,
            course_id: row.course_id,
            course_name: row.course_name,
            mail_count: row.mail_count,
            first_sent_at: row.first_sent_at,
            last_sent_at: row.last_sent_at,
            addresses: row.addresses,
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
            student_number: student_number.to_string(),
            sisu_person_id: sisu_person_id.to_string(),
            reason: reason.to_string(),
        }
    }

    #[test]
    fn a_manual_link_is_refused_without_a_preview_and_without_a_reason() {
        assert!(
            manual_link_request(&manual_link_payload(
                "Host bounces our mail.",
                "012345678",
                ""
            ))
            .is_err()
        );
        assert!(manual_link_request(&manual_link_payload("   ", "012345678", "hy-hlo-1")).is_err());
        assert!(manual_link_request(&manual_link_payload("", "012345678", "hy-hlo-1")).is_err());
        assert!(
            manual_link_request(&manual_link_payload(
                "Host bounces our mail.",
                "",
                "hy-hlo-1"
            ))
            .is_err()
        );
        let payload =
            manual_link_payload("  Host bounces our mail.  ", " 012345678 ", " hy-hlo-1 ");
        let allowed = manual_link_request(&payload)
            .expect("a reason, a number and a previewed person id are all there");
        assert_eq!(allowed.reason, "Host bounces our mail.");
        assert_eq!(allowed.student_number, "012345678");
        assert_eq!(allowed.previewed_person_id, "hy-hlo-1");
    }
}
