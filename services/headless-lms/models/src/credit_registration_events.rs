//! Append-only audit trail for the credit registration ledger.
//!
//! Nothing in this table has a retention sweep, which is exactly why every Suotar payload written
//! here goes through [`scrub_suotar_body`] first. Scrubbing happens at every write site, never at
//! read time: redacting on read would leave the raw values on disk.
use std::sync::LazyLock;

use regex::{Captures, Regex};
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

/// Keys whose values the value scan must leave alone.
///
/// These are the fields debugging actually needs and none of them identifies a person on its own.
/// They are exempted from the scan rather than just from key redaction because they carry
/// identifiers that look like student numbers: `cr-{uuid}` request item ids and Sisu ids such as
/// `hy-CUR-135176012` would otherwise be mangled into uselessness.
///
/// Container keys do not belong here: an exemption stops at the objects below it, so a key listed only
/// to shield its children buys nothing and hides the intent.
const NEVER_SCANNED_KEYS: &[&str] = &[
    "requestitemid",
    "code",
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

/// A student-number-shaped run of digits, with the UUID shape listed first so that an id quoted in
/// free text matches whole and is passed through by [`scrub_free_text`] instead of losing its
/// 12-digit tail. The `regex` crate has no lookaround, so an alternation read leftmost-first is the
/// only way to say "digits that are not part of a UUID". The word boundaries keep the digit branch
/// from eating part of a longer number such as a millisecond timestamp.
static STUDENT_NUMBER_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?P<uuid>\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b)|(?P<digits>\b[0-9]{6,12}\b)",
    )
    .expect("hardcoded regex")
});

/// Best-effort removal of personal data from a Suotar request or response body. Not a guarantee, and
/// not an exhaustive PII filter.
///
/// Every value is treated according to the key directly above it, one of:
///
/// - `REDACTED_KEYS` — student number, names, emails, person ids, access tokens. The value is replaced
///   by `[redacted]` whatever its shape.
/// - `NEVER_SCANNED_KEYS` — request item ids, codes, grade, credit and attainment fields. Passed
///   through verbatim, because these carry the digit runs the value scan would otherwise mangle.
/// - anything else — scanned as free text for email addresses and student-number-shaped digit runs.
///
/// A key's treatment covers its own scalar value and the scalars of an array under it, so a list of ids
/// survives whole. An object is always classified again key by key on the way down, so an exemption
/// never spreads over a subtree — the per-item error objects Suotar nests under id keys are exactly
/// where its messages quote the input back.
///
/// Two mechanisms, because either alone leaks. Key matching removes the structured person fields. The
/// value scan is the backstop: Suotar's error messages quote the input, so key matching alone leaks
/// through `error.message`, and a field they add tomorrow is covered before the key list catches up. A
/// deny-by-default allow-list is deliberately not used — a payload that turns into `[redacted]`
/// everywhere the moment Suotar adds a field is useless.
///
/// What the value scan removes is limited to what is cheap and reliable to recognise: email addresses
/// and student-number-shaped digit runs. A personal name in free text is deliberately left in place —
/// no pattern separates `Aada Virtanen` from ordinary error prose, and the study registry holds the
/// name regardless. Names arriving under one of the known person keys are still redacted, because
/// there the match is exact.
pub fn scrub_suotar_body(value: &Value) -> Value {
    scrub(value)
}

/// What happens to the value under a key.
enum KeyPolicy {
    /// Replaced by [`REDACTED`], subtree and all: over-redacting a person field is the safe direction.
    FullyRedact,
    /// Passed through verbatim, except for objects, which are classified by their own keys.
    NeverScan,
    /// The default, for every key nobody has an opinion about.
    ScanFreeText,
}

fn key_policy(key: &str) -> KeyPolicy {
    let normalized = normalize_key(key);
    if REDACTED_KEYS.contains(&normalized.as_str()) {
        KeyPolicy::FullyRedact
    } else if NEVER_SCANNED_KEYS.contains(&normalized.as_str()) {
        KeyPolicy::NeverScan
    } else {
        KeyPolicy::ScanFreeText
    }
}

fn scrub(value: &Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, child)| {
                    let scrubbed = match key_policy(key) {
                        KeyPolicy::FullyRedact => json!(REDACTED),
                        KeyPolicy::NeverScan => keep_scalars(child),
                        KeyPolicy::ScanFreeText => scrub(child),
                    };
                    (key.clone(), scrubbed)
                })
                .collect(),
        ),
        Value::Array(items) => Value::Array(items.iter().map(scrub).collect()),
        Value::String(text) => Value::String(scrub_free_text(text)),
        other => other.clone(),
    }
}

/// Keeps the ids an exempt key holds, whether bare or in a list, but hands any object back to [`scrub`]
/// so that an exemption cannot smuggle a nested error message past the value scan.
fn keep_scalars(value: &Value) -> Value {
    match value {
        Value::Object(_) => scrub(value),
        Value::Array(items) => Value::Array(items.iter().map(keep_scalars).collect()),
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
        .replace_all(&without_emails, |captures: &Captures| {
            // The uuid branch exists only to claim the match before the digit branch can bite off a
            // UUID group, so it is put back unchanged.
            if captures.name("digits").is_some() {
                REDACTED.to_string()
            } else {
                captures[0].to_string()
            }
        })
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
    fn a_never_scanned_key_covers_the_ids_in_a_list_under_it() {
        let body = json!({ "enrolmentId": ["hy-CUR-135176012", "hy-CUR-135176013"] });
        assert_eq!(scrub_suotar_body(&body), body);

        // An object in that list is classified by its own keys, so the exemption does not reach the
        // quoted student number.
        let mixed = json!({
            "code": ["hy-CUR-135176012", { "message": "Person 012345678 not found" }],
        });
        assert_eq!(
            scrub_suotar_body(&mixed),
            json!({
                "code": [
                    "hy-CUR-135176012",
                    { "message": format!("Person {REDACTED} not found") },
                ],
            })
        );
    }

    #[test]
    fn a_redacted_key_takes_its_whole_value_with_it() {
        // Over-redacting a person field costs debuggability; under-redacting one is a permanent leak.
        let scrubbed = scrub_suotar_body(&json!({
            "firstNames": ["Aada", "Maria"],
            "personId": { "value": "hy-hlo-1" },
        }));
        assert_eq!(
            scrubbed,
            json!({ "firstNames": REDACTED, "personId": REDACTED })
        );
    }

    #[test]
    fn value_scan_reaches_inside_a_never_scanned_key() {
        // Suotar hangs per-item errors off `status`, and the exemption is only for that key's own
        // scalar value, so the quoted student number and address below still have to go.
        let scrubbed = scrub_suotar_body(&json!({
            "items": [{
                "status": {
                    "code": "personNotFound",
                    "message": "Person 012345678 (aada@helsinki.fi) not found",
                },
            }],
        }));
        assert_eq!(
            scrubbed,
            json!({
                "items": [{
                    "status": {
                        "code": "personNotFound",
                        "message": format!("Person {REDACTED} ({REDACTED}) not found"),
                    },
                }],
            })
        );
    }

    #[test]
    fn value_scan_keeps_request_item_ids_quoted_in_free_text_whole() {
        // The last UUID group is 12 digits, so a naive digit-run scan eats it and the per-item
        // drill-down loses the only mapping from the message back to a ledger row.
        let body = json!({ "message": "item cr-2a4b0d6e-0000-4000-8000-000000000001 rejected" });
        assert_eq!(scrub_suotar_body(&body), body);

        // An all-digit first group must not tip the alternation into the digit branch.
        let numeric = json!({ "message": "item 12345678-1234-4321-8765-123456789012 rejected" });
        assert_eq!(scrub_suotar_body(&numeric), numeric);

        // A student number that merely sits next to a hyphen is not a UUID and still goes.
        let adjacent = json!({ "message": "person-012345678 not found" });
        assert_eq!(
            scrub_suotar_body(&adjacent),
            json!({ "message": format!("person-{REDACTED} not found") })
        );
    }

    #[test]
    fn free_text_names_are_deliberately_kept() {
        // Best-effort by design: no pattern separates a name from error prose, and the study registry
        // holds the name anyway. Only the known person keys are redacted.
        let scrubbed = scrub_suotar_body(&json!({
            "errors": [{ "code": "personNotFound", "message": "No person matching Aada Maria Virtanen" }],
            "fullName": "Aada Maria Virtanen",
        }));
        assert_eq!(
            scrubbed,
            json!({
                "errors": [{ "code": "personNotFound", "message": "No person matching Aada Maria Virtanen" }],
                "fullName": REDACTED,
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
