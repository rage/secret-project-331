//! The `materialize` phase: the ledger rows for completions that became eligible, and for grades
//! that improved on a registered one.

use headless_lms_models::library::credit_registration::materialize::{
    GRADE_IMPROVEMENT_LIMIT, MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
    start_re_attempts_for_improved_grades,
};
use sqlx::{PgConnection, PgPool};

use crate::error::CreditRegistrationResult;
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

/// The ledger rows one materialize pass created.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Materialized {
    /// Rows for completions that became eligible.
    pub created: i64,
    /// New attempts for grades that improved on a registered one.
    pub re_attempted: i64,
}

/// Both statements that create ledger rows, bounded apart from each other: the phase's body, and
/// the admin "materialize now" button's, so the two cannot drift apart.
pub async fn materialize_now(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
) -> CreditRegistrationResult<Materialized> {
    let created =
        ensure_registration_rows_for_eligible_completions(conn, scope, MATERIALIZE_LIMIT).await?;
    let re_attempted =
        start_re_attempts_for_improved_grades(conn, scope, GRADE_IMPROVEMENT_LIMIT).await?;
    Ok(Materialized {
        created,
        re_attempted,
    })
}

/// One pass in one phase, so the Workers tab's row-creation counter accounts for every row the
/// pipeline invented.
pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
) -> CreditRegistrationResult<Counts> {
    let mut conn = pool.acquire().await?;
    let Materialized {
        created,
        re_attempted,
    } = materialize_now(&mut conn, scope).await?;
    if created > 0 || re_attempted > 0 {
        debug!(
            created,
            re_attempted, "Materialized credit registration rows"
        );
    }
    Ok(Counts::processed(created + re_attempted))
}
