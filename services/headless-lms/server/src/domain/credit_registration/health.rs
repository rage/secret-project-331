//! The alert rules the credit registration dashboard renders.
//!
//! Evaluated server-side and in one place, so the same verdict can later feed an external monitor
//! without a second implementation. Every rule is a single aggregate over indexed columns, because
//! the banner is polled.
//!
//! An alert carries identifiers and numbers, never prose: the study registry's own error text is
//! written for an integrator and is not translated, so the frontend renders one key per alert id
//! with these values interpolated. The thresholds travel with the alerts so no number is hardcoded
//! twice.

use headless_lms_models::credit_registrations::StuckThresholds;
use headless_lms_models::{ModelResult, prelude::*};
use headless_lms_models::{
    credit_registration_account_linking_emails, credit_registration_phase_state,
    credit_registrations, suotar_api_calls,
};
use utoipa::ToSchema;

use crate::domain::system_health::HealthStatus;

/// Within this much of the past, one rejected credential is enough.
const CREDENTIAL_REJECTION_WINDOW_SECS: i64 = 60 * 60;
const UNREACHABLE_WINDOW_SECS: i64 = 15 * 60;
/// Below this the run is a bad minute rather than an outage.
const UNREACHABLE_CONSECUTIVE_FAILURES: i64 = 3;
const STUCK_THRESHOLDS: StuckThresholds = StuckThresholds {
    ready_to_submit_secs: 2 * 60 * 60,
    submitting_secs: 15 * 60,
    awaiting_verification_secs: 24 * 60 * 60,
    failed_retryable_secs: 3 * 24 * 60 * 60,
};
/// Above this many stuck rows the backlog stops being something to look at tomorrow.
const STUCK_CRITICAL_COUNT: i64 = 50;
const LINKING_MAIL_WINDOW_SECS: i64 = 7 * 24 * 60 * 60;
/// A phase is late once this many of its own intervals have passed without a heartbeat.
///
/// `pub(crate)`: the admin dashboard's phase rows apply this same threshold server-side, so a
/// client's clock cannot desync the verdict from the one this module's own alert reaches.
pub(crate) const PHASE_HEARTBEAT_INTERVAL_MULTIPLIER: i32 = 2;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationAlertId {
    CredentialsRejected,
    StudyRegistryUnreachable,
    StuckRegistrations,
    LinkingMailSendFailed,
    PhaseHeartbeatStale,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationAlertSeverity {
    Warning,
    Critical,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAlert {
    pub id: CreditRegistrationAlertId,
    pub severity: CreditRegistrationAlertSeverity,
    /// How many rows, calls or phases the rule found.
    pub count: i64,
    /// When it last happened, where the rule has an instant to point at.
    pub at: Option<DateTime<Utc>>,
    /// An identifier the operator can act on — a phase name, a ledger state, a mail domain. Never a
    /// sentence, and never anything the study registry wrote.
    pub subject: Option<String>,
}

/// Every number the rules used, so the UI can say "N of M" without holding a copy of M.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAlertThresholds {
    pub credential_rejection_window_secs: i64,
    pub unreachable_window_secs: i64,
    pub unreachable_consecutive_failures: i64,
    pub stuck_ready_to_submit_secs: i64,
    pub stuck_submitting_secs: i64,
    pub stuck_awaiting_verification_secs: i64,
    pub stuck_failed_retryable_secs: i64,
    pub stuck_critical_count: i64,
    pub linking_mail_window_secs: i64,
    pub phase_heartbeat_interval_multiplier: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationHealth {
    pub status: HealthStatus,
    /// Critical first, and a rejected credential first of all: nothing else can register until it is
    /// fixed.
    pub alerts: Vec<CreditRegistrationAlert>,
    pub thresholds: CreditRegistrationAlertThresholds,
}

pub fn thresholds() -> CreditRegistrationAlertThresholds {
    CreditRegistrationAlertThresholds {
        credential_rejection_window_secs: CREDENTIAL_REJECTION_WINDOW_SECS,
        unreachable_window_secs: UNREACHABLE_WINDOW_SECS,
        unreachable_consecutive_failures: UNREACHABLE_CONSECUTIVE_FAILURES,
        stuck_ready_to_submit_secs: STUCK_THRESHOLDS.ready_to_submit_secs,
        stuck_submitting_secs: STUCK_THRESHOLDS.submitting_secs,
        stuck_awaiting_verification_secs: STUCK_THRESHOLDS.awaiting_verification_secs,
        stuck_failed_retryable_secs: STUCK_THRESHOLDS.failed_retryable_secs,
        stuck_critical_count: STUCK_CRITICAL_COUNT,
        linking_mail_window_secs: LINKING_MAIL_WINDOW_SECS,
        phase_heartbeat_interval_multiplier: PHASE_HEARTBEAT_INTERVAL_MULTIPLIER,
    }
}

pub fn stuck_thresholds() -> StuckThresholds {
    STUCK_THRESHOLDS
}

/// Runs every rule and ranks what it found.
pub async fn evaluate(conn: &mut PgConnection) -> ModelResult<CreditRegistrationHealth> {
    let now = Utc::now();
    let mut alerts = Vec::new();

    let credentials = suotar_api_calls::count_credential_rejections_since(
        conn,
        now - chrono::Duration::seconds(CREDENTIAL_REJECTION_WINDOW_SECS),
    )
    .await?;
    if credentials.count > 0 {
        alerts.push(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::CredentialsRejected,
            severity: CreditRegistrationAlertSeverity::Critical,
            count: credentials.count,
            at: credentials.last_at,
            subject: None,
        });
    }

    let unreachable = suotar_api_calls::count_unreachable_run_since(
        conn,
        now - chrono::Duration::seconds(UNREACHABLE_WINDOW_SECS),
    )
    .await?;
    if unreachable.count >= UNREACHABLE_CONSECUTIVE_FAILURES {
        alerts.push(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::StudyRegistryUnreachable,
            severity: CreditRegistrationAlertSeverity::Critical,
            count: unreachable.count,
            at: unreachable.last_at,
            subject: None,
        });
    }

    if let Some(alert) = stuck_alert(conn).await? {
        alerts.push(alert);
    }
    if let Some(alert) = linking_mail_alert(conn, now).await? {
        alerts.push(alert);
    }
    if let Some(alert) = phase_heartbeat_alert(conn, now).await? {
        alerts.push(alert);
    }

    alerts.sort_by_key(|alert| {
        (
            std::cmp::Reverse(alert.severity),
            alert.id != CreditRegistrationAlertId::CredentialsRejected,
        )
    });
    let status = match alerts.iter().map(|alert| alert.severity).max() {
        Some(CreditRegistrationAlertSeverity::Critical) => HealthStatus::Error,
        Some(CreditRegistrationAlertSeverity::Warning) => HealthStatus::Warning,
        None => HealthStatus::Healthy,
    };

    Ok(CreditRegistrationHealth {
        status,
        alerts,
        thresholds: thresholds(),
    })
}

/// Rows the pipeline should have moved on by now. `abandoned_by_consent_withdrawal` is terminal, so
/// it is outside this by construction rather than by a filter that could be forgotten.
async fn stuck_alert(conn: &mut PgConnection) -> ModelResult<Option<CreditRegistrationAlert>> {
    let stuck = credit_registrations::count_stuck(conn, &STUCK_THRESHOLDS).await?;
    let total: i64 = stuck.iter().map(|row| row.count).sum();
    if total == 0 {
        return Ok(None);
    }
    let severe: i64 = stuck.iter().map(|row| row.severely_stuck_count).sum();
    let worst = stuck.iter().max_by_key(|row| row.count);
    let severity = if total > STUCK_CRITICAL_COUNT || severe > 0 {
        CreditRegistrationAlertSeverity::Critical
    } else {
        CreditRegistrationAlertSeverity::Warning
    };
    Ok(Some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::StuckRegistrations,
        severity,
        count: total,
        at: worst.and_then(|row| row.oldest_state_entered_at),
        subject: worst.map(|row| state_name(row.state)),
    }))
}

/// Linking mails we could not hand over at all. The recipient domain rides along because an
/// undeliverable host is the usual cause and the cue to expect manual-link requests.
async fn linking_mail_alert(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
) -> ModelResult<Option<CreditRegistrationAlert>> {
    let since = now - chrono::Duration::seconds(LINKING_MAIL_WINDOW_SECS);
    let totals =
        credit_registration_account_linking_emails::get_send_status_totals_since(conn, since, now)
            .await?;
    if totals.send_failed == 0 {
        return Ok(None);
    }
    let top_domain = credit_registration_account_linking_emails::get_send_failure_domains_since(
        conn, since, now,
    )
    .await?
    .into_iter()
    .next()
    .map(|row| row.domain);
    Ok(Some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::LinkingMailSendFailed,
        severity: CreditRegistrationAlertSeverity::Warning,
        count: totals.send_failed,
        at: totals.last_send_failed_at,
        subject: top_domain,
    }))
}

/// A phase that reported and then stopped.
///
/// Deliberately not "has never reported": three of the twelve phases have no implementation yet and
/// so never heartbeat, and a freshly migrated database has no heartbeats at all. Alerting on those
/// would make the banner permanently red and worth nothing. A never-reported phase is visible as
/// such on the Overview's phase list instead.
async fn phase_heartbeat_alert(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
) -> ModelResult<Option<CreditRegistrationAlert>> {
    let phases = credit_registration_phase_state::get_all(conn).await?;
    let mut stale: Vec<&str> = Vec::new();
    for phase in &phases {
        if phase.paused_at.is_some() {
            continue;
        }
        let Some(last_heartbeat_at) = phase.last_heartbeat_at else {
            continue;
        };
        let allowed = i64::from(phase.expected_interval_secs)
            * i64::from(PHASE_HEARTBEAT_INTERVAL_MULTIPLIER);
        if (now - last_heartbeat_at).num_seconds() > allowed {
            stale.push(&phase.phase);
        }
    }
    if stale.is_empty() {
        return Ok(None);
    }
    Ok(Some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::PhaseHeartbeatStale,
        severity: CreditRegistrationAlertSeverity::Critical,
        count: stale.len() as i64,
        at: None,
        subject: stale.first().map(|phase| (*phase).to_string()),
    }))
}

/// The state's own wire name, taken from its serialisation so the two cannot drift.
fn state_name(state: credit_registrations::CreditRegistrationState) -> String {
    serde_json::to_value(state)
        .ok()
        .and_then(|value| value.as_str().map(str::to_string))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use headless_lms_models::credit_registrations::CreditRegistrationState;

    /// The alert's `subject` is an identifier an operator pastes into a message to the registry, so
    /// it has to be the same spelling the ledger and the filters use.
    #[test]
    fn a_state_names_itself_the_way_the_wire_does() {
        assert_eq!(
            state_name(CreditRegistrationState::AwaitingVerification),
            "awaiting_verification"
        );
        for state in CreditRegistrationState::ALL {
            assert!(!state_name(state).is_empty());
        }
    }
}
