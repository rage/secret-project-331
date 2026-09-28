//! The `verify` phase: asking the study registry what became of a submission.
//!
//! The only way out of `submission_uncertain`. Nothing here fails a row: the attainment may exist,
//! and a failed row is one an admin retries, which for an uncertain submission would mean sending
//! it twice. The one way back to `import` is Suotar itself answering `notRegistered`.

mod decide;
mod lease;
mod poll;
mod recovery;

use crate::error::CreditRegistrationResult;
use crate::registry::StudyRegistry;
use crate::use_cases::batch_flow::{BatchFlowContext, run_registry_batch_flow};
use crate::workflow::Counts;

use poll::VerifyPoll;
use recovery::UncertainRecovery;

pub(crate) async fn run<R: StudyRegistry>(
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    let mut counts = run_registry_batch_flow::<VerifyPoll, _>(ctx, registry).await?;
    counts += run_registry_batch_flow::<UncertainRecovery, _>(ctx, registry).await?;
    Ok(counts)
}
