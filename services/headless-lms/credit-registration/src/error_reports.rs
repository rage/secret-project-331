//! Reports operator-visible worker failures to the shared error registry the admin Errors page
//! reads, the same table `ControllerError` writes 5xx responses to.

use headless_lms_models::errors::{self, ErrorSource, NewErrorReport};
use sqlx::PgPool;

use crate::phase::{CreditRegistrationPhase, WorkerProcess};

/// Records one phase's worker failures for the admin Errors page.
#[derive(Clone, Copy)]
pub(crate) struct ErrorReporter<'a> {
    pool: &'a PgPool,
    /// `None` for a caller that is not one of the two deployed workers (the test-only tick
    /// endpoint), which is left unreported.
    process: Option<WorkerProcess>,
    phase: CreditRegistrationPhase,
}

impl<'a> ErrorReporter<'a> {
    pub(crate) fn new(
        pool: &'a PgPool,
        process: Option<WorkerProcess>,
        phase: CreditRegistrationPhase,
    ) -> Self {
        Self {
            pool,
            process,
            phase,
        }
    }

    /// Records one failure. Best-effort: a connection or insert failure is only logged, and this
    /// never changes the caller's control flow or returns an error.
    pub(crate) async fn report(
        &self,
        message: &str,
        stack_trace: Option<String>,
        details: serde_json::Value,
    ) {
        let Some(process) = self.process else {
            return;
        };
        let mut details = details;
        if let serde_json::Value::Object(map) = &mut details {
            map.insert(
                "kind".to_string(),
                serde_json::json!("credit_registration_worker"),
            );
            map.insert("phase".to_string(), serde_json::json!(self.phase.as_str()));
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
        errors::insert_best_effort(self.pool, &report).await;
    }
}
