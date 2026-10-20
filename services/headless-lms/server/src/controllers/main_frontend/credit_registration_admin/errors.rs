//! The Needs attention tab, and the error codes the System tab shows.

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::credit_registration_admin_actions::{
    self, CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget,
    CreditRegistrationNote, GLOBAL_ADMIN_ROLE, NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_enrolment_routes::CreditRegistrationEnrolmentRoute;
use headless_lms_models::credit_registration_events::{self, ErrorCodeWindowCounts};
use headless_lms_models::credit_registrations::{
    self, AttentionDismissal, AttentionReason, AttentionRegistration, AttentionStanding,
    BlockingProblem, BlockingProblems, CreditRegistrationErrorCode, CreditRegistrationState,
    HandActionAvailability, ResubmissionStrictness, StuckThresholds,
};
use headless_lms_models::library::credit_registration::classification::{
    Retryability, retryability,
};
use headless_lms_models::library::credit_registration::timeline::{
    Engagement, TimelinePhase, TimelineStep, WaitsOn,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use utoipa::ToSchema;

use crate::domain::credit_registration::health::stuck_thresholds;
use crate::prelude::*;
use headless_lms_utils::secret_string::expose_option;

use super::{
    AdminManualLinkingEmailSend, attention_rules, authorize_credit_registration_admin,
    insert_admin_action_event, manual_linking_email_sends_by_registration, required_reason,
};

const RECENT_DISMISSAL_DAYS: i64 = 14;
const RECENT_DISMISSAL_LIMIT: i64 = 200;
const DEFAULT_ERROR_WINDOW_SECS: i64 = 24 * 60 * 60;
const MAX_ERROR_WINDOW_SECS: i64 = 90 * 24 * 60 * 60;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionItem {
    pub credit_registration_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// In full: this is the list support works from.
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub state: CreditRegistrationState,
    /// When the row entered its state; same-state checks do not move it.
    pub state_changed_at: DateTime<Utc>,
    pub phase_started_at: DateTime<Utc>,
    pub timeline_step: TimelineStep,
    pub phase: TimelinePhase,
    pub waits_on: WaitsOn,
    /// Only on the steps that wait on the student.
    pub engagement: Option<Engagement>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub attempt_count: i32,
    pub next_attempt_at: DateTime<Utc>,
    pub student_number: Option<String>,
    /// Every reason that picked this row.
    pub reasons: Vec<AttentionReason>,
    pub standing: AttentionStanding,
    /// Set exactly when `standing` is `explained_by_problem`.
    pub blocking_problem: Option<BlockingProblem>,
    /// The student's latest "I have enrolled" press.
    pub pressed_at: Option<DateTime<Utc>>,
    pub enrolment_route: Option<CreditRegistrationEnrolmentRoute>,
    /// When the code's latest enrolment list fetch that could send a linking email started.
    pub last_mailing_fetch_started_at: Option<DateTime<Utc>>,
    pub is_enrolment_list_empty: bool,
    /// The pipeline's own flag; a fact about the row, separate from any dismissal.
    pub needs_admin_attention: bool,
    /// What the bulk hand transition would allow on this row.
    pub hand_actions: HandActionAvailability,
    /// Linking emails sent by hand as a guess for this row's student, newest first.
    pub manual_linking_email_sends: Vec<AdminManualLinkingEmailSend>,
    /// Newest first.
    pub notes: Vec<CreditRegistrationNote>,
}

impl CreditRegistrationAttentionItem {
    /// Someone has already done something about the row that leaves it on the queue.
    fn is_reacted_to(&self) -> bool {
        !self.notes.is_empty() || !self.manual_linking_email_sends.is_empty()
    }
}

/// How many listed rows someone has reacted to, over the problem groups, the phases and running
/// late alike.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionReactionCounts {
    pub reacted_count: i64,
    pub not_reacted_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionReasonCount {
    pub reason: AttentionReason,
    pub count: i64,
}

/// One blocking problem and the rows it accounts for.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationBlockingProblemRows {
    pub problem: BlockingProblem,
    /// Every row the problem accounts for, oldest first.
    pub items: Vec<CreditRegistrationAttentionItem>,
}

/// The rows of one timeline phase that need attention.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionPhaseRows {
    pub phase: TimelinePhase,
    /// Every row of the phase matching the filters, in the requested order.
    pub items: Vec<CreditRegistrationAttentionItem>,
}

/// A dismissal made recently, for the "Dismissed recently" section.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionDismissal {
    pub credit_registration_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub dismissed_reasons: Vec<AttentionReason>,
    pub dismissed_at: DateTime<Utc>,
    pub dismissed_by_user_id: Uuid,
    pub dismissed_by_first_name: Option<String>,
    pub dismissed_by_last_name: Option<String>,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionItems {
    /// The Needs attention count, whatever this request filtered to: the tab badge, the same number
    /// `/overview` reports.
    pub total_count: i64,
    /// Over the whole Needs attention section, so the counts stay usable as facets.
    pub counts_by_reason: Vec<CreditRegistrationAttentionReasonCount>,
    /// The rows needing attention that match `reason`, one entry per timeline phase that has any,
    /// in timeline order.
    pub phases: Vec<CreditRegistrationAttentionPhaseRows>,
    /// Over a timing threshold with no person-level cause, oldest first. Not in the count.
    pub running_late: Vec<CreditRegistrationAttentionItem>,
    /// Rows a blocking problem accounts for, under that problem. Not in the count.
    pub explained_by_problem: Vec<CreditRegistrationBlockingProblemRows>,
    /// Dismissals of the last 14 days, newest first, whether or not the row has come back since.
    pub dismissed_recently: Vec<CreditRegistrationAttentionDismissal>,
    /// Before `reacted` narrows the rows, so both stay usable as facets.
    pub reaction_counts: CreditRegistrationAttentionReactionCounts,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminDismissAttentionPayload {
    pub reason: String,
}

/// The body of `POST /registrations/{credit_registration_id}/notes`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminAddCreditRegistrationNotePayload {
    pub note: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminDismissAttentionResult {
    /// The reasons the dismissal covers; a different one firing brings the row back.
    pub dismissed_reasons: Vec<AttentionReason>,
}

/// One error code over the chosen window and the one before it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationErrorCodeWindow {
    pub error_code: CreditRegistrationErrorCode,
    /// What may be done about the code, which is the difference between a wait and a fix.
    pub retryability: Retryability,
    /// Live rows carrying the code now: what the Registrations list filtered by `error_code`
    /// shows. The other counts are failure events in the window.
    pub live_count: i64,
    pub current_count: i64,
    pub previous_count: i64,
    pub user_count: i64,
    pub course_count: i64,
    pub first_seen_at: Option<DateTime<Utc>>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub endpoints: Vec<SuotarEndpoint>,
}

/// The verdicts an operator needs beside the errors to rule them out. `not_improved` is not a
/// failure and is never in the error table above.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationTerminalVerdicts {
    pub registered_count: i64,
    pub duplicate_and_not_improved_count: i64,
    pub failed_permanent_count: i64,
    pub cancelled_count: i64,
    /// The denominator of the success rate.
    pub total_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationErrorsByCode {
    pub window_secs: i64,
    pub codes: Vec<CreditRegistrationErrorCodeWindow>,
    pub verdicts: CreditRegistrationTerminalVerdicts,
}

#[derive(Debug, Deserialize)]
pub struct ErrorWindowQuery {
    window_secs: Option<i64>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/thresholds` - Every number the alert rules and
the stuck detectors use.

The same values `/overview` embeds in its health block. Separate so a tab explaining "stuck after
2 hours" can say so without reading the whole overview aggregate.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/thresholds",
    operation_id = "getCreditRegistrationThresholds",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "The thresholds every rule and detector shares", body = StuckThresholds)
    )
)]
pub async fn get_credit_registration_thresholds(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<StuckThresholds>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;
    token.authorized_ok(web::Json(stuck_thresholds()))
}

#[derive(Debug, Deserialize)]
pub struct AttentionQuery {
    reason: Option<Vec<AttentionReason>>,
    sort: Option<String>,
    reacted: Option<bool>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/attention` - The Needs attention tab: the rows
that need a person by timeline phase, and the rows running late, explained by a blocking problem or
recently dismissed.

Superseded attempts are outside every detector: acting on a replaced attempt is never right.
`total_count` is the one Needs attention count; `/overview`'s `needs_attention_count` is the same
number.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/attention",
    operation_id = "getCreditRegistrationAttentionItems",
    tag = "credit-registration-admin",
    params(
        ("reason" = Option<Vec<AttentionReason>>, Query, description = "Only rows carrying one of these reasons; repeat the parameter for several"),
        ("sort" = Option<String>, Query, description = "time_in_phase, next_attempt or course"),
        ("reacted" = Option<bool>, Query, description = "Only rows someone has, or has not, left a note on or sent a linking email for by hand; the counts cover every row")
    ),
    responses(
        (status = 200, description = "The Needs attention sections", body = CreditRegistrationAttentionItems)
    )
)]
pub async fn get_credit_registration_attention_items(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: MultiQuery<AttentionQuery>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<CreditRegistrationAttentionItems>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reasons: &[AttentionReason] = query.reason.as_deref().unwrap_or_default();
    let rules = attention_rules(&mut conn, &app_conf).await?;
    let rows = credit_registrations::get_attention_items(&mut conn, &rules, None).await?;
    let course_ids: Vec<Uuid> = rows
        .iter()
        .map(|row| row.course_id)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let mut sends = manual_linking_email_sends_by_registration(&mut conn, &course_ids).await?;
    let registration_ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let mut notes: HashMap<Uuid, Vec<CreditRegistrationNote>> = HashMap::new();
    for note in
        credit_registration_admin_actions::get_notes_by_registrations(&mut conn, &registration_ids)
            .await?
    {
        notes
            .entry(note.credit_registration_id)
            .or_default()
            .push(note);
    }
    let dismissed_recently = credit_registrations::get_dismissals_since(
        &mut conn,
        Utc::now() - chrono::Duration::days(RECENT_DISMISSAL_DAYS),
        RECENT_DISMISSAL_LIMIT,
    )
    .await?
    .into_iter()
    .map(to_dismissal)
    .collect();

    let mut needing: Vec<CreditRegistrationAttentionItem> = Vec::new();
    let mut running_late = Vec::new();
    let mut explained_by_problem: Vec<CreditRegistrationBlockingProblemRows> = Vec::new();
    let matches_reacted = |item: &CreditRegistrationAttentionItem| {
        query
            .reacted
            .is_none_or(|reacted| reacted == item.is_reacted_to())
    };
    let mut reaction_counts = CreditRegistrationAttentionReactionCounts {
        reacted_count: 0,
        not_reacted_count: 0,
    };
    for item in rows.into_iter().map(|row| {
        let row_sends = sends.remove(&row.id).unwrap_or_default();
        let row_notes = notes.remove(&row.id).unwrap_or_default();
        to_attention_item(row, &rules.blocking, row_sends, row_notes)
    }) {
        if item.standing != AttentionStanding::Dismissed {
            if item.is_reacted_to() {
                reaction_counts.reacted_count += 1;
            } else {
                reaction_counts.not_reacted_count += 1;
            }
        }
        // The tab badge and the reason facets count the whole queue, so needing rows are narrowed
        // only after counting.
        if item.standing != AttentionStanding::NeedsAttention && !matches_reacted(&item) {
            continue;
        }
        match item.standing {
            AttentionStanding::NeedsAttention => needing.push(item),
            AttentionStanding::RunningLate => running_late.push(item),
            AttentionStanding::ExplainedByProblem => {
                let Some(problem) = item.blocking_problem.clone() else {
                    continue;
                };
                match explained_by_problem
                    .iter_mut()
                    .find(|group| group.problem == problem)
                {
                    Some(group) => group.items.push(item),
                    None => explained_by_problem.push(CreditRegistrationBlockingProblemRows {
                        problem,
                        items: vec![item],
                    }),
                }
            }
            AttentionStanding::Dismissed => {}
        }
    }
    let mut reason_counts: BTreeMap<AttentionReason, i64> = BTreeMap::new();
    for reason in needing.iter().flat_map(|item| item.reasons.iter()) {
        *reason_counts.entry(*reason).or_insert(0) += 1;
    }
    let counts_by_reason = reason_counts
        .into_iter()
        .map(|(reason, count)| CreditRegistrationAttentionReasonCount { reason, count })
        .collect();
    let total_count = needing.len() as i64;

    let mut by_phase: BTreeMap<TimelinePhase, Vec<CreditRegistrationAttentionItem>> =
        BTreeMap::new();
    for item in needing.into_iter().filter(|item| {
        (reasons.is_empty() || item.reasons.iter().any(|reason| reasons.contains(reason)))
            && matches_reacted(item)
    }) {
        by_phase.entry(item.phase).or_default().push(item);
    }
    let phases = by_phase
        .into_iter()
        .map(|(phase, mut items)| {
            match query.sort.as_deref() {
                Some("next_attempt") => items.sort_by_key(|item| item.next_attempt_at),
                Some("course") => items.sort_by(|a, b| a.course_name.cmp(&b.course_name)),
                _ => items.sort_by_key(|item| item.phase_started_at),
            }
            CreditRegistrationAttentionPhaseRows { phase, items }
        })
        .collect();

    token.authorized_ok(web::Json(CreditRegistrationAttentionItems {
        total_count,
        counts_by_reason,
        phases,
        running_late,
        explained_by_problem,
        dismissed_recently,
        reaction_counts,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/registrations/{credit_registration_id}/dismiss-attention`
- Takes a row off the Needs attention queue.

The dismissal covers the reasons the row carries now; it comes back only when a different one
fires. Leaves the pipeline's own flag alone.
*/
#[instrument(skip(pool, payload, app_conf))]
#[utoipa::path(
    post,
    path = "/registrations/{credit_registration_id}/dismiss-attention",
    operation_id = "adminDismissCreditRegistrationAttention",
    tag = "credit-registration-admin",
    params(("credit_registration_id" = Uuid, Path, description = "Credit registration id")),
    request_body = AdminDismissAttentionPayload,
    responses(
        (status = 200, description = "The reasons dismissed", body = AdminDismissAttentionResult),
        (status = 400, description = "No reason given, or nothing picks the row"),
    )
)]
pub async fn admin_dismiss_credit_registration_attention(
    user: AuthUser,
    pool: web::Data<PgPool>,
    credit_registration_id: web::Path<Uuid>,
    payload: web::Json<AdminDismissAttentionPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<AdminDismissAttentionResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let id = *credit_registration_id;
    let rules = attention_rules(&mut conn, &app_conf).await?;
    let reasons = credit_registrations::get_attention_items(&mut conn, &rules, Some(&[id]))
        .await?
        .into_iter()
        .next()
        .map(|row| row.reasons)
        .unwrap_or_default();
    if reasons.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Nothing puts this registration on the Needs attention queue.".to_string()
        ));
    }

    let mut tx = conn.begin().await?;
    credit_registrations::dismiss_attention(&mut tx, id, &reasons, user.id, reason).await?;
    insert_admin_action_event(&mut tx, id, user.id, reason).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(id),
            reason: Some(reason.to_string()),
            details: Some(serde_json::json!({ "attention_reasons": reasons })),
            affected_row_count: Some(1),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::DismissAttention,
                CreditRegistrationAdminActionTarget::CreditRegistration,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminDismissAttentionResult {
        dismissed_reasons: reasons,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/registrations/{credit_registration_id}/notes`
- Leaves a note on a registration for whoever handles it next.

Changes nothing else: the row stays on the Needs attention queue, counted as reacted to.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/registrations/{credit_registration_id}/notes",
    operation_id = "adminAddCreditRegistrationNote",
    tag = "credit-registration-admin",
    params(("credit_registration_id" = Uuid, Path, description = "Credit registration id")),
    request_body = AdminAddCreditRegistrationNotePayload,
    responses(
        (status = 200, description = "The note was added"),
        (status = 400, description = "The note is empty"),
    )
)]
pub async fn admin_add_credit_registration_note(
    user: AuthUser,
    pool: web::Data<PgPool>,
    credit_registration_id: web::Path<Uuid>,
    payload: web::Json<AdminAddCreditRegistrationNotePayload>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let note = required_reason(&payload.note)?;
    let id = *credit_registration_id;
    // Refuses an unknown id with a 404 rather than an orphan audit row.
    credit_registrations::get_by_id(&mut conn, id).await?;

    let mut tx = conn.begin().await?;
    insert_admin_action_event(&mut tx, id, user.id, note).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(id),
            reason: Some(note.to_string()),
            affected_row_count: Some(1),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::AddNote,
                CreditRegistrationAdminActionTarget::CreditRegistration,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(()))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/errors/by-code` - Error events per code over a
window and the window before it, with the terminal verdicts of the same window beside them.

Counts events, not rows: an error that happened really happened, whether or not a later attempt
succeeded, and hiding it would hide the configuration bug that caused it.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/errors/by-code",
    operation_id = "getCreditRegistrationErrorsByCode",
    tag = "credit-registration-admin",
    params(("window_secs" = Option<i64>, Query, description = "Window length in seconds; the same length before it is the comparison")),
    responses(
        (status = 200, description = "Per-code counts and the window's verdicts", body = CreditRegistrationErrorsByCode)
    )
)]
pub async fn get_credit_registration_errors_by_code(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<ErrorWindowQuery>,
) -> ControllerResult<web::Json<CreditRegistrationErrorsByCode>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let window_secs = query
        .window_secs
        .unwrap_or(DEFAULT_ERROR_WINDOW_SECS)
        .clamp(60, MAX_ERROR_WINDOW_SECS);
    let live_counts = credit_registrations::count_by_error_code(&mut conn).await?;
    let codes =
        credit_registration_events::get_error_code_counts_for_window(&mut conn, window_secs)
            .await?
            .into_iter()
            .map(|row| {
                let live_count = live_counts
                    .iter()
                    .find(|live| live.error_code == row.error_code)
                    .map_or(0, |live| live.live_count);
                to_error_code_window(row, live_count)
            })
            .collect();
    let totals = credit_registrations::count_terminal_outcomes_since(
        &mut conn,
        Utc::now() - chrono::Duration::seconds(window_secs),
    )
    .await?;

    token.authorized_ok(web::Json(CreditRegistrationErrorsByCode {
        window_secs,
        codes,
        verdicts: CreditRegistrationTerminalVerdicts {
            registered_count: totals.registered_count,
            duplicate_and_not_improved_count: totals.success_count - totals.registered_count,
            failed_permanent_count: totals.failed_permanent_count,
            cancelled_count: totals.cancelled_count,
            total_count: totals.total_count,
        },
    }))
}

pub(super) fn to_attention_item(
    row: AttentionRegistration,
    problems: &BlockingProblems,
    manual_linking_email_sends: Vec<AdminManualLinkingEmailSend>,
    notes: Vec<CreditRegistrationNote>,
) -> CreditRegistrationAttentionItem {
    let position = row.position();
    let standing = row.standing(problems);
    let waits_on = WaitsOn::of(
        position.step,
        position.engagement,
        standing == AttentionStanding::NeedsAttention,
        row.needs_course_setup(),
    );
    CreditRegistrationAttentionItem {
        blocking_problem: (standing == AttentionStanding::ExplainedByProblem)
            .then(|| row.blocking_problem(problems))
            .flatten(),
        hand_actions: row
            .resubmission_facts()
            .hand_actions(ResubmissionStrictness::AnyExceptSubmissionUncertain),
        timeline_step: position.step,
        phase: position.step.phase(),
        engagement: position.engagement,
        waits_on,
        standing,
        credit_registration_id: row.id,
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        course_id: row.course_id,
        course_name: row.course_name,
        course_module_id: row.course_module_id,
        course_module_name: row.course_module_name,
        uh_course_code: row.uh_course_code,
        state: row.state,
        state_changed_at: row.state_changed_at,
        phase_started_at: row.phase_started_at,
        error_code: row.error_code,
        attempt_count: row.attempt_count,
        next_attempt_at: row.next_attempt_at,
        student_number: expose_option(&row.student_number).map(str::to_owned),
        reasons: row.reasons,
        pressed_at: row.pressed_at,
        enrolment_route: row.enrolment_route,
        last_mailing_fetch_started_at: row.last_mailing_fetch_started_at,
        is_enrolment_list_empty: row.is_enrolment_list_empty,
        needs_admin_attention: row.needs_admin_attention,
        manual_linking_email_sends,
        notes,
    }
}

fn to_dismissal(row: AttentionDismissal) -> CreditRegistrationAttentionDismissal {
    CreditRegistrationAttentionDismissal {
        credit_registration_id: row.credit_registration_id,
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        course_id: row.course_id,
        course_name: row.course_name,
        dismissed_reasons: row.dismissed_reasons,
        dismissed_at: row.dismissed_at,
        dismissed_by_user_id: row.dismissed_by_user_id,
        dismissed_by_first_name: row.dismissed_by_first_name,
        dismissed_by_last_name: row.dismissed_by_last_name,
        reason: row.reason,
    }
}

fn to_error_code_window(
    row: ErrorCodeWindowCounts,
    live_count: i64,
) -> CreditRegistrationErrorCodeWindow {
    CreditRegistrationErrorCodeWindow {
        live_count,
        retryability: retryability(row.error_code),
        error_code: row.error_code,
        current_count: row.current_count,
        previous_count: row.previous_count,
        user_count: row.user_count,
        course_count: row.course_count,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        endpoints: row.endpoints,
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/thresholds",
        web::get().to(get_credit_registration_thresholds),
    )
    .route(
        "/attention",
        web::get().to(get_credit_registration_attention_items),
    )
    .route(
        "/errors/by-code",
        web::get().to(get_credit_registration_errors_by_code),
    )
    .route(
        "/registrations/{credit_registration_id}/dismiss-attention",
        web::post().to(admin_dismiss_credit_registration_attention),
    )
    .route(
        "/registrations/{credit_registration_id}/notes",
        web::post().to(admin_add_credit_registration_note),
    );
}
