//! Append-only audit trail for the credit registration ledger.
//!
//! Nothing in this table has a retention sweep, which is exactly why every Suotar payload written
//! here goes through [`scrub_suotar_body`] first. Scrubbing happens at every write site, never at
//! read time: redacting on read would leave the raw values on disk.
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Value, json};
use utoipa::ToSchema;

use crate::credit_registrations::{CreditRegistrationErrorCode, CreditRegistrationState};
use crate::prelude::*;

/// The placeholder a redacted value is replaced with. The key is kept so the payload shape, which is
/// what one actually debugs, survives.
pub const REDACTED: &str = "[redacted]";

/// Keys whose values identify a person or authenticate a request. Matched case-insensitively at any
/// depth.
const REDACTED_KEYS: &[&str] = &[
    "studentnumber",
    "firstnames",
    "lastname",
    "fullname",
    "primaryemail",
    "secondaryemail",
    "email",
    "emailedto",
    "accesstoken",
    "personid",
    "sisupersonid",
];

/// Keys whose string values the value scan must leave alone.
///
/// These are the fields debugging actually needs and none of them identifies a person on its own.
/// They are exempted from the scan rather than just from key redaction because they carry
/// identifiers that look like student numbers: `cr-{uuid}` request item ids and Sisu ids such as
/// `hy-CUR-135176012` would otherwise be mangled into uselessness.
const NEVER_SCANNED_KEYS: &[&str] = &[
    "requestitemid",
    "code",
    "status",
    "coursecode",
    "enrolmentid",
    "gradescaleid",
    "gradeid",
    "credits",
    "attainmentdate",
    "attainmentlanguage",
    "submittedattainmentid",
    "attainmentid",
    "sisuattainmentid",
    "courseunitrealisationid",
    "openuniversityproductid",
];

static EMAIL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}").expect("hardcoded regex")
});

/// A student-number-shaped run of digits. The word boundaries keep it from eating part of a longer
/// number such as a millisecond timestamp.
static STUDENT_NUMBER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b[0-9]{6,12}\b").expect("hardcoded regex"));

/// Removes names, student numbers, email addresses and access tokens from a Suotar request or
/// response body.
///
/// Two mechanisms, because either alone leaks. Key matching handles the structured fields. The value
/// scan is the backstop: Suotar's error messages quote the input, so key matching alone leaks through
/// `error.message`, and a field they add tomorrow is covered before the key list catches up. A
/// deny-by-default allow-list is deliberately not used — a payload that turns into `[redacted]`
/// everywhere the moment Suotar adds a field is useless.
pub fn scrub_suotar_body(value: &Value) -> Value {
    scrub(value, true)
}

fn scrub(value: &Value, scan_strings: bool) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, child)| {
                    let normalized = normalize_key(key);
                    if REDACTED_KEYS.contains(&normalized.as_str()) {
                        (key.clone(), json!(REDACTED))
                    } else {
                        let scan_child =
                            scan_strings && !NEVER_SCANNED_KEYS.contains(&normalized.as_str());
                        (key.clone(), scrub(child, scan_child))
                    }
                })
                .collect(),
        ),
        Value::Array(items) => {
            Value::Array(items.iter().map(|item| scrub(item, scan_strings)).collect())
        }
        Value::String(text) if scan_strings => Value::String(scrub_free_text(text)),
        other => other.clone(),
    }
}

fn normalize_key(key: &str) -> String {
    key.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

fn scrub_free_text(text: &str) -> String {
    let without_emails = EMAIL_RE.replace_all(text, REDACTED);
    STUDENT_NUMBER_RE
        .replace_all(&without_emails, REDACTED)
        .into_owned()
}

/// The `details` shape for a Suotar exchange: both sides, because the admin drill-down renders them
/// side by side and inferring the request from the ledger snapshot after a retry is guesswork.
///
/// Scrubs on construction, so there is no way to build an unscrubbed one.
pub fn suotar_exchange_details(request: Option<&Value>, response: Option<&Value>) -> Value {
    let mut details = serde_json::Map::new();
    if let Some(request) = request {
        details.insert("request".to_string(), scrub_suotar_body(request));
    }
    if let Some(response) = response {
        details.insert("response".to_string(), scrub_suotar_body(response));
    }
    Value::Object(details)
}

/// What kind of thing an event records.
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
    /// Build with [`suotar_exchange_details`] so it is scrubbed.
    pub details: Option<Value>,
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
        }
    }
}

/// Appends one event. Callers that also change `state` must go through
/// `credit_registrations::transition`, which writes both in one transaction.
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
    details
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
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
ORDER BY created_at DESC
        "#,
        credit_registration_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_recent_by_kind(
    conn: &mut PgConnection,
    kind: CreditRegistrationEventKind,
    limit: i64,
) -> ModelResult<Vec<CreditRegistrationEvent>> {
    let res = sqlx::query_as!(
        CreditRegistrationEvent,
        r#"
SELECT *
FROM credit_registration_events
WHERE kind = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2
        "#,
        kind as CreditRegistrationEventKind,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_by_key_name_but_keeps_the_key() {
        let scrubbed = scrub_suotar_body(&json!({
            "studentNumber": "012345678",
            "firstNames": "Aada Maria",
            "lastName": "Virtanen",
            "primaryEmail": "aada@helsinki.fi",
            "accessToken": "abc123",
            "personId": "hy-hlo-1",
        }));
        assert_eq!(
            scrubbed,
            json!({
                "studentNumber": REDACTED,
                "firstNames": REDACTED,
                "lastName": REDACTED,
                "primaryEmail": REDACTED,
                "accessToken": REDACTED,
                "personId": REDACTED,
            })
        );
    }

    #[test]
    fn keeps_the_fields_debugging_needs() {
        // The digit runs in a request item id and a Sisu id are student-number shaped; the value scan
        // must not touch them or the drill-down loses the only way back to the ledger row.
        let body = json!({
            "requestItemId": "cr-2a4b0d6e-0000-4000-8000-000000000001",
            "code": "sent",
            "status": "ok",
            "courseCode": "AYTKT21018",
            "enrolmentId": "hy-CUR-135176012",
            "gradeScaleId": "sis-0-5",
            "gradeId": "4",
            "credits": 5.0,
            "attainmentDate": "2026-07-30",
            "attainmentLanguage": "fi",
            "submittedAttainmentId": "hy-att-1",
        });
        assert_eq!(scrub_suotar_body(&body), body);
    }

    #[test]
    fn redacts_recursively_through_objects_and_arrays() {
        let scrubbed = scrub_suotar_body(&json!({
            "items": [
                { "person": { "studentNumber": "012345678" }, "code": "ok" },
                { "person": { "studentNumber": "012345679" }, "code": "ok" },
            ]
        }));
        assert_eq!(
            scrubbed,
            json!({
                "items": [
                    { "person": { "studentNumber": REDACTED }, "code": "ok" },
                    { "person": { "studentNumber": REDACTED }, "code": "ok" },
                ]
            })
        );
    }

    #[test]
    fn matches_keys_case_insensitively_and_across_naming_styles() {
        let scrubbed = scrub_suotar_body(&json!({
            "STUDENT_NUMBER": "012345678",
            "Student-Number": "012345678",
            "emailedTo": "aada@helsinki.fi",
        }));
        assert_eq!(
            scrubbed,
            json!({
                "STUDENT_NUMBER": REDACTED,
                "Student-Number": REDACTED,
                "emailedTo": REDACTED,
            })
        );
    }

    #[test]
    fn value_scan_catches_identifiers_quoted_in_free_text() {
        // Suotar error messages quote the input, so key-based redaction alone would leak here.
        let scrubbed = scrub_suotar_body(&json!({
            "message": "Person 012345678 (aada@helsinki.fi) has no accepted enrolment",
        }));
        assert_eq!(
            scrubbed,
            json!({
                "message": format!("Person {REDACTED} ({REDACTED}) has no accepted enrolment"),
            })
        );
    }

    #[test]
    fn value_scan_leaves_short_and_long_digit_runs_alone() {
        let body = json!({ "message": "code 404 after 1234567890123 ms" });
        assert_eq!(scrub_suotar_body(&body), body);
    }

    #[test]
    fn scrubbing_is_idempotent() {
        let body = json!({
            "studentNumber": "012345678",
            "message": "Person 012345678 not found",
        });
        let once = scrub_suotar_body(&body);
        assert_eq!(scrub_suotar_body(&once), once);
    }

    #[test]
    fn exchange_details_scrub_both_sides_and_omit_missing_ones() {
        let details = suotar_exchange_details(
            Some(&json!({ "studentNumber": "012345678" })),
            Some(&json!({ "code": "sent", "fullName": "Aada Virtanen" })),
        );
        assert_eq!(
            details,
            json!({
                "request": { "studentNumber": REDACTED },
                "response": { "code": "sent", "fullName": REDACTED },
            })
        );

        let request_only = suotar_exchange_details(Some(&json!({ "code": "x" })), None);
        assert_eq!(request_only, json!({ "request": { "code": "x" } }));
    }
}
