//! The account-linking actions a person sets off by hand, each over a study registry built for
//! someone waiting on the answer.

use headless_lms_models::library::credit_registration::study_registry::RosterPerson;
use headless_lms_utils::prelude::{DateTime, Utc};
use headless_lms_utils::services::suotar::SuotarClient;
use secrecy::SecretString;
use sqlx::PgPool;
use uuid::Uuid;

use super::suotar::InteractiveSuotar;
use crate::error::CreditRegistrationResult;
use crate::registry::{InteractiveStudyRegistry, PersonLookupError, RegistryPerson, StudentNumber};
use crate::use_cases::account_linking::{self, RateCapOverride, ResendAttempt};

/// What a manual action needs from the controller that runs it.
pub struct ManualActionContext<'a> {
    pool: &'a PgPool,
    suotar_client: &'a SuotarClient,
    caller: &'a str,
}

impl<'a> ManualActionContext<'a> {
    /// `caller` is the `worker_name` the action's study registry calls are logged under, one per
    /// endpoint that sets the action off, e.g. `admin-resend`.
    pub fn new(pool: &'a PgPool, suotar_client: &'a SuotarClient, caller: &'a str) -> Self {
        Self {
            pool,
            suotar_client,
            caller,
        }
    }
}

/// Shared by the teacher- and admin-facing resend endpoints: refuses a target that is already
/// linked, otherwise reruns the send path exactly as the worker would, applying
/// `rate_cap_override`, if any, only once the registry has named an address to mail.
pub async fn resend_linking_mail_for_target(
    ctx: &ManualActionContext<'_>,
    course_id: Uuid,
    student_number: &SecretString,
    rate_cap_override: Option<RateCapOverride<'_>>,
) -> CreditRegistrationResult<ResendAttempt> {
    let registry = InteractiveSuotar::new(ctx.suotar_client, ctx.caller.to_string());
    account_linking::resend_for_target(
        ctx.pool,
        &registry,
        course_id,
        student_number,
        rate_cap_override,
    )
    .await
}

/// Looks one student number up in the study registry without changing anything: no ledger row, no
/// claimed mail slot, just the call log row every study registry call writes.
///
/// `Ok(None)` means the registry answered `personNotFound`; `Err` means it gave no usable answer.
pub async fn look_up_person(
    ctx: &ManualActionContext<'_>,
    student_number: &SecretString,
) -> Result<Option<RegistryPerson>, PersonLookupError> {
    InteractiveSuotar::new(ctx.suotar_client, ctx.caller.to_string())
        .look_up_person(&StudentNumber::new(student_number.clone()))
        .await
}

/// Lists one course code's roster now and keeps the people linking mails skip: enrolled before
/// `since` or at no known time, and linked to no account, each once. Stores nothing.
///
/// `Ok(None)` means the registry gave no usable answer.
pub async fn list_unlinked_enrolled_before(
    ctx: &ManualActionContext<'_>,
    course_code: &str,
    since: DateTime<Utc>,
) -> CreditRegistrationResult<Option<Vec<RosterPerson>>> {
    let registry = InteractiveSuotar::new(ctx.suotar_client, ctx.caller.to_string());
    account_linking::unlinked_enrolled_before(ctx.pool, &registry, course_code, since).await
}
