//! The worker that owns the credit registration ledger: one process, several phases, each with its
//! own interval and its own row in `credit_registration_phase_state`. Every iteration goes through
//! the same dispatcher the test tick endpoint uses.

use super::credit_registration_worker::run_credit_registration_worker;
use headless_lms_credit_registration::WorkerProcess;

pub async fn main() -> anyhow::Result<()> {
    run_credit_registration_worker(
        WorkerProcess::CreditRegistrar,
        "Starting the credit registrar.",
        "Still registering credits.",
    )
    .await
}
