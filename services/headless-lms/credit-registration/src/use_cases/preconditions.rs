//! The `preconditions` phase: moving rows along, or out of, the chain of things that must be true
//! before we submit.

use headless_lms_models::library::credit_registration::preconditions::{
    PRECONDITIONS_LIMIT, recompute_preconditions,
};

use crate::domain::Counts;
use crate::error::CreditRegistrationResult;
use crate::use_cases::contexts::DatabaseContext;

pub(crate) async fn run(ctx: &DatabaseContext<'_>) -> CreditRegistrationResult<Counts> {
    let mut conn = ctx.pool.acquire().await?;
    let moved = recompute_preconditions(&mut conn, ctx.scope, PRECONDITIONS_LIMIT).await?;
    Ok(Counts::processed(moved))
}
