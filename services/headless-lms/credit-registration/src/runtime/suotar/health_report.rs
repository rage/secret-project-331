//! Copying this process's breaker and limiter state to the database for the dashboard, which runs
//! in another process.

use headless_lms_models::{suotar_circuit_breakers, suotar_endpoint_rate_limits};
use sqlx::PgConnection;

use super::{breaker, rate_limit};
use crate::error::CreditRegistrationResult;
use crate::phase::CreditRegistrationPhase;
use crate::runtime::process_local::ScopeKey;

/// Copies the state of the breakers that pause the phase to the database for the dashboard, which
/// runs in another process.
pub(in crate::runtime) async fn report_breakers(
    conn: &mut PgConnection,
    phase: CreditRegistrationPhase,
) -> CreditRegistrationResult<()> {
    let spec = phase.spec();
    for &target in spec.breakers {
        let breaker = breaker::snapshot(&ScopeKey::Global, target);
        if !breaker::REPORTED.is_due(&target, &breaker, breaker::BreakerSnapshot::is_same_report) {
            continue;
        }
        trace!(
            ?target,
            consecutive_failures = breaker.consecutive_failures,
            open = breaker.open,
            trip_count = breaker.trip_count,
            "Reporting circuit breaker state to the dashboard"
        );
        suotar_circuit_breakers::upsert(
            conn,
            &suotar_circuit_breakers::SuotarCircuitBreakerReport {
                process_name: spec.process.as_str(),
                target,
                consecutive_failures: i32::try_from(breaker.consecutive_failures)
                    .unwrap_or(i32::MAX),
                open_until: breaker.open_until,
                trip_count: i32::try_from(breaker.trip_count).unwrap_or(i32::MAX),
            },
        )
        .await?;
        breaker::REPORTED.record(target, breaker);
    }
    Ok(())
}

/// Copies the limiter state of the phase's endpoints to the database for the dashboard, which runs
/// in another process.
pub(in crate::runtime) async fn report_rate_limits(
    conn: &mut PgConnection,
    phase: CreditRegistrationPhase,
) -> CreditRegistrationResult<()> {
    for endpoint in super::study_registry_endpoints(phase) {
        let Some(limiter) = rate_limit::snapshot(&ScopeKey::Global, endpoint) else {
            continue;
        };
        if !rate_limit::REPORTED.is_due(&endpoint, &limiter, PartialEq::eq) {
            continue;
        }
        trace!(
            ?endpoint,
            rate_share = limiter.share,
            available = limiter.available,
            "Reporting rate limit state to the dashboard"
        );
        suotar_endpoint_rate_limits::upsert(
            conn,
            &suotar_endpoint_rate_limits::SuotarEndpointRateLimitReport {
                endpoint,
                rate_share: limiter.share as f32,
                full_rate_per_minute: limiter.rate.per_minute as i32,
                available: i32::try_from(limiter.available).unwrap_or(i32::MAX),
            },
        )
        .await?;
        rate_limit::REPORTED.record(endpoint, limiter);
    }
    Ok(())
}
