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

/// Shortens an already-scrubbed body to what this table keeps: whole while the batch is small, then
/// the leading items plus a count, then nothing but the measurements.
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
/// Owns a pool rather than borrowing the caller's connection: the row is committed while the
/// request is in flight and must survive whatever the caller's transaction does next.
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

/// The narrowings the API log applies, all of them in SQL.
#[derive(Debug, Clone, Default)]
pub struct SuotarApiCallFilters {
    pub endpoint: Option<SuotarEndpoint>,
    pub succeeded: Option<bool>,
    /// The phase or manual action that made the call, matched exactly.
    pub worker_name: Option<String>,
    pub started_after: Option<DateTime<Utc>>,
    pub started_before: Option<DateTime<Utc>>,
    /// Searches the ledger rows a call covered, never the bodies: the bodies are scrubbed, so a
    /// student number is not in them to find.
    pub credit_registration_id: Option<Uuid>,
}

/// A call with the page's total attached, so a page and its count cannot come from two queries.
pub struct SuotarApiCallPageRow {
    pub call: SuotarApiCall,
    pub total_count: i64,
}

/// A page of the call log, newest first. Bodies come back exactly as stored, which is scrubbed.
pub async fn get_page(
    conn: &mut PgConnection,
    filters: &SuotarApiCallFilters,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<SuotarApiCallPageRow>> {
    let rows = sqlx::query!(
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  endpoint AS "endpoint!: SuotarEndpoint",
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
  started_at,
  COUNT(*) OVER () AS "total_count!"
FROM suotar_api_calls
WHERE deleted_at IS NULL
  AND (
    $1::suotar_endpoint IS NULL
    OR endpoint = $1
  )
  AND ($2::bool IS NULL OR succeeded = $2)
  AND ($3::text IS NULL OR worker_name = $3)
  AND ($4::timestamptz IS NULL OR started_at >= $4)
  AND ($5::timestamptz IS NULL OR started_at <= $5)
  AND (
    $6::uuid IS NULL
    OR credit_registration_ids @> ARRAY [$6::uuid]
  )
ORDER BY started_at DESC,
  id
LIMIT $7 OFFSET $8
        "#,
        filters.endpoint as Option<SuotarEndpoint>,
        filters.succeeded,
        filters.worker_name.as_deref(),
        filters.started_after,
        filters.started_before,
        filters.credit_registration_id,
        limit,
        offset,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| SuotarApiCallPageRow {
            total_count: row.total_count,
            call: SuotarApiCall {
                id: row.id,
                created_at: row.created_at,
                updated_at: row.updated_at,
                deleted_at: row.deleted_at,
                endpoint: row.endpoint,
                request_item_count: row.request_item_count,
                http_status: row.http_status,
                duration_ms: row.duration_ms,
                succeeded: row.succeeded,
                ok_item_count: row.ok_item_count,
                error_item_count: row.error_item_count,
                request_level_error_code: row.request_level_error_code,
                error_message: row.error_message,
                request_body_sample: row.request_body_sample,
                response_body_sample: row.response_body_sample,
                credit_registration_ids: row.credit_registration_ids,
                worker_name: row.worker_name,
                started_at: row.started_at,
            },
        })
        .collect())
}

/// The distinct `worker_name` values in the log, so the filter offers what exists rather than a
/// hardcoded list of phase names.
pub async fn get_worker_names(conn: &mut PgConnection) -> ModelResult<Vec<String>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT DISTINCT worker_name
FROM suotar_api_calls
WHERE deleted_at IS NULL
ORDER BY worker_name
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One endpoint's traffic over a window, one of possibly several computed together by
/// [`get_endpoint_stats_for_windows`].
///
/// `duration_ms IS NULL` means still in flight, since the row is inserted before the request
/// leaves; the counts below take finished calls only, or one in progress would read as a failure.
#[derive(Debug, Clone, PartialEq)]
pub struct SuotarEndpointStatsForWindow {
    pub window_secs: i64,
    pub endpoint: SuotarEndpoint,
    pub call_count: i64,
    pub failed_call_count: i64,
    pub in_flight_count: i64,
    pub ok_item_count: i64,
    pub error_item_count: i64,
    pub p50_duration_ms: Option<i32>,
    pub p95_duration_ms: Option<i32>,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_failure_at: Option<DateTime<Utc>>,
    pub last_request_level_error_code: Option<String>,
}

/// One scan of the table joined against the window list, so several windows cost one pass rather
/// than one full pass each. A single window is just a one-element `window_secs`.
pub async fn get_endpoint_stats_for_windows(
    conn: &mut PgConnection,
    window_secs: &[i64],
) -> ModelResult<Vec<SuotarEndpointStatsForWindow>> {
    let now = Utc::now();
    let window_secs = window_secs.to_vec();
    let since: Vec<DateTime<Utc>> = window_secs
        .iter()
        .map(|secs| now - chrono::Duration::seconds(*secs))
        .collect();
    let rows = sqlx::query_as!(
        SuotarEndpointStatsForWindow,
        r#"
WITH windows AS (
  SELECT * FROM UNNEST($1::bigint [], $2::timestamptz []) AS w(window_secs, since)
)
SELECT w.window_secs AS "window_secs!",
  c.endpoint,
  COUNT(*) FILTER (WHERE c.duration_ms IS NOT NULL) AS "call_count!",
  COUNT(*) FILTER (
    WHERE c.duration_ms IS NOT NULL
      AND NOT c.succeeded
  ) AS "failed_call_count!",
  COUNT(*) FILTER (WHERE c.duration_ms IS NULL) AS "in_flight_count!",
  COALESCE(SUM(c.ok_item_count), 0) AS "ok_item_count!",
  COALESCE(SUM(c.error_item_count), 0) AS "error_item_count!",
  PERCENTILE_DISC(0.5) WITHIN GROUP (
    ORDER BY c.duration_ms
  ) AS "p50_duration_ms",
  PERCENTILE_DISC(0.95) WITHIN GROUP (
    ORDER BY c.duration_ms
  ) AS "p95_duration_ms",
  MAX(c.started_at) FILTER (WHERE c.succeeded) AS "last_success_at",
  MAX(c.started_at) FILTER (
    WHERE c.duration_ms IS NOT NULL
      AND NOT c.succeeded
  ) AS "last_failure_at",
  (
    ARRAY_AGG(
      c.request_level_error_code
      ORDER BY c.started_at DESC
    ) FILTER (
      WHERE c.duration_ms IS NOT NULL
        AND NOT c.succeeded
        AND c.request_level_error_code IS NOT NULL
    )
  ) [1] AS "last_request_level_error_code"
FROM windows w
  JOIN suotar_api_calls c ON c.started_at >= w.since
  AND c.deleted_at IS NULL
GROUP BY w.window_secs,
  c.endpoint
        "#,
        &window_secs,
        &since,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// Where one endpoint stands right now.
#[derive(Debug, Clone, PartialEq)]
pub struct SuotarEndpointStanding {
    pub endpoint: SuotarEndpoint,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_failure_at: Option<DateTime<Utc>>,
    /// Finished failures since the last success, within the retention window.
    pub consecutive_failures: i64,
}

/// Bounded to the last [`RETENTION_DAYS`]: this table grows one row per Suotar batch call, and the
/// Overview and the health tab each poll this every 30 seconds.
pub async fn get_endpoint_standings(
    conn: &mut PgConnection,
) -> ModelResult<Vec<SuotarEndpointStanding>> {
    let since = Utc::now() - chrono::Duration::days(RETENTION_DAYS);
    let rows = sqlx::query_as!(
        SuotarEndpointStanding,
        r#"
WITH last_success AS (
  SELECT endpoint,
    MAX(started_at) AS at
  FROM suotar_api_calls
  WHERE succeeded
    AND started_at >= $1
    AND deleted_at IS NULL
  GROUP BY endpoint
)
SELECT c.endpoint AS "endpoint!: SuotarEndpoint",
  ls.at AS "last_success_at",
  MAX(c.started_at) FILTER (
    WHERE c.duration_ms IS NOT NULL
      AND NOT c.succeeded
  ) AS "last_failure_at",
  COUNT(*) FILTER (
    WHERE c.duration_ms IS NOT NULL
      AND NOT c.succeeded
      AND (
        ls.at IS NULL
        OR c.started_at > ls.at
      )
  ) AS "consecutive_failures!"
FROM suotar_api_calls c
  LEFT JOIN last_success ls ON ls.endpoint = c.endpoint
WHERE c.started_at >= $1
  AND c.deleted_at IS NULL
GROUP BY c.endpoint,
  ls.at
        "#,
        since,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// A run of failures the health rules key on.
#[derive(Debug, Clone, PartialEq)]
pub struct SuotarFailureRun {
    pub count: i64,
    pub last_at: Option<DateTime<Utc>>,
}

/// Calls Suotar refused our credentials on. One is enough to stop everything registering.
pub async fn count_credential_rejections_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<SuotarFailureRun> {
    let row = sqlx::query_as!(
        SuotarFailureRun,
        r#"
SELECT COUNT(*) AS "count!",
  MAX(started_at) AS "last_at"
FROM suotar_api_calls
WHERE started_at >= $1
  AND deleted_at IS NULL
  AND (
    http_status IN (401, 403)
    OR request_level_error_code = 'unauthorized'
  )
        "#,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(row)
}

/// The unbroken run of "Suotar did not answer usefully" at the end of the window. A transport
/// failure carries no HTTP status, which is how it is told from a refusal Suotar composed itself.
pub async fn count_unreachable_run_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<SuotarFailureRun> {
    let row = sqlx::query_as!(
        SuotarFailureRun,
        r#"
WITH last_success AS (
  SELECT MAX(started_at) AS at
  FROM suotar_api_calls
  WHERE succeeded
    AND started_at >= $1
    AND deleted_at IS NULL
)
SELECT COUNT(*) AS "count!",
  MAX(c.started_at) AS "last_at"
FROM suotar_api_calls c
  CROSS JOIN last_success ls
WHERE c.started_at >= $1
  AND c.deleted_at IS NULL
  AND c.duration_ms IS NOT NULL
  AND NOT c.succeeded
  AND (
    c.http_status IS NULL
    OR c.http_status >= 500
  )
  AND (
    ls.at IS NULL
    OR c.started_at > ls.at
  )
        "#,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(row)
}

/// Hard-deletes rows past the retention window: the stored bodies must stop existing.
///
/// Bounded, because the first sweep after the window opens has ninety days of traffic to clear and
/// one unbounded statement would hold every `credit_registration_events` row referencing them
/// locked while `ON DELETE SET NULL` fires. Returns how many were deleted, so the caller can tell a
/// finished sweep from one that hit the bound.
pub async fn delete_older_than(
    conn: &mut PgConnection,
    cutoff: DateTime<Utc>,
    limit: i64,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
DELETE FROM suotar_api_calls
WHERE id IN (
    SELECT id
    FROM suotar_api_calls
    WHERE started_at < $1
    ORDER BY started_at
    LIMIT $2
  )
        "#,
        cutoff,
        limit,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}
