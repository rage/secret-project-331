//! Removing personal data from what the credit registration pipeline keeps: its error messages as
//! they are written, and the ledger's event details once they outlive the call log.

use serde_json::{Value, json};

pub use headless_lms_utils::text_scrub::{REDACTED, scrub_text};

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

/// Keys whose values the value scan must leave alone: they carry ids shaped like student numbers —
/// request item ids, Sisu ids such as `hy-CUR-135176012` — that the scan would mangle.
///
/// Container keys do not belong here: an exemption stops at the objects below it.
const NEVER_SCANNED_KEYS: &[&str] = &[
    "requestitemid",
    "code",
    "coursecode",
    "gradescaleid",
    "gradeid",
    "credits",
    "attainmentdate",
    "attainmentlanguage",
    "submittedattainmentid",
    "attainmentid",
    "sisuattainmentid",
    "courseunitrealisationid",
];

/// Best-effort removal of personal data from a Suotar request or response body. Not a guarantee and
/// not an exhaustive PII filter.
///
/// Two mechanisms, because either alone leaks: key matching removes the structured person fields,
/// and the free-text scan is the backstop for the input Suotar's error messages quote back. A key's
/// treatment covers its own scalar value and the scalars of an array under it, but objects are
/// always classified again key by key, so an exemption never spreads over a subtree.
///
/// The scan only removes email addresses and student-number-shaped digit runs. A name in free text
/// is kept: no pattern separates it from error prose, and the study registry holds it anyway.
pub fn scrub_suotar_body(value: &Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, child)| {
                    let scrubbed = match key_policy(key) {
                        KeyPolicy::FullyRedact => json!(REDACTED),
                        KeyPolicy::NeverScan => keep_scalars(child),
                        KeyPolicy::ScanFreeText => scrub_suotar_body(child),
                    };
                    (key.clone(), scrubbed)
                })
                .collect(),
        ),
        Value::Array(items) => Value::Array(items.iter().map(scrub_suotar_body).collect()),
        Value::String(text) => Value::String(scrub_text(text)),
        other => other.clone(),
    }
}

enum KeyPolicy {
    /// Replaced by [`REDACTED`], subtree and all.
    FullyRedact,
    /// Passed through verbatim, except for objects, which are classified by their own keys.
    NeverScan,
    /// The default.
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

/// Keeps bare ids and lists of ids, but hands objects back to [`scrub_suotar_body`] so an exemption
/// cannot smuggle a nested error message past the value scan.
fn keep_scalars(value: &Value) -> Value {
    match value {
        Value::Object(_) => scrub_suotar_body(value),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_by_key_name_but_keeps_the_key() {
        let scrubbed = scrub_suotar_body(&json!({
            "studentNumber": "012345678",
            "firstNames": "Aada Maria",
            "lastName": "Virtanen",
            "primaryEmail": "aada@example.com",
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
        // These ids carry student-number-shaped digit runs the value scan must not touch.
        let body = json!({
            "requestItemId": "2a4b0d6e-0000-4000-8000-000000000001",
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
            "emailedTo": "aada@example.com",
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
            "message": "Person 012345678 (aada@example.com) has no accepted enrolment",
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
        let body = json!({ "courseUnitRealisationId": ["hy-CUR-135176012", "hy-CUR-135176013"] });
        assert_eq!(scrub_suotar_body(&body), body);

        // An object in that list is classified by its own keys, so the exemption stops there.
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
        // Over-redacting a person field costs debuggability; under-redacting is a permanent leak.
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
        // Suotar hangs per-item errors off an exempt key; the exemption covers only its own scalar.
        let scrubbed = scrub_suotar_body(&json!({
            "items": [{
                "status": {
                    "code": "personNotFound",
                    "message": "Person 012345678 (aada@example.com) not found",
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
        // The last UUID group is 12 digits, so a naive digit-run scan would eat it.
        let body = json!({ "message": "item cr-2a4b0d6e-0000-4000-8000-000000000001 rejected" });
        assert_eq!(scrub_suotar_body(&body), body);

        // An all-digit first group must not tip the alternation into the digit branch.
        let numeric = json!({ "message": "item 12345678-1234-4321-8765-123456789012 rejected" });
        assert_eq!(scrub_suotar_body(&numeric), numeric);

        // A Sisu id is kept whole for the same reason, even though its tail is digits only.
        let sisu = json!({ "message": "enrolment hy-CUR-135176012 rejected" });
        assert_eq!(scrub_suotar_body(&sisu), sisu);

        // Accepted cost: a student number hyphen-joined to a word reads as a prefixed id and
        // survives. A bare run still goes, which is the shape Suotar sends.
        let adjacent = json!({ "message": "person-012345678 and 012345678 not found" });
        assert_eq!(
            scrub_suotar_body(&adjacent),
            json!({ "message": format!("person-012345678 and {REDACTED} not found") })
        );
    }

    #[test]
    fn free_text_names_are_deliberately_kept() {
        // No pattern separates a name from error prose; only the known person keys are redacted.
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
}
