//! The account-linking actions a person sets off by hand, each over a study registry built for
//! someone waiting on the answer.

use headless_lms_utils::services::suotar::SuotarClient;
use secrecy::SecretString;
use sqlx::PgPool;
use uuid::Uuid;

use super::dispatch::worker_name;
use super::suotar::SuotarStudyRegistry;
use crate::error::CreditRegistrationResult;
use crate::phase::CreditRegistrationPhase;
use crate::use_cases::linking_mail_resend::{self, RateCapOverride, ResendAttempt};
use crate::use_cases::person_lookup::{self, ResolvePersonError, ResolvedPerson};

/// What a manual action needs from the controller that runs it.
pub struct ManualActionContext<'a> {
    pool: &'a PgPool,
    suotar_client: &'a SuotarClient,
    caller: &'a str,
}

impl<'a> ManualActionContext<'a> {
    /// `caller` marks the action's study registry calls in the audit log as something a person set
    /// off.
    pub fn new(pool: &'a PgPool, suotar_client: &'a SuotarClient, caller: &'a str) -> Self {
        Self {
            pool,
            suotar_client,
            caller,
        }
    }
}

/// Shared by the teacher- and admin-facing resend endpoints: refuses a target that is already linked,
/// otherwise applies `rate_cap_override`, if any, and reruns the send path exactly as the worker
/// would. The override runs only after the already-linked check, so it never retires mails for a
/// number that turns out to be linked.
pub async fn resend_linking_mail_for_target(
    ctx: &ManualActionContext<'_>,
    course_id: Uuid,
    student_number: &SecretString,
    rate_cap_override: Option<RateCapOverride<'_>>,
) -> CreditRegistrationResult<ResendAttempt> {
    let registry = SuotarStudyRegistry::interactive(
        ctx.suotar_client,
        worker_name(ctx.caller, CreditRegistrationPhase::EnrolmentDiscovery),
    );
    linking_mail_resend::resend_for_target(
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
pub async fn resolve_person(
    ctx: &ManualActionContext<'_>,
    student_number: &SecretString,
) -> Result<Option<ResolvedPerson>, ResolvePersonError> {
    let registry = SuotarStudyRegistry::interactive(ctx.suotar_client, ctx.caller.to_string());
    person_lookup::look_up_person(&registry, student_number).await
}
