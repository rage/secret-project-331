//! The `preconditions` phase: moving rows along, or out of, the chain of things that must be true
//! before we submit.

use headless_lms_data_operations::library::credit_registration::preconditions::{
    PRECONDITIONS_LIMIT, recompute_preconditions,
};
use sqlx::PgPool;

use crate::error::CreditRegistrationResult;
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
) -> CreditRegistrationResult<Counts> {
    let mut conn = pool.acquire().await?;
    let moved = recompute_preconditions(&mut conn, scope, PRECONDITIONS_LIMIT).await?;
    Ok(Counts::processed(moved))
}
