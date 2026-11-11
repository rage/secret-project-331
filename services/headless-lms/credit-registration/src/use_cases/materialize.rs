//! The `materialize` phase: the ledger rows for completions that became eligible, for grades that
//! improved on a registered one, and for completions registrable again after a withdrawal.

use headless_lms_models::library::credit_registration::materialize::{
    GRADE_IMPROVEMENT_LIMIT, MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
    start_re_attempts_for_improved_grades, start_re_attempts_for_restored_completions,
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
    /// New attempts for completions registrable again after the pipeline withdrew them.
    pub restored: i64,
}

impl Materialized {
    /// Every row the pass created.
    pub fn total(&self) -> i64 {
        self.created + self.re_attempted + self.restored
    }
}

/// Every statement that creates ledger rows, each bounded on its own: the phase's body, and the
/// admin "materialize now" button's, so the two cannot drift apart.
pub async fn materialize_now(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
) -> CreditRegistrationResult<Materialized> {
    let created =
        ensure_registration_rows_for_eligible_completions(conn, scope, MATERIALIZE_LIMIT).await?;
    let re_attempted =
        start_re_attempts_for_improved_grades(conn, scope, GRADE_IMPROVEMENT_LIMIT).await?;
    let restored =
        start_re_attempts_for_restored_completions(conn, scope, MATERIALIZE_LIMIT).await?;
    Ok(Materialized {
        created,
        re_attempted,
        restored,
    })
}

/// One pass in one phase, so the Workers tab's row-creation counter accounts for every row the
/// pipeline invented.
pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
) -> CreditRegistrationResult<Counts> {
    let mut conn = pool.acquire().await?;
    let materialized = materialize_now(&mut conn, scope).await?;
    if materialized.total() > 0 {
        debug!(
            created = materialized.created,
            re_attempted = materialized.re_attempted,
            restored = materialized.restored,
            "Materialized credit registration rows"
        );
    }
    Ok(Counts::processed(materialized.total()))
}
