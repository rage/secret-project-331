//! Append-only audit trail for the credit registration ledger.
//!
//! No retention sweep touches this table, so every Suotar payload must go through
//! [`scrub_suotar_body`](crate::credit_registration_policy::scrub::scrub_suotar_body) at the
//! write site — redacting on read would leave the raw values on disk.
use std::collections::HashMap;

use serde_json::Value;
use utoipa::ToSchema;

use crate::credit_registrations::{CreditRegistrationErrorCode, CreditRegistrationState};
use crate::prelude::*;
use crate::suotar_api_calls::SuotarEndpoint;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(
    type_name = "credit_registration_event_kind",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationEventKind {
    Created,
    StateChanged,
    SuotarResponse,
    RetryScheduled,
    AdminAction,
    StudentAction,
    Cancelled,
}

/// What Suotar did with one row of a request.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(type_name = "suotar_answer", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SuotarAnswer {
    Answered,
    /// Suotar answered the request but left this row out.
    Unanswered,
    /// Suotar refused the whole request, or it never got there.
    Refused,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationEvent {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub credit_registration_id: Uuid,
    pub kind: CreditRegistrationEventKind,
    pub from_state: Option<CreditRegistrationState>,
    pub to_state: Option<CreditRegistrationState>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub message: Option<String>,
    pub suotar_api_call_id: Option<Uuid>,
    pub actor_user_id: Option<Uuid>,
    pub details: Option<Value>,
    /// The requestItemId the row went out under in the call behind this event.
    pub request_item_id: Option<String>,
    /// Outlives `suotar_api_call_id`, whose call row is swept after 90 days.
    pub suotar_endpoint: Option<SuotarEndpoint>,
    pub suotar_requested_at: Option<DateTime<Utc>>,
    /// Orders the timeline where set: events written in one transaction share `created_at`.
    pub suotar_answered_at: Option<DateTime<Utc>>,
    pub suotar_answer: Option<SuotarAnswer>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewCreditRegistrationEvent {
    pub credit_registration_id: Uuid,
    pub kind: CreditRegistrationEventKind,
    pub from_state: Option<CreditRegistrationState>,
    pub to_state: Option<CreditRegistrationState>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub message: Option<String>,
    pub suotar_api_call_id: Option<Uuid>,
    pub actor_user_id: Option<Uuid>,
    /// Build with
    /// [`suotar_exchange_details`](crate::credit_registration_policy::scrub::suotar_exchange_details)
    /// so it is scrubbed.
    pub details: Option<Value>,
    pub request_item_id: Option<String>,
    pub suotar_endpoint: Option<SuotarEndpoint>,
    pub suotar_requested_at: Option<DateTime<Utc>>,
    pub suotar_answered_at: Option<DateTime<Utc>>,
    pub suotar_answer: Option<SuotarAnswer>,
}

impl NewCreditRegistrationEvent {
    pub fn new(credit_registration_id: Uuid, kind: CreditRegistrationEventKind) -> Self {
        Self {
            credit_registration_id,
            kind,
            from_state: None,
            to_state: None,
            error_code: None,
            message: None,
            suotar_api_call_id: None,
            actor_user_id: None,
            details: None,
            request_item_id: None,
            suotar_endpoint: None,
            suotar_requested_at: None,
            suotar_answered_at: None,
            suotar_answer: None,
        }
    }
}

/// Callers that also change `state` must go through `credit_registrations::transition` instead,
/// which writes both in one transaction.
pub async fn insert(
    conn: &mut PgConnection,
    new: &NewCreditRegistrationEvent,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO credit_registration_events (
    credit_registration_id,
    kind,
    from_state,
    to_state,
    error_code,
    message,
    suotar_api_call_id,
    actor_user_id,
    details,
    request_item_id,
    suotar_endpoint,
    suotar_requested_at,
    suotar_answered_at,
    suotar_answer
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING id
        "#,
        new.credit_registration_id,
        new.kind as CreditRegistrationEventKind,
        new.from_state as Option<CreditRegistrationState>,
        new.to_state as Option<CreditRegistrationState>,
        new.error_code as Option<CreditRegistrationErrorCode>,
        new.message,
        new.suotar_api_call_id,
        new.actor_user_id,
        new.details,
        new.request_item_id,
        new.suotar_endpoint as Option<SuotarEndpoint>,
        new.suotar_requested_at,
        new.suotar_answered_at,
        new.suotar_answer as Option<SuotarAnswer>,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Appends one event per element, in one statement. The column list is [`insert`]'s, so a batch
/// writes the same rows a loop would.
pub async fn insert_batch(
    conn: &mut PgConnection,
    events: &[NewCreditRegistrationEvent],
) -> ModelResult<()> {
    if events.is_empty() {
        return Ok(());
    }
    let ids: Vec<Uuid> = events.iter().map(|e| e.credit_registration_id).collect();
    let kinds: Vec<CreditRegistrationEventKind> = events.iter().map(|e| e.kind).collect();
    let from_states: Vec<Option<CreditRegistrationState>> =
        events.iter().map(|e| e.from_state).collect();
    let to_states: Vec<Option<CreditRegistrationState>> =
        events.iter().map(|e| e.to_state).collect();
    let error_codes: Vec<Option<CreditRegistrationErrorCode>> =
        events.iter().map(|e| e.error_code).collect();
    let messages: Vec<Option<String>> = events.iter().map(|e| e.message.clone()).collect();
    let call_ids: Vec<Option<Uuid>> = events.iter().map(|e| e.suotar_api_call_id).collect();
    let actors: Vec<Option<Uuid>> = events.iter().map(|e| e.actor_user_id).collect();
    let details: Vec<Option<Value>> = events.iter().map(|e| e.details.clone()).collect();
    let request_item_ids: Vec<Option<String>> =
        events.iter().map(|e| e.request_item_id.clone()).collect();
    let endpoints: Vec<Option<SuotarEndpoint>> = events.iter().map(|e| e.suotar_endpoint).collect();
    let requested_ats: Vec<Option<DateTime<Utc>>> =
        events.iter().map(|e| e.suotar_requested_at).collect();
    let answered_ats: Vec<Option<DateTime<Utc>>> =
        events.iter().map(|e| e.suotar_answered_at).collect();
    let answers: Vec<Option<SuotarAnswer>> = events.iter().map(|e| e.suotar_answer).collect();
    sqlx::query!(
        r#"
INSERT INTO credit_registration_events (
    credit_registration_id,
    kind,
    from_state,
    to_state,
    error_code,
    message,
    suotar_api_call_id,
    actor_user_id,
    details,
    request_item_id,
    suotar_endpoint,
    suotar_requested_at,
    suotar_answered_at,
    suotar_answer
  )
SELECT *
FROM UNNEST(
    $1::uuid [],
    $2::credit_registration_event_kind [],
    $3::credit_registration_state [],
    $4::credit_registration_state [],
    $5::credit_registration_error_code [],
    $6::text [],
    $7::uuid [],
    $8::uuid [],
    $9::jsonb [],
    $10::text [],
    $11::suotar_endpoint [],
    $12::timestamptz [],
    $13::timestamptz [],
    $14::suotar_answer []
  )
        "#,
        &ids,
        &kinds as &[CreditRegistrationEventKind],
        &from_states as &[Option<CreditRegistrationState>],
        &to_states as &[Option<CreditRegistrationState>],
        &error_codes as &[Option<CreditRegistrationErrorCode>],
        &messages as &[Option<String>],
        &call_ids as &[Option<Uuid>],
        &actors as &[Option<Uuid>],
        &details as &[Option<Value>],
        &request_item_ids as &[Option<String>],
        &endpoints as &[Option<SuotarEndpoint>],
        &requested_ats as &[Option<DateTime<Utc>>],
        &answered_ats as &[Option<DateTime<Utc>>],
        &answers as &[Option<SuotarAnswer>],
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Appends the same event to many rows in one round trip; [`insert_batch`] for events that differ.
pub async fn insert_many(
    conn: &mut PgConnection,
    credit_registration_ids: &[Uuid],
    kind: CreditRegistrationEventKind,
    actor_user_id: Option<Uuid>,
    message: Option<&str>,
) -> ModelResult<()> {
    if credit_registration_ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        r#"
INSERT INTO credit_registration_events (credit_registration_id, kind, actor_user_id, message)
SELECT id, $2, $3, $4
FROM UNNEST($1::uuid []) AS id
        "#,
        credit_registration_ids,
        kind as CreditRegistrationEventKind,
        actor_user_id,
        message,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The per-item timeline, newest first.
pub async fn get_by_registration_id(
    conn: &mut PgConnection,
    credit_registration_id: Uuid,
) -> ModelResult<Vec<CreditRegistrationEvent>> {
    let res = sqlx::query_as!(
        CreditRegistrationEvent,
        r#"
SELECT *
FROM credit_registration_events
WHERE credit_registration_id = $1
  AND deleted_at IS NULL
ORDER BY COALESCE(suotar_answered_at, created_at) DESC,
  id DESC
        "#,
        credit_registration_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The per-item timeline entries one study registry call produced, oldest first: what the answer
/// did to each row it covered.
pub async fn get_by_suotar_api_call_id(
    conn: &mut PgConnection,
    suotar_api_call_id: Uuid,
) -> ModelResult<Vec<CreditRegistrationEvent>> {
    let res = sqlx::query_as!(
        CreditRegistrationEvent,
        r#"
SELECT *
FROM credit_registration_events
WHERE suotar_api_call_id = $1
  AND deleted_at IS NULL
ORDER BY COALESCE(suotar_answered_at, created_at),
  id
        "#,
        suotar_api_call_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The requestItemId each of `credit_registration_ids` went out under among `request_item_ids`,
/// which are one call's. A row the call carried but no event recorded is missing from the map.
pub async fn get_request_item_ids_in_call(
    conn: &mut PgConnection,
    credit_registration_ids: &[Uuid],
    request_item_ids: &[String],
) -> ModelResult<HashMap<Uuid, String>> {
    let rows = sqlx::query!(
        r#"
SELECT DISTINCT ON (credit_registration_id) credit_registration_id,
  request_item_id AS "request_item_id!"
FROM credit_registration_events
WHERE credit_registration_id = ANY($1)
  AND request_item_id = ANY($2)
  AND deleted_at IS NULL
ORDER BY credit_registration_id,
  COALESCE(suotar_answered_at, created_at),
  id
        "#,
        credit_registration_ids,
        request_item_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.credit_registration_id, row.request_item_id))
        .collect())
}

/// The attainment the study registry pointed at when it turned a submission down as no improvement.
///
/// Read back off the event the answer was recorded on rather than stored on the ledger row: the row
/// holds what we sent, and this is what the registry already had.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct NotImprovedAttainment {
    pub grade_id: Option<String>,
    /// Names the scale `grade_id` is on, without which "1" reads as a one out of five when it means
    /// a pass.
    pub grade_scale_id: Option<String>,
}

/// The registry's verdict for a row it declined as no improvement. `None` for every other row, and
/// for one whose answer named no attainment.
pub async fn get_not_improved_attainment(
    conn: &mut PgConnection,
    credit_registration_id: Uuid,
) -> ModelResult<Option<NotImprovedAttainment>> {
    let found = sqlx::query_scalar!(
        r#"
SELECT details #> '{response,result,previousAttainment}' AS "attainment!"
FROM credit_registration_events
WHERE credit_registration_id = $1
  AND to_state = 'not_improved'
  AND details #> '{response,result,previousAttainment}' IS NOT NULL
  AND deleted_at IS NULL
ORDER BY COALESCE(suotar_answered_at, created_at) DESC,
  id DESC
LIMIT 1
        "#,
        credit_registration_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(found.map(|attainment| NotImprovedAttainment {
        grade_id: string_field(&attainment, "gradeId"),
        grade_scale_id: string_field(&attainment, "gradeScaleId"),
    }))
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    Some(value.get(key)?.as_str()?.to_string())
}

/// How the study registry answered the items it was asked about in a window.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct SuotarItemOutcomeTotals {
    pub item_count: i64,
    /// Items that failed on Suotar or Sisu being down or slow, the only proxy we have for Sisu's
    /// uptime.
    pub service_unavailable_count: i64,
    pub last_service_unavailable_at: Option<DateTime<Utc>>,
}

/// Per-item outcomes in `[since, now)`, counted over events rather than rows: an item that failed
/// really failed, whatever its row has since become.
pub async fn count_item_outcomes_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<SuotarItemOutcomeTotals> {
    let res = sqlx::query_as!(
        SuotarItemOutcomeTotals,
        r#"
SELECT COUNT(*) AS "item_count!",
  COUNT(*) FILTER (
    WHERE error_code IN ('service_temporarily_unavailable', 'sisu_timeout')
  ) AS "service_unavailable_count!",
  MAX(created_at) FILTER (
    WHERE error_code IN ('service_temporarily_unavailable', 'sisu_timeout')
  ) AS "last_service_unavailable_at"
FROM credit_registration_events
WHERE kind = 'suotar_response'
  AND created_at >= $1
  AND deleted_at IS NULL
        "#,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// One error code's standing over a window and the window before it.
#[derive(Debug, Clone, PartialEq)]
pub struct ErrorCodeWindowCounts {
    pub error_code: CreditRegistrationErrorCode,
    pub current_count: i64,
    /// The equally long window immediately before, which is what a spike is measured against.
    pub previous_count: i64,
    pub user_count: i64,
    pub course_count: i64,
    pub first_seen_at: Option<DateTime<Utc>>,
    pub last_seen_at: Option<DateTime<Utc>>,
    /// The endpoints the code arrived on, empty for one recorded without a call of ours.
    pub endpoints: Vec<SuotarEndpoint>,
}

/// Error events per code over `[now - 2 * window, now)`, split at `now - window`.
///
/// Counts events, so errors on attempts since superseded are included: an `invalid_credits` on
/// attempt 1 is the configuration bug, whether or not attempt 2 succeeded.
pub async fn get_error_code_counts_for_window(
    conn: &mut PgConnection,
    window_secs: i64,
) -> ModelResult<Vec<ErrorCodeWindowCounts>> {
    let res = sqlx::query_as!(
        ErrorCodeWindowCounts,
        r#"
SELECT e.error_code AS "error_code!: CreditRegistrationErrorCode",
  COUNT(*) FILTER (
    WHERE e.created_at > now() - MAKE_INTERVAL(secs => $1::double precision)
  ) AS "current_count!",
  COUNT(*) FILTER (
    WHERE e.created_at <= now() - MAKE_INTERVAL(secs => $1::double precision)
  ) AS "previous_count!",
  COUNT(DISTINCT cr.user_id) AS "user_count!",
  COUNT(DISTINCT cr.course_id) AS "course_count!",
  MIN(e.created_at) AS "first_seen_at",
  MAX(e.created_at) AS "last_seen_at",
  COALESCE(
    ARRAY_AGG(DISTINCT call.endpoint) FILTER (
      WHERE call.endpoint IS NOT NULL
    ),
    '{}'
  ) AS "endpoints!: Vec<SuotarEndpoint>"
FROM credit_registration_events e
  JOIN credit_registrations cr ON cr.id = e.credit_registration_id
  LEFT JOIN suotar_api_calls call ON call.id = e.suotar_api_call_id
  AND call.deleted_at IS NULL
WHERE e.error_code IS NOT NULL
  AND e.created_at > now() - MAKE_INTERVAL(secs => $1::double precision * 2)
  AND e.deleted_at IS NULL
  AND cr.deleted_at IS NULL
GROUP BY e.error_code
ORDER BY 2 DESC
        "#,
        window_secs as f64,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Registrations whose answers named more than one submitted attainment id, which is the shape a
/// double submission would leave behind.
///
/// Per registration, not per completion: a grade improvement is a second registration row and a
/// second attainment on purpose.
pub async fn get_ids_with_several_submitted_attainments(
    conn: &mut PgConnection,
    limit: i64,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT credit_registration_id
FROM credit_registration_events
WHERE details #>> '{response,submittedAttainmentId}' IS NOT NULL
  AND deleted_at IS NULL
GROUP BY credit_registration_id
HAVING COUNT(
    DISTINCT details #>> '{response,submittedAttainmentId}'
  ) > 1
LIMIT $1
        "#,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
