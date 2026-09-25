//! The last limiter and circuit breaker state the worker reported per rate-limited Suotar endpoint.
//! The worker keeps the live state in memory; this copy is only for the dashboard, which runs in
//! another process.

use utoipa::ToSchema;

use crate::prelude::*;
use crate::suotar_api_calls::SuotarEndpoint;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SuotarEndpointRateLimit {
    pub endpoint: SuotarEndpoint,
    /// When the worker last reported the state.
    pub updated_at: DateTime<Utc>,
    /// The share of the full rate allowed, from 0.1 up to 1.
    pub rate_share: f32,
    /// Items per minute, or requests per minute for `list_by_course`.
    pub full_rate_per_minute: i32,
    /// Items, or requests, that could go out right now.
    pub available: i32,
    pub is_breaker_open: bool,
    pub breaker_trip_count: i32,
}

/// What the worker reports for one endpoint; [`SuotarEndpointRateLimit`] without the report time.
#[derive(Debug, Clone, PartialEq)]
pub struct SuotarEndpointRateLimitReport {
    pub endpoint: SuotarEndpoint,
    pub rate_share: f32,
    pub full_rate_per_minute: i32,
    pub available: i32,
    pub is_breaker_open: bool,
    pub breaker_trip_count: i32,
}

pub async fn upsert(
    conn: &mut PgConnection,
    state: &SuotarEndpointRateLimitReport,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO suotar_endpoint_rate_limits (
    endpoint,
    rate_share,
    full_rate_per_minute,
    available,
    is_breaker_open,
    breaker_trip_count
  )
VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (endpoint) DO
UPDATE
SET rate_share = EXCLUDED.rate_share,
  full_rate_per_minute = EXCLUDED.full_rate_per_minute,
  available = EXCLUDED.available,
  is_breaker_open = EXCLUDED.is_breaker_open,
  breaker_trip_count = EXCLUDED.breaker_trip_count
        "#,
        state.endpoint as SuotarEndpoint,
        state.rate_share,
        state.full_rate_per_minute,
        state.available,
        state.is_breaker_open,
        state.breaker_trip_count,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<SuotarEndpointRateLimit>> {
    let res = sqlx::query_as!(
        SuotarEndpointRateLimit,
        r#"
SELECT endpoint AS "endpoint: SuotarEndpoint",
  updated_at,
  rate_share,
  full_rate_per_minute,
  available,
  is_breaker_open,
  breaker_trip_count
FROM suotar_endpoint_rate_limits
ORDER BY endpoint
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
