//! The `materialize` phase: the ledger rows for completions that became eligible, and for grades
//! that improved on a registered one.

use headless_lms_models::library::credit_registration::materialize::{
    GRADE_IMPROVEMENT_LIMIT, MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
    start_re_attempts_for_improved_grades,
};

use crate::domain::Counts;
use crate::error::CreditRegistrationResult;
use crate::use_cases::contexts::DatabaseContext;

/// Both statements that create ledger rows, bounded apart from each other. Together in one phase so
/// the Workers tab's row-creation counter accounts for every row the pipeline invented.
pub(crate) async fn run(ctx: &DatabaseContext<'_>) -> CreditRegistrationResult<Counts> {
    let mut conn = ctx.pool.acquire().await?;
    let created =
        ensure_registration_rows_for_eligible_completions(&mut conn, ctx.scope, MATERIALIZE_LIMIT)
            .await?;
    let re_attempted =
        start_re_attempts_for_improved_grades(&mut conn, ctx.scope, GRADE_IMPROVEMENT_LIMIT)
            .await?;
    if created > 0 || re_attempted > 0 {
        debug!(
            created,
            re_attempted, "Materialized credit registration rows"
        );
    }
    Ok(Counts::processed(created + re_attempted))
}
