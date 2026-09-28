//! Reports operator-visible worker failures to the shared error registry the admin Errors page
//! reads, the same table `ControllerError` writes 5xx responses to.

use std::time::Duration;

use headless_lms_models::errors::{ErrorSource, NewErrorReport};
use sqlx::PgPool;

use crate::phase::{CreditRegistrationPhase, WorkerProcess};

/// An outage must not make reporting it add to the pool pressure.
const REPORT_TIMEOUT: Duration = Duration::from_millis(250);

/// Records one worker failure for the admin Errors page.
///
/// `process` is `None` for a caller that is not one of the two deployed workers (the test-only tick
/// endpoint), which is left unreported. Best-effort: a connection or insert failure is only logged,
/// and this never changes the caller's control flow or returns an error.
pub(crate) async fn report_error(
    pool: &PgPool,
    process: Option<WorkerProcess>,
    phase: CreditRegistrationPhase,
    message: &str,
    stack_trace: Option<String>,
    details: serde_json::Value,
) {
    let Some(process) = process else {
        return;
    };
    let mut conn = match tokio::time::timeout(REPORT_TIMEOUT, pool.acquire()).await {
        Ok(Ok(conn)) => conn,
        Ok(Err(err)) => {
            warn!(error = %err, "Credit registration error report skipped: could not acquire a connection");
            return;
        }
        Err(_) => {
            warn!("Credit registration error report skipped: timed out acquiring a connection");
            return;
        }
    };
    let mut details = details;
    if let serde_json::Value::Object(map) = &mut details {
        map.insert(
            "kind".to_string(),
            serde_json::json!("credit_registration_worker"),
        );
        map.insert("phase".to_string(), serde_json::json!(phase.as_str()));
    }
    let report = NewErrorReport {
        service: process.as_str().to_string(),
        error_source: Some(ErrorSource::Backend),
        message: message.to_string(),
        stack_trace,
        path: None,
        app_version: None,
        details: Some(details),
    };
    if let Err(err) = headless_lms_models::errors::insert(&mut conn, None, &report).await {
        debug!(error = %err, "Credit registration error report insert failed");
    }
}
