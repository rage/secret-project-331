//! The worker that owns everything about credit registration except the ledger.
//!
//! Enrolment discovery, the account-linking mails and the open university product access tokens. It
//! is a separate process from the registrar because no phase of it moves a ledger row, and because
//! its intervals are half-hours and hours rather than seconds.
//!
//! With nothing configured for Suotar there is nothing to discover and no product to look up, so the
//! loop simply finds no work; it does not need a special idle path. Missing credentials are a
//! different matter and fail at boot.

use super::credit_registrar::run_credit_registration_worker;

const PROCESS_NAME: &str = "suotar-syncer";

pub async fn main() -> anyhow::Result<()> {
    run_credit_registration_worker(
        PROCESS_NAME,
        "Starting the Suotar syncer.",
        "Still syncing with the study registry.",
    )
    .await
}
