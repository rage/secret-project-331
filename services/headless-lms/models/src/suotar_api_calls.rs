//! Per-request observability for calls to Suotar.
//!
//! Bodies must be scrubbed with [`crate::credit_registration_events::scrub_suotar_body`] before
//! insert; `credit_registration_ids` replaces the removed identifiers for drill-down.
use utoipa::ToSchema;

use crate::prelude::*;

/// How long call rows are kept.
pub const RETENTION_DAYS: i64 = 90;

/// Bodies are sampled in full up to this many items.
pub const FULL_BODY_ITEM_LIMIT: usize = 20;

/// Above [`FULL_BODY_ITEM_LIMIT`], only this many items are kept plus a count.
pub const SAMPLED_BODY_ITEM_COUNT: usize = 5;

/// Hard cap on a stored body, applied after sampling.
pub const BODY_SAMPLE_MAX_BYTES: usize = 64 * 1024;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(type_name = "suotar_endpoint", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SuotarEndpoint {
    ResolvePersons,
    ResolveEnrolments,
    ImportAttainments,
    VerifyAttainments,
    ProductAccessTokens,
    ListByCourse,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarApiCall {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub endpoint: SuotarEndpoint,
    pub request_item_count: i32,
    pub http_status: Option<i32>,
    pub duration_ms: Option<i32>,
    pub succeeded: bool,
    pub ok_item_count: i32,
    pub error_item_count: i32,
    pub request_level_error_code: Option<String>,
    pub error_message: Option<String>,
    pub request_body_sample: Option<serde_json::Value>,
    pub response_body_sample: Option<serde_json::Value>,
    pub credit_registration_ids: Vec<Uuid>,
    pub worker_name: String,
    pub started_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewSuotarApiCall {
    pub endpoint: SuotarEndpoint,
    pub request_item_count: i32,
    pub http_status: Option<i32>,
    pub duration_ms: Option<i32>,
    pub succeeded: bool,
    pub ok_item_count: i32,
    pub error_item_count: i32,
    pub request_level_error_code: Option<String>,
    /// Scrub before passing.
    pub error_message: Option<String>,
    /// Must already be scrubbed and sampled.
    pub request_body_sample: Option<serde_json::Value>,
    /// Must already be scrubbed and sampled.
    pub response_body_sample: Option<serde_json::Value>,
    pub credit_registration_ids: Vec<Uuid>,
    pub worker_name: String,
    pub started_at: DateTime<Utc>,
}

pub async fn insert(conn: &mut PgConnection, new: &NewSuotarApiCall) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO suotar_api_calls (
    endpoint,
    request_item_count,
    http_status,
    duration_ms,
    succeeded,
    ok_item_count,
    error_item_count,
    request_level_error_code,
    error_message,
    request_body_sample,
    response_body_sample,
    credit_registration_ids,
    worker_name,
    started_at
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14
  )
RETURNING id
        "#,
        new.endpoint as SuotarEndpoint,
        new.request_item_count,
        new.http_status,
        new.duration_ms,
        new.succeeded,
        new.ok_item_count,
        new.error_item_count,
        new.request_level_error_code,
        new.error_message,
        new.request_body_sample,
        new.response_body_sample,
        &new.credit_registration_ids,
        new.worker_name,
        new.started_at,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<SuotarApiCall> {
    let res = sqlx::query_as!(
        SuotarApiCall,
        r#"
SELECT *
FROM suotar_api_calls
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_recent(conn: &mut PgConnection, limit: i64) -> ModelResult<Vec<SuotarApiCall>> {
    let res = sqlx::query_as!(
        SuotarApiCall,
        r#"
SELECT *
FROM suotar_api_calls
WHERE deleted_at IS NULL
ORDER BY started_at DESC
LIMIT $1
        "#,
        limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_recent_by_endpoint(
    conn: &mut PgConnection,
    endpoint: SuotarEndpoint,
    limit: i64,
) -> ModelResult<Vec<SuotarApiCall>> {
    let res = sqlx::query_as!(
        SuotarApiCall,
        r#"
SELECT *
FROM suotar_api_calls
WHERE endpoint = $1
  AND deleted_at IS NULL
ORDER BY started_at DESC
LIMIT $2
        "#,
        endpoint as SuotarEndpoint,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_recent_failures(
    conn: &mut PgConnection,
    limit: i64,
) -> ModelResult<Vec<SuotarApiCall>> {
    let res = sqlx::query_as!(
        SuotarApiCall,
        r#"
SELECT *
FROM suotar_api_calls
WHERE NOT succeeded
  AND deleted_at IS NULL
ORDER BY started_at DESC
LIMIT $1
        "#,
        limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Calls that mention a ledger row, for the per-item drill-down.
///
/// Containment, not `= ANY`: only `@>` can use the GIN index on `credit_registration_ids`.
pub async fn get_by_credit_registration_id(
    conn: &mut PgConnection,
    credit_registration_id: Uuid,
    limit: i64,
) -> ModelResult<Vec<SuotarApiCall>> {
    let res = sqlx::query_as!(
        SuotarApiCall,
        r#"
SELECT *
FROM suotar_api_calls
WHERE credit_registration_ids @> ARRAY [$1::uuid]
  AND deleted_at IS NULL
ORDER BY started_at DESC
LIMIT $2
        "#,
        credit_registration_id,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Hard-deletes rows past the retention window: the stored bodies must stop existing.
pub async fn delete_older_than(conn: &mut PgConnection, cutoff: DateTime<Utc>) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
DELETE FROM suotar_api_calls
WHERE started_at < $1
        "#,
        cutoff
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}
