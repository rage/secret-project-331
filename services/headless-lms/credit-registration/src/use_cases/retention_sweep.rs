//! The `retention-sweep` phase: clearing out records past their retention window.

use chrono::{Duration, Utc};
use headless_lms_models::credit_registration_enrolment_check_outcomes;
use headless_lms_models::credit_registration_events::redact_details_older_than;
use headless_lms_models::student_number_verification_tokens::soft_delete_expired;
use headless_lms_models::suotar_api_calls::{RETENTION_DAYS, delete_older_than};
use sqlx::PgPool;

use crate::error::CreditRegistrationResult;
use crate::workflow::Counts;

/// How much one retention sweep removes from each table.
const SWEEP_LIMIT: i64 = 500;
/// Above the tens of thousands of checks a day the hourly sweep has to keep up with.
const OUTCOME_SWEEP_LIMIT: i64 = 5000;
/// Each enrolment check answer writes an event, so one batch an hour would fall behind the checks;
/// separate transactions keep each batch's row locks short.
const MAX_REDACTION_BATCHES: usize = 20;

/// The call log's 90-day window, which also ends the unredacted life of the ledger's copies of those
/// exchanges, the enrolment check log's own longer window, and the expired linking tokens.
///
/// Bounded per iteration and run hourly, so the first sweep after the window opens clears a backlog
/// over several hours instead of in one statement that locks every `credit_registration_events` row
/// referencing it.
pub(crate) async fn run(pool: &PgPool) -> CreditRegistrationResult<Counts> {
    let mut conn = pool.acquire().await?;
    let cutoff = Utc::now() - Duration::days(RETENTION_DAYS);
    let purged_calls = delete_older_than(&mut conn, cutoff, SWEEP_LIMIT).await?;
    let mut redacted_events = 0;
    for _ in 0..MAX_REDACTION_BATCHES {
        let redacted = redact_details_older_than(&mut conn, cutoff, SWEEP_LIMIT).await?;
        redacted_events += redacted;
        if redacted < SWEEP_LIMIT.unsigned_abs() {
            break;
        }
    }
    let purged_outcomes = credit_registration_enrolment_check_outcomes::delete_older_than(
        &mut conn,
        Utc::now() - Duration::days(credit_registration_enrolment_check_outcomes::RETENTION_DAYS),
        OUTCOME_SWEEP_LIMIT,
    )
    .await?;
    let retired_tokens = soft_delete_expired(&mut conn, SWEEP_LIMIT).await?;
    if purged_calls > 0 || redacted_events > 0 || purged_outcomes > 0 || retired_tokens > 0 {
        info!(
            purged_calls,
            redacted_events,
            purged_outcomes,
            retired_tokens,
            "Retention sweep cleared expired credit registration records"
        );
    }
    Ok(Counts::processed(
        i64::try_from(purged_calls + redacted_events + purged_outcomes + retired_tokens)
            .unwrap_or(i64::MAX),
    ))
}
