//! The last state each worker process reported for its circuit breakers. The worker keeps the live
//! state in memory; this copy is only for the dashboard, which runs in another process.

use utoipa::ToSchema;

use crate::prelude::*;

/// Which phases one circuit breaker pauses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type, ToSchema)]
#[sqlx(type_name = "suotar_circuit_breaker_target", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BreakerTarget {
    /// Every phase that calls the study registry: Suotar itself failing.
    StudyRegistry,
    /// Only the phase that submits to Sisu: Suotar answering that Sisu timed out.
    SisuSubmissions,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SuotarCircuitBreaker {
    /// The worker process the breaker belongs to; each keeps its own.
    pub process_name: String,
    pub target: BreakerTarget,
    /// When the worker last reported the state.
    pub updated_at: DateTime<Utc>,
    pub consecutive_failures: i32,
    /// When the cooldown ends; `None` for a breaker that has not opened since its last success.
    pub open_until: Option<DateTime<Utc>>,
    pub trip_count: i32,
}

/// What the worker reports for one breaker; [`SuotarCircuitBreaker`] without the report time.
#[derive(Debug, Clone, PartialEq)]
pub struct SuotarCircuitBreakerReport<'a> {
    pub process_name: &'a str,
    pub target: BreakerTarget,
    pub consecutive_failures: i32,
    pub open_until: Option<DateTime<Utc>>,
    pub trip_count: i32,
}

pub async fn upsert(
    conn: &mut PgConnection,
    breaker: &SuotarCircuitBreakerReport<'_>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO suotar_circuit_breakers (
    process_name,
    target,
    consecutive_failures,
    open_until,
    trip_count
  )
VALUES ($1, $2, $3, $4, $5) ON CONFLICT (process_name, target) DO
UPDATE
SET consecutive_failures = EXCLUDED.consecutive_failures,
  open_until = EXCLUDED.open_until,
  trip_count = EXCLUDED.trip_count
        "#,
        breaker.process_name,
        breaker.target as BreakerTarget,
        breaker.consecutive_failures,
        breaker.open_until,
        breaker.trip_count,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<SuotarCircuitBreaker>> {
    let res = sqlx::query_as!(
        SuotarCircuitBreaker,
        r#"
SELECT process_name,
  target AS "target: BreakerTarget",
  updated_at,
  consecutive_failures,
  open_until,
  trip_count
FROM suotar_circuit_breakers
ORDER BY process_name,
  target
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
