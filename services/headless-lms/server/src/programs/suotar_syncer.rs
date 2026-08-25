//! The worker that owns everything about credit registration except the ledger: enrolment discovery,
//! the account-linking mails and the open university product access tokens. Separate from the
//! registrar because no phase of it moves a ledger row and its intervals are hours, not seconds.

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
