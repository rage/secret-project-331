//! The alert rules the credit registration dashboard renders.
//!
//! An alert carries identifiers and numbers, never prose: the study registry's own error text is
//! written for an integrator and is not translated, so the frontend renders one key per alert id
//! with these values interpolated. The thresholds travel with the alerts, not hardcoded twice.

use headless_lms_models::credit_registrations::{
    CreditRegistrationState, StuckRegistrationCount, StuckThresholds,
};
use headless_lms_models::library::credit_registration::materialize::get_unmaterialised_eligible_completions;
use headless_lms_models::{ModelResult, prelude::*};
use headless_lms_models::{
    course_module_suotar_configurations, course_module_suotar_realisations,
    credit_registration_account_linking_emails, credit_registration_events,
    credit_registration_phase_state, credit_registrations, suotar_api_calls,
};
use utoipa::ToSchema;

use crate::domain::system_health::HealthStatus;

/// Within this much of the past, one rejected credential is enough.
const CREDENTIAL_REJECTION_WINDOW_SECS: i64 = 60 * 60;
const UNREACHABLE_WINDOW_SECS: i64 = 15 * 60;
/// Below this the run is a bad minute rather than an outage.
const UNREACHABLE_CONSECUTIVE_FAILURES: i64 = 3;
const SISU_OUTAGE_WINDOW_SECS: i64 = 15 * 60;
/// Below this many items the share below is one bad batch, not a signal.
const SISU_OUTAGE_MIN_ITEMS: i64 = 10;
const SISU_OUTAGE_FAILURE_SHARE_PERCENT: i64 = 30;
const STUCK_THRESHOLDS: StuckThresholds = StuckThresholds {
    stuck_ready_to_submit_secs: 2 * 60 * 60,
    stuck_submitting_secs: 15 * 60,
    stuck_awaiting_verification_secs: 24 * 60 * 60,
    stuck_failed_retryable_secs: 3 * 24 * 60 * 60,
};

const _: () = assert!(
    STUCK_THRESHOLDS.stuck_failed_retryable_secs
        < headless_lms_models::library::credit_registration::backoff::SUBMIT_MAX_RETRY_AGE_SECS,
    "a row must be considered stuck before backoff gives up retrying it"
);
const _: () = assert!(
    STUCK_THRESHOLDS.stuck_submitting_secs
        > headless_lms_models::library::credit_registration::backoff::SUBMITTING_RECOVERY_GRACE_SECS,
    "the stuck threshold must outlast the grace period that lets a submit recover on its own"
);
/// Above this many stuck rows the backlog stops being something to look at tomorrow.
const STUCK_CRITICAL_COUNT: i64 = 50;
const LINKING_MAIL_WINDOW_SECS: i64 = 7 * 24 * 60 * 60;
/// A phase is late once this many of its own intervals have passed without a heartbeat.
/// `pub(crate)` because the dashboard's phase rows apply the same threshold server-side.
pub(crate) const PHASE_HEARTBEAT_INTERVAL_MULTIPLIER: i32 = 2;
/// Failures in a row before a phase counts as broken rather than unlucky.
pub(crate) const PHASE_CONSECUTIVE_FAILURE_LIMIT: i32 = 5;
/// A phase that owns a nonempty queue and has not succeeded within this many of its own intervals
/// is running without getting anywhere, which no failure count catches.
const PHASE_SUCCESS_INTERVAL_MULTIPLIER: i32 = 10;
/// The window every "in the last day" rule shares.
const TERMINAL_WINDOW_SECS: i64 = 24 * 60 * 60;
const PERMANENT_FAILURE_COUNT: i64 = 20;
const PERMANENT_FAILURE_RATE_PERCENT: i64 = 10;
/// A reversal is always worth saying; this many at once is an incident.
const MISREGISTRATION_CRITICAL_COUNT: i64 = 5;
/// Linking mails one hour may hand over before the volume itself is the problem.
const LINKING_MAIL_HOURLY_CAP: i64 = 500;
/// Queued work that makes a day without a single completion mean something.
const IDLE_QUEUE_DEPTH: i64 = 20;
/// How long a completion may sit outside the ledger before `materialize` is the suspect rather
/// than the clock.
const NEVER_ENTERED_MIN_AGE_SECS: i64 = 6 * 60 * 60;
/// Bounds the anti-join behind that rule; a bigger backlog reports as this many.
const NEVER_ENTERED_SAMPLE_LIMIT: i64 = 100;
const LATENCY_WINDOW_SECS: i64 = 7 * 24 * 60 * 60;
/// Under this the registry is quick enough that a doubling says nothing.
const LATENCY_REGRESSION_FLOOR_SECS: i64 = 6 * 60 * 60;
const LATENCY_REGRESSION_FACTOR: i64 = 2;
/// One person the registry names differently from the account whose address matched is worth a
/// look: it is the only signal we get that a university address was reissued.
const FAST_TRACK_NAME_MISMATCH_COUNT: i64 = 1;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationAlertId {
    CredentialsRejected,
    StudyRegistryUnreachable,
    SisuUnavailable,
    StuckRegistrations,
    LinkingMailSendFailed,
    LinkingMailRateCapExceeded,
    PhaseHeartbeatStale,
    PhaseFailing,
    PermanentFailuresAccumulating,
    MisregistrationsDetected,
    CourseConfigurationBroken,
    PipelineIdle,
    CompletionsNeverEntered,
    ConfirmationLatencyRegressed,
    FastTrackNameMismatch,
    PipelinePausedGlobally,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationAlertSeverity {
    /// Worth knowing, not worth acting on. Never makes the overall status anything but healthy.
    Info,
    Warning,
    Critical,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAlert {
    pub id: CreditRegistrationAlertId,
    pub severity: CreditRegistrationAlertSeverity,
    /// How many rows, calls or phases the rule found.
    pub count: i64,
    /// What `count` is out of, where the rule measured one. Not a threshold: thresholds are the
    /// same for every evaluation and travel separately.
    pub total: Option<i64>,
    /// When it last happened, where the rule has an instant to point at.
    pub at: Option<DateTime<Utc>>,
    /// An identifier the operator can act on — a phase name, a ledger state, a mail domain. Never a
    /// sentence, and never anything the study registry wrote.
    pub subject: Option<String>,
}

/// The only thresholds the frontend reads off the health poll: how long a row may sit in each
/// state before it counts as stuck. The other rule constants stay server-side.
pub type CreditRegistrationAlertThresholds = StuckThresholds;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationHealth {
    pub status: HealthStatus,
    /// Critical first, and a rejected credential first of all: nothing registers until it is fixed.
    pub alerts: Vec<CreditRegistrationAlert>,
    pub thresholds: CreditRegistrationAlertThresholds,
}

/// Alias for [`stuck_thresholds`]: the same values, named for the health-poll wire response.
pub fn thresholds() -> CreditRegistrationAlertThresholds {
    stuck_thresholds()
}

pub fn stuck_thresholds() -> StuckThresholds {
    STUCK_THRESHOLDS
}

/// A phase counts as late once more than [`PHASE_HEARTBEAT_INTERVAL_MULTIPLIER`] of its own
/// interval has passed since its last heartbeat. A paused phase is never late: it is not expected
/// to be heartbeating at all.
pub(crate) fn is_heartbeat_late(
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

/// Runs every rule and ranks what it found.
///
/// `stuck` and `depths` are passed in because the caller already reads both aggregates, the two
/// most expensive reads in the request. `depths` is the live count per state, superseded rows
/// excluded, as [`credit_registrations::count_by_state`] returns it.
pub async fn evaluate(
    conn: &mut PgConnection,
    stuck: &[StuckRegistrationCount],
    depths: &[(CreditRegistrationState, i64)],
) -> ModelResult<CreditRegistrationHealth> {
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
            total: None,
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
            total: None,
            at: unreachable.last_at,
            subject: None,
        });
    }

    if let Some(alert) = sisu_outage_alert(conn, now).await? {
        alerts.push(alert);
    }
    if let Some(alert) = stuck_alert(stuck) {
        alerts.push(alert);
    }
    if let Some(alert) = linking_mail_alert(conn, now).await? {
        alerts.push(alert);
    }
    if let Some(alert) = linking_mail_rate_alert(conn, now).await? {
        alerts.push(alert);
    }
    alerts.extend(phase_alerts(conn, now, depths).await?);
    alerts.extend(terminal_outcome_alerts(conn, now, depths).await?);
    if let Some(alert) = course_configuration_alert(conn).await? {
        alerts.push(alert);
    }
    if let Some(alert) = never_entered_alert(conn).await? {
        alerts.push(alert);
    }
    if let Some(alert) = latency_regression_alert(conn, now).await? {
        alerts.push(alert);
    }
    if let Some(alert) = fast_track_name_mismatch_alert(conn).await? {
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
        Some(CreditRegistrationAlertSeverity::Info) | None => HealthStatus::Healthy,
    };

    Ok(CreditRegistrationHealth {
        status,
        alerts,
        thresholds: thresholds(),
    })
}

/// The share of recent items the study registry blamed on Sisu. Our only proxy for Sisu's uptime,
/// which is why it is a rule of its own rather than part of the request-level one above.
async fn sisu_outage_alert(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
) -> ModelResult<Option<CreditRegistrationAlert>> {
    let totals = credit_registration_events::count_item_outcomes_since(
        conn,
        now - chrono::Duration::seconds(SISU_OUTAGE_WINDOW_SECS),
    )
    .await?;
    if totals.item_count < SISU_OUTAGE_MIN_ITEMS
        || totals.sisu_unavailable_count * 100
            < totals.item_count * SISU_OUTAGE_FAILURE_SHARE_PERCENT
    {
        return Ok(None);
    }
    Ok(Some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::SisuUnavailable,
        severity: CreditRegistrationAlertSeverity::Critical,
        count: totals.sisu_unavailable_count,
        total: Some(totals.item_count),
        at: totals.last_sisu_unavailable_at,
        subject: None,
    }))
}

/// Rows the pipeline should have moved on by now. `abandoned_by_consent_withdrawal` is terminal, so
/// it is outside this by construction rather than by a filter that could be forgotten.
fn stuck_alert(stuck: &[StuckRegistrationCount]) -> Option<CreditRegistrationAlert> {
    let total: i64 = stuck.iter().map(|row| row.count).sum();
    if total == 0 {
        return None;
    }
    let severe: i64 = stuck.iter().map(|row| row.severely_stuck_count).sum();
    let worst = stuck.iter().max_by_key(|row| row.count);
    let severity = if total > STUCK_CRITICAL_COUNT || severe > 0 {
        CreditRegistrationAlertSeverity::Critical
    } else {
        CreditRegistrationAlertSeverity::Warning
    };
    Some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::StuckRegistrations,
        severity,
        count: total,
        total: None,
        at: worst.and_then(|row| row.oldest_state_entered_at),
        subject: worst.map(|row| state_name(row.state)),
    })
}

/// Linking mails we could not hand over at all. The recipient domain rides along because an
/// undeliverable host is the usual cause.
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
        total: Some(totals.mails_in_window),
        at: totals.last_send_failed_at,
        subject: top_domain,
    }))
}

/// The volume guard: how many people we mailed in the last hour against what an hour should hold.
/// Counts addresses, which is what the per-person caps govern.
async fn linking_mail_rate_alert(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
) -> ModelResult<Option<CreditRegistrationAlert>> {
    let sent = credit_registration_account_linking_emails::count_sent_since(
        conn,
        now - chrono::Duration::hours(1),
    )
    .await?;
    if sent <= LINKING_MAIL_HOURLY_CAP {
        return Ok(None);
    }
    let severity = if sent > LINKING_MAIL_HOURLY_CAP * 2 {
        CreditRegistrationAlertSeverity::Critical
    } else {
        CreditRegistrationAlertSeverity::Warning
    };
    Ok(Some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::LinkingMailRateCapExceeded,
        severity,
        count: sent,
        total: Some(LINKING_MAIL_HOURLY_CAP),
        at: Some(now),
        subject: None,
    }))
}

/// What the phase table says about itself: phases that stopped reporting, and phases that report
/// but get nowhere.
///
/// A phase that has never heartbeated is deliberately outside both: a freshly migrated database has
/// no heartbeats at all, and that would keep the banner permanently red.
async fn phase_alerts(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
    depths: &[(CreditRegistrationState, i64)],
) -> ModelResult<Vec<CreditRegistrationAlert>> {
    let phases = credit_registration_phase_state::get_all(conn).await?;
    let mut stale: Vec<&str> = Vec::new();
    let mut failing: Vec<&str> = Vec::new();
    let mut paused = 0;
    let mut last_paused_at = None;
    for phase in &phases {
        if let Some(paused_at) = phase.paused_at {
            paused += 1;
            last_paused_at = last_paused_at.max(Some(paused_at));
            continue;
        }
        let interval = i64::from(phase.expected_interval_secs);
        if is_heartbeat_late(
            phase.last_heartbeat_at,
            phase.expected_interval_secs,
            None,
            now,
        ) {
            stale.push(&phase.phase);
        }
        let owns_work =
            crate::domain::credit_registration_phases::CreditRegistrationPhase::from_phase_name(
                &phase.phase,
            )
            .is_some_and(|known| owned_depth(known, depths) > 0);
        let unproductive = owns_work
            && phase.last_success_at.is_some_and(|last_success_at| {
                (now - last_success_at).num_seconds()
                    > interval * i64::from(PHASE_SUCCESS_INTERVAL_MULTIPLIER)
            });
        if phase.consecutive_failures >= PHASE_CONSECUTIVE_FAILURE_LIMIT || unproductive {
            failing.push(&phase.phase);
        }
    }

    let mut alerts = Vec::new();
    if !stale.is_empty() {
        alerts.push(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::PhaseHeartbeatStale,
            severity: CreditRegistrationAlertSeverity::Critical,
            count: stale.len() as i64,
            total: Some(phases.len() as i64),
            at: None,
            subject: stale.first().map(|phase| (*phase).to_string()),
        });
    }
    if !failing.is_empty() {
        alerts.push(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::PhaseFailing,
            severity: CreditRegistrationAlertSeverity::Critical,
            count: failing.len() as i64,
            total: Some(phases.len() as i64),
            at: None,
            subject: failing.first().map(|phase| (*phase).to_string()),
        });
    }
    if paused > 0 && paused == phases.len() {
        alerts.push(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::PipelinePausedGlobally,
            severity: CreditRegistrationAlertSeverity::Info,
            count: paused as i64,
            total: Some(phases.len() as i64),
            at: last_paused_at,
            subject: None,
        });
    }
    Ok(alerts)
}

/// The three rules read off the last day's terminal outcomes: failures piling up, reversals, and a
/// pipeline that finished nothing while holding work.
async fn terminal_outcome_alerts(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
    depths: &[(CreditRegistrationState, i64)],
) -> ModelResult<Vec<CreditRegistrationAlert>> {
    let since = now - chrono::Duration::seconds(TERMINAL_WINDOW_SECS);
    let totals = credit_registrations::count_terminal_outcomes_since(conn, since).await?;
    let mut alerts = Vec::new();

    let rate_broken = totals.total_count >= PERMANENT_FAILURE_COUNT
        && totals.failed_permanent_count * 100
            > totals.total_count * PERMANENT_FAILURE_RATE_PERCENT;
    if totals.failed_permanent_count >= PERMANENT_FAILURE_COUNT || rate_broken {
        alerts.push(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::PermanentFailuresAccumulating,
            severity: CreditRegistrationAlertSeverity::Warning,
            count: totals.failed_permanent_count,
            total: Some(totals.total_count),
            at: Some(now),
            subject: None,
        });
    }

    let misregistered = credit_registrations::count_entered_state_since(
        conn,
        CreditRegistrationState::Misregistered,
        since,
    )
    .await?;
    if misregistered > 0 {
        alerts.push(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::MisregistrationsDetected,
            severity: if misregistered >= MISREGISTRATION_CRITICAL_COUNT {
                CreditRegistrationAlertSeverity::Critical
            } else {
                CreditRegistrationAlertSeverity::Warning
            },
            count: misregistered,
            total: None,
            at: Some(now),
            subject: None,
        });
    }

    let queued = depth_of(depths, CreditRegistrationState::ReadyToSubmit)
        + depth_of(depths, CreditRegistrationState::AwaitingVerification);
    if totals.total_count == 0 && queued > IDLE_QUEUE_DEPTH {
        alerts.push(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::PipelineIdle,
            severity: CreditRegistrationAlertSeverity::Warning,
            count: queued,
            total: None,
            at: Some(now),
            subject: None,
        });
    }
    Ok(alerts)
}

/// Modules the last configuration check found broken. Never checked is not counted: the Courses tab
/// renders unknown and broken differently, and so must this.
async fn course_configuration_alert(
    conn: &mut PgConnection,
) -> ModelResult<Option<CreditRegistrationAlert>> {
    let count =
        course_module_suotar_configurations::count_modules_failing_config_check(conn).await?;
    Ok((count > 0).then_some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::CourseConfigurationBroken,
        severity: CreditRegistrationAlertSeverity::Warning,
        count,
        total: None,
        at: None,
        subject: None,
    }))
}

/// Completions old enough that `materialize` has had every chance and still has no ledger row for
/// them. Sampled rather than counted, so the anti-join stops early on a large backlog.
async fn never_entered_alert(
    conn: &mut PgConnection,
) -> ModelResult<Option<CreditRegistrationAlert>> {
    let found = get_unmaterialised_eligible_completions(
        conn,
        NEVER_ENTERED_MIN_AGE_SECS,
        NEVER_ENTERED_SAMPLE_LIMIT,
    )
    .await?;
    if found.is_empty() {
        return Ok(None);
    }
    Ok(Some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::CompletionsNeverEntered,
        severity: CreditRegistrationAlertSeverity::Warning,
        count: found.len() as i64,
        total: Some(NEVER_ENTERED_SAMPLE_LIMIT),
        at: found.first().map(|row| row.created_at),
        subject: None,
    }))
}

/// How long the study registry is taking to confirm, this week against last. `count` is this
/// week's p95 in seconds and `total` last week's, so the banner can name both.
async fn latency_regression_alert(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
) -> ModelResult<Option<CreditRegistrationAlert>> {
    let window = chrono::Duration::seconds(LATENCY_WINDOW_SECS);
    let current =
        credit_registrations::get_registration_latency_between(conn, now - window, now).await?;
    let (Some(current_p95), true) = (current.p95_confirmation_secs, current.registered_count > 0)
    else {
        return Ok(None);
    };
    if current_p95 < LATENCY_REGRESSION_FLOOR_SECS {
        return Ok(None);
    }
    let previous = credit_registrations::get_registration_latency_between(
        conn,
        now - window * 2,
        now - window,
    )
    .await?;
    let Some(previous_p95) = previous
        .p95_confirmation_secs
        .filter(|_| previous.registered_count > 0)
    else {
        return Ok(None);
    };
    if current_p95 <= previous_p95 * LATENCY_REGRESSION_FACTOR {
        return Ok(None);
    }
    Ok(Some(CreditRegistrationAlert {
        id: CreditRegistrationAlertId::ConfirmationLatencyRegressed,
        severity: CreditRegistrationAlertSeverity::Info,
        count: current_p95,
        total: Some(previous_p95),
        at: Some(now),
        subject: None,
    }))
}

/// Persons whose university address matched a verified account under a different name. The
/// observable signature of an address reissued to somebody else, and the only warning we get before
/// a link is made to the wrong account.
async fn fast_track_name_mismatch_alert(
    conn: &mut PgConnection,
) -> ModelResult<Option<CreditRegistrationAlert>> {
    let count =
        course_module_suotar_realisations::sum_last_fast_track_name_mismatches(conn).await?;
    Ok(
        (count >= FAST_TRACK_NAME_MISMATCH_COUNT).then_some(CreditRegistrationAlert {
            id: CreditRegistrationAlertId::FastTrackNameMismatch,
            severity: CreditRegistrationAlertSeverity::Warning,
            count,
            total: None,
            at: None,
            subject: None,
        }),
    )
}

fn depth_of(depths: &[(CreditRegistrationState, i64)], state: CreditRegistrationState) -> i64 {
    depths
        .iter()
        .find(|(row_state, _)| *row_state == state)
        .map_or(0, |(_, count)| *count)
}

fn owned_depth(
    phase: crate::domain::credit_registration_phases::CreditRegistrationPhase,
    depths: &[(CreditRegistrationState, i64)],
) -> i64 {
    phase
        .owned_states()
        .iter()
        .map(|state| depth_of(depths, *state))
        .sum()
}

/// The state's own wire name, taken from its serialisation so the two cannot drift.
fn state_name(state: CreditRegistrationState) -> String {
    serde_json::to_value(state)
        .ok()
        .and_then(|value| value.as_str().map(str::to_string))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The alert's `subject` has to be the same spelling the ledger and the filters use.
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

    /// Info exists to be shown without turning the page red.
    #[test]
    fn severity_ranks_the_way_the_banner_reads_it() {
        assert!(
            CreditRegistrationAlertSeverity::Critical > CreditRegistrationAlertSeverity::Warning
        );
        assert!(CreditRegistrationAlertSeverity::Warning > CreditRegistrationAlertSeverity::Info);
    }
}
