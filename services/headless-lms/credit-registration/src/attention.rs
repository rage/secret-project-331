//! The blocking problems the Needs attention queue attributes rows to, read the way the alert
//! rules read them.

use chrono::{DateTime, Utc};
use headless_lms_models::credit_registrations::{
    AttentionRules, BlockingProblems, StoppedPhase, StuckThresholds,
};
use headless_lms_models::{
    ModelResult, course_module_suotar_configurations, credit_registration_phase_state,
    credit_registration_roster_schedules,
};
use sqlx::PgConnection;

use crate::CreditRegistrationPhase;

/// A phase is late once this many of its own intervals have passed without a heartbeat.
pub const PHASE_HEARTBEAT_INTERVAL_MULTIPLIER: i32 = 2;

/// Whether a phase's last heartbeat is older than [`PHASE_HEARTBEAT_INTERVAL_MULTIPLIER`] of its
/// intervals. A paused phase is never late.
pub fn is_heartbeat_late(
    last_heartbeat_at: Option<DateTime<Utc>>,
    expected_interval_secs: i32,
    paused_at: Option<DateTime<Utc>>,
    now: DateTime<Utc>,
) -> bool {
    paused_at.is_none()
        && last_heartbeat_at.is_some_and(|at| {
            (now - at).num_seconds()
                > i64::from(expected_interval_secs) * i64::from(PHASE_HEARTBEAT_INTERVAL_MULTIPLIER)
        })
}

/// The rules every Needs attention count is taken under: the shared thresholds, and the blocking
/// problems as they stand now.
pub async fn attention_rules(
    conn: &mut PgConnection,
    account_linking_since: Option<DateTime<Utc>>,
) -> ModelResult<AttentionRules> {
    let now = Utc::now();
    let stopped_phases = credit_registration_phase_state::get_all(conn)
        .await?
        .into_iter()
        .filter(|row| {
            row.paused_at.is_some()
                || is_heartbeat_late(
                    row.last_heartbeat_at,
                    row.expected_interval_secs,
                    row.paused_at,
                    now,
                )
        })
        .filter_map(|row| {
            let phase = CreditRegistrationPhase::from_phase_name(&row.phase)?;
            Some(StoppedPhase {
                phase: row.phase,
                owned_states: phase.owned_states().to_vec(),
                sends_linking_emails: matches!(
                    phase,
                    CreditRegistrationPhase::EnrolmentDiscovery
                        | CreditRegistrationPhase::LinkEmails
                ),
            })
        })
        .collect();
    let failing_course_codes = credit_registration_roster_schedules::get_failing_codes(conn)
        .await?
        .into_iter()
        .map(|code| code.course_code)
        .collect();
    let misconfigured_module_ids =
        course_module_suotar_configurations::get_module_ids_failing_config_check(conn).await?;
    Ok(AttentionRules {
        thresholds: StuckThresholds::CURRENT,
        account_linking_since,
        blocking: BlockingProblems {
            stopped_phases,
            failing_course_codes,
            misconfigured_module_ids,
        },
    })
}
