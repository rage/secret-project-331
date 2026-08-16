//! The Reconciliation tab: the failures defined by an absence, which no error count can catch.

use headless_lms_models::credit_registration_events;
use headless_lms_models::credit_registrations::{
    self, AdminCreditRegistration, AdminCreditRegistrationFilters, AdminCreditRegistrationSort,
    CreditRegistrationState,
};
use headless_lms_models::library::credit_registration::legacy_mirror::{
    self, LegacyLedgerDivergence,
};
use headless_lms_models::library::credit_registration::materialize::{
    UnmaterialisedCompletion, get_unmaterialised_eligible_completions,
};
use utoipa::ToSchema;

use crate::prelude::*;

use super::authorize_credit_registration_admin;

/// Rows per detector. These are heavy queries and every list here is meant to be worked through,
/// not scrolled.
const DETECTOR_LIMIT: i64 = 200;
/// A completion younger than this is simply waiting for the next `materialize` tick.
const NEVER_ENTERED_MIN_AGE_SECS: i64 = 60 * 60;

/// A completion that satisfies the materialise predicate and has no ledger row.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct NeverEnteredCompletion {
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub completion_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    /// The student has no enrolment on the course, so `materialize` has no course instance to put
    /// on a ledger row. The one cause running the phase again will not fix.
    pub missing_enrolment: bool,
}

/// One ledger row, flattened to what every reconciliation list needs to name a student and link
/// onwards.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ReconciliationRegistration {
    pub credit_registration_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub student_number: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub submitted_attainment_id: Option<String>,
    pub sisu_attainment_id: Option<String>,
    pub registered_at: Option<DateTime<Utc>>,
    pub terminal_at: Option<DateTime<Utc>>,
}

/// A ledger row the legacy study-registry ledger contradicts.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct LegacyLedgerDivergenceRow {
    pub credit_registration_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    /// We registered it and the legacy ledger has no row of ours, so the teacher views and the pull
    /// stream still call the completion unregistered.
    pub mirror_missing: bool,
    /// A registrar took the completion through the pull path while our pipeline had not finished
    /// with it: the shape a double registration would have.
    pub registered_by_a_registrar: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationReconciliation {
    /// Eligible completions with no ledger row at all.
    pub never_entered: Vec<NeverEnteredCompletion>,
    /// `submission_uncertain`: the import may or may not have landed. Verify these, never resubmit.
    pub outcome_uncertain: Vec<ReconciliationRegistration>,
    /// Rows whose answers named more than one submitted attainment id, which is what a double
    /// submission would look like.
    pub several_submitted_attainments: Vec<ReconciliationRegistration>,
    /// Attainments the study registry reversed after we had recorded them as registered.
    pub misregistered: Vec<ReconciliationRegistration>,
    pub legacy_divergences: Vec<LegacyLedgerDivergenceRow>,
    /// **Not an error list and not a work queue.** These students withdrew consent while a
    /// registration was in flight, so we stopped polling and do not know what the registry did. It
    /// is here so the number is never mistaken for a failure; it is in no count above and in no
    /// alert.
    pub outcome_unknown_consent_withdrawn: Vec<ReconciliationRegistration>,
    /// The detectors' counts, in the same order as the lists, capped at `max_rows_per_detector`.
    pub never_entered_count: i64,
    pub outcome_uncertain_count: i64,
    pub several_submitted_attainments_count: i64,
    pub misregistered_count: i64,
    pub legacy_divergence_count: i64,
    pub outcome_unknown_consent_withdrawn_count: i64,
    /// The four detector counts, which is the tab badge. The consent-withdrawal bucket is
    /// deliberately outside it.
    pub finding_count: i64,
    pub max_rows_per_detector: i64,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/reconciliation` - The drift detectors: work the
ledger should be doing and is not, and outcomes the study registry and the ledger disagree about.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/reconciliation",
    operation_id = "getCreditRegistrationReconciliation",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "Every detector's findings and counts", body = CreditRegistrationReconciliation)
    )
)]
pub async fn get_credit_registration_reconciliation(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CreditRegistrationReconciliation>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let never_entered: Vec<NeverEnteredCompletion> = get_unmaterialised_eligible_completions(
        &mut conn,
        NEVER_ENTERED_MIN_AGE_SECS,
        DETECTOR_LIMIT,
    )
    .await?
    .into_iter()
    .map(to_never_entered)
    .collect();

    let outcome_uncertain =
        rows_in_state(&mut conn, CreditRegistrationState::SubmissionUncertain).await?;
    let misregistered = rows_in_state(&mut conn, CreditRegistrationState::Misregistered).await?;
    let outcome_unknown_consent_withdrawn = rows_in_state(
        &mut conn,
        CreditRegistrationState::AbandonedByConsentWithdrawal,
    )
    .await?;

    let several_ids = credit_registration_events::get_ids_with_several_submitted_attainments(
        &mut conn,
        DETECTOR_LIMIT,
    )
    .await?;
    let several_submitted_attainments = rows_by_ids(&mut conn, &several_ids).await?;

    let legacy_divergences: Vec<LegacyLedgerDivergenceRow> =
        legacy_mirror::get_legacy_ledger_divergences(&mut conn, DETECTOR_LIMIT)
            .await?
            .into_iter()
            .map(to_legacy_divergence)
            .collect();

    let never_entered_count = never_entered.len() as i64;
    let outcome_uncertain_count = outcome_uncertain.len() as i64;
    let several_submitted_attainments_count = several_submitted_attainments.len() as i64;
    let misregistered_count = misregistered.len() as i64;
    let legacy_divergence_count = legacy_divergences.len() as i64;

    token.authorized_ok(web::Json(CreditRegistrationReconciliation {
        outcome_unknown_consent_withdrawn_count: outcome_unknown_consent_withdrawn.len() as i64,
        finding_count: never_entered_count
            + outcome_uncertain_count
            + several_submitted_attainments_count
            + misregistered_count
            + legacy_divergence_count,
        never_entered,
        outcome_uncertain,
        several_submitted_attainments,
        misregistered,
        legacy_divergences,
        outcome_unknown_consent_withdrawn,
        never_entered_count,
        outcome_uncertain_count,
        several_submitted_attainments_count,
        misregistered_count,
        legacy_divergence_count,
        max_rows_per_detector: DETECTOR_LIMIT,
    }))
}

async fn rows_in_state(
    conn: &mut PgConnection,
    state: CreditRegistrationState,
) -> Result<Vec<ReconciliationRegistration>, ControllerError> {
    let ids: Vec<Uuid> = credit_registrations::get_live_by_state(conn, state, DETECTOR_LIMIT)
        .await?
        .into_iter()
        .map(|row| row.id)
        .collect();
    rows_by_ids(conn, &ids).await
}

/// Reads the same admin projection the explorer uses, so a name, a course and a student number are
/// spelled identically wherever the dashboard shows them.
async fn rows_by_ids(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> Result<Vec<ReconciliationRegistration>, ControllerError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    Ok(credit_registrations::get_admin_facing(
        conn,
        &AdminCreditRegistrationFilters {
            credit_registration_ids: Some(ids),
            include_superseded: true,
            ..AdminCreditRegistrationFilters::default()
        },
        AdminCreditRegistrationSort::TimeInState,
        DETECTOR_LIMIT,
        0,
    )
    .await?
    .into_iter()
    .map(to_reconciliation_row)
    .collect())
}

fn to_never_entered(row: UnmaterialisedCompletion) -> NeverEnteredCompletion {
    NeverEnteredCompletion {
        course_module_completion_id: row.course_module_completion_id,
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        course_id: row.course_id,
        course_name: row.course_name,
        course_module_id: row.course_module_id,
        course_module_name: row.course_module_name,
        completion_date: row.completion_date,
        created_at: row.created_at,
        missing_enrolment: row.missing_enrolment,
    }
}

fn to_reconciliation_row(row: AdminCreditRegistration) -> ReconciliationRegistration {
    ReconciliationRegistration {
        credit_registration_id: row.id,
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        student_number: row.student_number,
        course_id: row.course_id,
        course_name: row.course_name,
        course_module_id: row.course_module_id,
        course_module_name: row.course_module_name,
        uh_course_code: row.uh_course_code,
        state: row.state,
        state_entered_at: row.state_entered_at,
        submitted_at: row.submitted_at,
        submitted_attainment_id: row.submitted_attainment_id,
        sisu_attainment_id: row.sisu_attainment_id,
        registered_at: row.registered_at,
        terminal_at: row.terminal_at,
    }
}

fn to_legacy_divergence(row: LegacyLedgerDivergence) -> LegacyLedgerDivergenceRow {
    LegacyLedgerDivergenceRow {
        credit_registration_id: row.credit_registration_id,
        course_module_completion_id: row.course_module_completion_id,
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        course_id: row.course_id,
        course_name: row.course_name,
        course_module_id: row.course_module_id,
        state: row.state,
        state_entered_at: row.state_entered_at,
        mirror_missing: row.mirror_missing,
        registered_by_a_registrar: row.registered_by_a_registrar,
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/reconciliation",
        web::get().to(get_credit_registration_reconciliation),
    );
}
