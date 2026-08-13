//! Per-phase heartbeat and control for the credit registration pipeline.
//!
//! One row per phase, seeded by migration and thereafter only ever updated.
use utoipa::ToSchema;

use crate::prelude::*;

/// Canonical phase names, used verbatim as the `phase` value, in the test tick endpoint, the
/// dashboard and the audit log.
pub const PHASES: &[&str] = &[
    "materialize",
    "preconditions",
    "resolve-enrolments",
    "import",
    "verify",
    "legacy-mirror",
    "student-notifications",
    "enrolment-discovery",
    "link-emails",
    "product-token-refresh",
    "config-validation",
    "retention-sweep",
];

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationPhaseState {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub phase: String,
    pub process_name: String,
    pub expected_interval_secs: i32,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    pub last_run_started_at: Option<DateTime<Utc>>,
    pub last_run_finished_at: Option<DateTime<Utc>>,
    pub last_success_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub items_processed_last_run: Option<i32>,
    pub items_failed_last_run: Option<i32>,
    pub consecutive_failures: i32,
    pub last_error: Option<String>,
    pub paused_at: Option<DateTime<Utc>>,
    pub paused_by_user_id: Option<Uuid>,
    pub pause_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct PhaseRunOutcome {
    pub items_processed: i32,
    pub items_failed: i32,
    /// `None` on success. Scrub before passing.
    pub error: Option<String>,
}

impl PhaseRunOutcome {
    /// A clean iteration that moved `count` rows; saturating, so an over-large sweep never reaches
    /// the dashboard as negative throughput.
    pub fn processed(count: i64) -> Self {
        Self {
            items_processed: count.try_into().unwrap_or(i32::MAX),
            items_failed: 0,
            error: None,
        }
    }
}

pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<CreditRegistrationPhaseState>> {
    let res = sqlx::query_as!(
        CreditRegistrationPhaseState,
        r#"
SELECT *
FROM credit_registration_phase_state
WHERE deleted_at IS NULL
ORDER BY process_name,
  phase
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_phase(
    conn: &mut PgConnection,
    phase: &str,
) -> ModelResult<CreditRegistrationPhaseState> {
    let res = sqlx::query_as!(
        CreditRegistrationPhaseState,
        r#"
SELECT *
FROM credit_registration_phase_state
WHERE phase = $1
  AND deleted_at IS NULL
        "#,
        phase
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Written every iteration, work or not, so idle and wedged stay distinguishable.
pub async fn heartbeat(conn: &mut PgConnection, phase: &str) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_phase_state
SET last_heartbeat_at = now(),
  last_run_started_at = now()
WHERE phase = $1
  AND deleted_at IS NULL
        "#,
        phase
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Closes out an iteration. Only a success moves `last_success_at`, so a wedged phase stays
/// distinguishable from a quiet one.
pub async fn record_run(
    conn: &mut PgConnection,
    phase: &str,
    outcome: &PhaseRunOutcome,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_phase_state
SET last_run_finished_at = now(),
  items_processed_last_run = $2,
  items_failed_last_run = $3,
  last_success_at = CASE
    WHEN $4::text IS NULL THEN now()
    ELSE last_success_at
  END,
  consecutive_failures = CASE
    WHEN $4::text IS NULL THEN 0
    ELSE consecutive_failures + 1
  END,
  last_error = $4
WHERE phase = $1
  AND deleted_at IS NULL
        "#,
        phase,
        outcome.items_processed,
        outcome.items_failed,
        outcome.error,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn is_paused(conn: &mut PgConnection, phase: &str) -> ModelResult<bool> {
    let paused = sqlx::query_scalar!(
        r#"
SELECT paused_at IS NOT NULL AS "paused!"
FROM credit_registration_phase_state
WHERE phase = $1
  AND deleted_at IS NULL
        "#,
        phase
    )
    .fetch_one(conn)
    .await?;
    Ok(paused)
}

pub async fn pause(
    conn: &mut PgConnection,
    phase: &str,
    paused_by_user_id: Uuid,
    pause_reason: Option<&str>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_phase_state
SET paused_at = now(),
  paused_by_user_id = $2,
  pause_reason = $3
WHERE phase = $1
  AND deleted_at IS NULL
        "#,
        phase,
        paused_by_user_id,
        pause_reason,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn resume(conn: &mut PgConnection, phase: &str) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_phase_state
SET paused_at = NULL,
  paused_by_user_id = NULL,
  pause_reason = NULL
WHERE phase = $1
  AND deleted_at IS NULL
        "#,
        phase
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Makes the phase due now; the phase loop picks it up on its next `next_run_at` check.
pub async fn run_now(conn: &mut PgConnection, phase: &str) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_phase_state
SET next_run_at = now()
WHERE phase = $1
  AND deleted_at IS NULL
        "#,
        phase
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_next_run_at(
    conn: &mut PgConnection,
    phase: &str,
    next_run_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_phase_state
SET next_run_at = $2
WHERE phase = $1
  AND deleted_at IS NULL
        "#,
        phase,
        next_run_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}
