//! Per-request observability for calls to Suotar.
//!
//! Bodies must be scrubbed with [`crate::credit_registration_events::scrub_suotar_body`] before
//! insert; `credit_registration_ids` replaces the removed identifiers for drill-down.
use async_trait::async_trait;
use headless_lms_utils::services::suotar::{
    SuotarCallAudit, SuotarCallFinished, SuotarCallStarted, SuotarEndpoint as ClientEndpoint,
};
use utoipa::ToSchema;

use crate::credit_registration_events::{scrub_suotar_body, scrub_text};
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

impl From<ClientEndpoint> for SuotarEndpoint {
    fn from(endpoint: ClientEndpoint) -> Self {
        match endpoint {
            ClientEndpoint::ResolvePersons => Self::ResolvePersons,
            ClientEndpoint::ResolveEnrolments => Self::ResolveEnrolments,
            ClientEndpoint::ImportAttainments => Self::ImportAttainments,
            ClientEndpoint::VerifyAttainments => Self::VerifyAttainments,
            ClientEndpoint::ProductAccessTokens => Self::ProductAccessTokens,
            ClientEndpoint::ListByCourse => Self::ListByCourse,
        }
    }
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

/// What only the response knows. The row itself is inserted before the request leaves.
#[derive(Debug, Clone, PartialEq)]
pub struct FinishedSuotarApiCall {
    pub http_status: Option<i32>,
    pub duration_ms: Option<i32>,
    pub succeeded: bool,
    pub ok_item_count: i32,
    pub error_item_count: i32,
    pub request_level_error_code: Option<String>,
    /// Scrub before passing.
    pub error_message: Option<String>,
    /// Must already be scrubbed and sampled.
    pub response_body_sample: Option<serde_json::Value>,
}

pub async fn finish(
    conn: &mut PgConnection,
    id: Uuid,
    finished: &FinishedSuotarApiCall,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE suotar_api_calls
SET http_status = $2,
  duration_ms = $3,
  succeeded = $4,
  ok_item_count = $5,
  error_item_count = $6,
  request_level_error_code = $7,
  error_message = $8,
  response_body_sample = $9,
  updated_at = now()
WHERE id = $1
        "#,
        id,
        finished.http_status,
        finished.duration_ms,
        finished.succeeded,
        finished.ok_item_count,
        finished.error_item_count,
        finished.request_level_error_code,
        finished.error_message,
        finished.response_body_sample,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Shortens an already-scrubbed body to what this table keeps: whole while the batch is small,
/// then the leading items plus the count, then nothing but the measurements.
pub fn sample_body(value: &serde_json::Value) -> serde_json::Value {
    let sampled = match value.as_array() {
        Some(items) if items.len() > FULL_BODY_ITEM_LIMIT => serde_json::json!({
            "items": &items[..SAMPLED_BODY_ITEM_COUNT],
            "totalItemCount": items.len(),
        }),
        _ => value.clone(),
    };
    let byte_count = serde_json::to_vec(&sampled)
        .map(|bytes| bytes.len())
        .unwrap_or(usize::MAX);
    if byte_count <= BODY_SAMPLE_MAX_BYTES {
        return sampled;
    }
    serde_json::json!({ "omitted": "over the sample size limit", "byteCount": byte_count })
}

/// Audits every [`headless_lms_utils::services::suotar::SuotarClient`] call.
///
/// Owns a pool rather than borrowing the caller's connection: the row has to be committed while the
/// request is still in flight, and it has to survive whatever the caller's transaction does next.
pub struct PgSuotarCallAudit {
    pool: PgPool,
}

impl PgSuotarCallAudit {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SuotarCallAudit for PgSuotarCallAudit {
    async fn started(&self, started: SuotarCallStarted) -> Option<Uuid> {
        let new = NewSuotarApiCall {
            endpoint: started.endpoint.into(),
            request_item_count: started.request_item_count.try_into().unwrap_or(i32::MAX),
            http_status: None,
            duration_ms: None,
            succeeded: false,
            ok_item_count: 0,
            error_item_count: 0,
            request_level_error_code: None,
            error_message: None,
            request_body_sample: Some(sample_body(&scrub_suotar_body(&started.request_body))),
            response_body_sample: None,
            credit_registration_ids: started.credit_registration_ids,
            worker_name: started.worker_name,
            started_at: started.started_at,
        };
        let mut conn = match self.pool.acquire().await {
            Ok(conn) => conn,
            Err(error) => {
                error!("Could not open a connection for a suotar_api_calls row: {error}");
                return None;
            }
        };
        match insert(&mut conn, &new).await {
            Ok(id) => Some(id),
            Err(error) => {
                error!("Could not insert a suotar_api_calls row: {error}");
                None
            }
        }
    }

    async fn finished(&self, call_id: Uuid, finished: SuotarCallFinished) {
        let finished = FinishedSuotarApiCall {
            http_status: finished.http_status.map(i32::from),
            duration_ms: Some(finished.duration.as_millis().try_into().unwrap_or(i32::MAX)),
            succeeded: finished.succeeded,
            ok_item_count: finished.ok_item_count.try_into().unwrap_or(i32::MAX),
            error_item_count: finished.error_item_count.try_into().unwrap_or(i32::MAX),
            request_level_error_code: finished.request_level_error_code,
            error_message: finished.error_message.map(|message| scrub_text(&message)),
            response_body_sample: finished
                .response_body
                .map(|body| sample_body(&scrub_suotar_body(&body))),
        };
        let mut conn = match self.pool.acquire().await {
            Ok(conn) => conn,
            Err(error) => {
                error!(
                    "Could not open a connection to complete suotar_api_calls {call_id}: {error}"
                );
                return;
            }
        };
        if let Err(error) = finish(&mut conn, call_id, &finished).await {
            error!("Could not complete suotar_api_calls {call_id}: {error}");
        }
    }
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
