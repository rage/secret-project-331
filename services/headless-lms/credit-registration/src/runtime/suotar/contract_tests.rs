//! The Suotar adapter against a mock Suotar: what each registry request puts on the wire, what each
//! wire answer comes back as, and what the gate makes of the exchange.

use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use headless_lms_base::config::SuotarConfiguration;
use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
use headless_lms_models::library::credit_registration::config_validation::CourseCodeVerdict;
use headless_lms_models::library::credit_registration::study_registry::RegistryErrorKind as Kind;
use headless_lms_utils::services::suotar::{NoSuotarCallAudit, SuotarClient};
use mockito::{Mock, ServerGuard};
use secrecy::ExposeSecret;
use serde_json::{Value, json};
use uuid::Uuid;

use super::breaker::{self, BreakerTarget};
use super::*;
use headless_lms_models::library::credit_registration::grade_mapping::MappedGrade;

use crate::registry::{
    AnsweredRow, AttainmentId, BatchEntry, Credits, EnrolmentReading, HeldCredit, PersonReading,
    RefusedFor, RefusedRow, SubmittedAttainmentRef, VerificationReading,
};

const ALL_UNAVAILABLE: &str = "Every item came back unavailable.";

type SentBodies = Arc<Mutex<Vec<Value>>>;

async fn suotar() -> (ServerGuard, SuotarClient) {
    let server = mockito::Server::new_async().await;
    let client = client_for(&server.url());
    (server, client)
}

fn client_for(base_url: &str) -> SuotarClient {
    let config = SuotarConfiguration::mock_conf(base_url).expect("mock Suotar url");
    SuotarClient::new_allowing_http(&config, Arc::new(NoSuotarCallAudit))
}

fn path(endpoint: SuotarEndpoint) -> String {
    format!("/api/v0/mock-suotar/{}", endpoint.path())
}

fn request_body(request: &mockito::Request) -> Value {
    serde_json::from_slice(request.body().expect("request body")).expect("JSON body")
}

/// Answers every request to `endpoint` with what `answer` makes of each item, by position, and
/// keeps the request bodies.
async fn answering(
    server: &mut ServerGuard,
    endpoint: SuotarEndpoint,
    answer: impl Fn(usize, &Value) -> Vec<Value> + Send + Sync + 'static,
) -> (Mock, SentBodies) {
    let sent = SentBodies::default();
    let bodies = Arc::clone(&sent);
    let mock = server
        .mock("POST", path(endpoint).as_str())
        .with_body_from_request(move |request| {
            let body = request_body(request);
            let items: Vec<Value> = body
                .as_array()
                .expect("a batch")
                .iter()
                .enumerate()
                .flat_map(|(index, item)| answer(index, item))
                .collect();
            bodies.lock().expect("lock").push(body);
            serde_json::to_vec(&items).expect("encodes")
        })
        .create_async()
        .await;
    (mock, sent)
}

/// Answers every request to `endpoint` with `status` and `body`, and keeps the request bodies.
async fn replying(
    server: &mut ServerGuard,
    endpoint: SuotarEndpoint,
    status: usize,
    body: &'static str,
) -> (Mock, SentBodies) {
    let sent = SentBodies::default();
    let bodies = Arc::clone(&sent);
    let mock = server
        .mock("POST", path(endpoint).as_str())
        .with_status(status)
        .with_body_from_request(move |request| {
            bodies.lock().expect("lock").push(request_body(request));
            body.as_bytes().to_vec()
        })
        .create_async()
        .await;
    (mock, sent)
}

fn bodies(sent: &SentBodies) -> Vec<Vec<Value>> {
    sent.lock()
        .expect("lock")
        .iter()
        .map(|body| body.as_array().expect("a batch").clone())
        .collect()
}

fn request_item_ids(items: &[Value]) -> Vec<String> {
    items
        .iter()
        .map(|item| item["requestItemId"].as_str().expect("an id").to_string())
        .collect()
}

fn answer(request: &Value, status: &str, code: &str, result: Value) -> Value {
    json!({
        "requestItemId": request["requestItemId"],
        "status": status,
        "code": code,
        "result": result,
    })
}

fn failure(request: &Value, code: &str, message: &str, result: Value) -> Value {
    json!({
        "requestItemId": request["requestItemId"],
        "status": "error",
        "code": code,
        "result": result,
        "error": { "message": message },
    })
}

fn wire_attainment(attainment_type: &str, grade_id: &str) -> Value {
    json!({
        "id": format!("sisu-{grade_id}"),
        "type": attainment_type,
        "state": "ATTAINED",
        "attainmentDate": "2026-08-01",
        "gradeScaleId": "sis-0-5",
        "gradeId": grade_id,
    })
}

/// A registry for one iteration of `phase` on a scope of its own, so no other test shares its
/// breakers or limiter.
fn gated(
    client: &SuotarClient,
    phase: CreditRegistrationPhase,
) -> (SuotarStudyRegistry<'_>, ScopeKey) {
    let scope = RegistrationScope::for_course(Uuid::new_v4());
    (gated_in(client, phase, &scope), ScopeKey::of(&scope))
}

fn gated_in<'a>(
    client: &'a SuotarClient,
    phase: CreditRegistrationPhase,
    scope: &RegistrationScope,
) -> SuotarStudyRegistry<'a> {
    let Ok(registry) =
        SuotarStudyRegistry::admit(client, "contract-test".to_string(), phase, scope, true)
    else {
        panic!("the breaker kept the iteration out");
    };
    registry
}

fn failures(key: &ScopeKey, target: BreakerTarget) -> u32 {
    breaker::snapshot(key, target).consecutive_failures
}

/// One entry per request, each row its position in the batch.
fn entries<R>(requests: Vec<R>) -> Vec<BatchEntry<usize, R>> {
    requests
        .into_iter()
        .enumerate()
        .map(|(row, request)| BatchEntry { row, request })
        .collect()
}

fn options(may_split: bool) -> BatchOptions {
    BatchOptions {
        may_split,
        is_resent_half: false,
        all_unavailable_error: ALL_UNAVAILABLE,
        registration_ids: Vec::new(),
    }
}

/// A half of a splittable batch refused as malformed, as the batch runner resends it.
fn resent_half() -> BatchOptions {
    BatchOptions {
        is_resent_half: true,
        ..options(true)
    }
}

fn person(student_number: &str) -> PersonLookup {
    PersonLookup {
        student_number: StudentNumber::new(student_number),
    }
}

fn verification(id: &str) -> VerificationRequest {
    VerificationRequest {
        submitted_attainment_id: AttainmentId::new(id),
    }
}

fn submission(student_number: &str, credits: f32) -> AttainmentSubmission {
    AttainmentSubmission {
        student_number: StudentNumber::new(student_number),
        course_code: code("TKT10002"),
        enrolment_id: format!("enrolment-{student_number}"),
        attained_at: "2026-08-01T21:16:05.123456Z"
            .parse()
            .expect("valid instant"),
        attainment_language: "fi".to_string(),
        grade: MappedGrade {
            grade_scale_id: "sis-0-5".to_string(),
            grade_id: "4".to_string(),
        },
        credits: Credits::from_stored(credits).expect("finite credits"),
    }
}

fn code(code: &str) -> CourseCode {
    CourseCode::parse(code).expect("a course code")
}

fn answered<K, R, A>(reply: BatchReply<K, R, A>) -> Vec<AnsweredRow<K, A>> {
    match reply {
        BatchReply::Answered(rows) => rows,
        BatchReply::Refused { error, .. } => {
            panic!("refused as {:?}: {}", error.kind, error.message)
        }
        BatchReply::RefusedAsMalformed { .. } => panic!("refused as malformed"),
    }
}

fn refused<K, R, A>(reply: BatchReply<K, R, A>) -> (Vec<RefusedRow<K>>, RegistryError, RefusedFor) {
    match reply {
        BatchReply::Refused {
            rows,
            error,
            refused_for,
        } => (rows, error, refused_for),
        BatchReply::Answered(_) => panic!("answered"),
        BatchReply::RefusedAsMalformed { .. } => panic!("refused as malformed"),
    }
}

fn refused_as_malformed<K, R, A>(reply: BatchReply<K, R, A>) -> Vec<BatchEntry<K, R>> {
    match reply {
        BatchReply::RefusedAsMalformed { entries, error } => {
            assert_eq!(error.kind, Kind::MalformedRequest);
            entries
        }
        BatchReply::Answered(_) => panic!("answered"),
        BatchReply::Refused { .. } => panic!("refused"),
    }
}

fn rows_of<R>(entries: &[BatchEntry<usize, R>]) -> Vec<usize> {
    entries.iter().map(|entry| entry.row).collect()
}

const MALFORMED: &str = r#"{"error":{"code":"malformedRequest","message":"bad item"}}"#;
const UNAVAILABLE: &str =
    r#"{"error":{"code":"serviceTemporarilyUnavailable","message":"importer lookup failed"}}"#;

#[tokio::test]
async fn an_import_sends_each_row_as_its_wire_item_in_row_order() {
    let (mut server, client) = suotar().await;
    let (_mock, sent) = answering(
        &mut server,
        SuotarEndpoint::ImportAttainments,
        |index, item| {
            vec![answer(
                item,
                "ok",
                "sent",
                json!({ "submittedAttainmentId": format!("submitted-{index}") }),
            )]
        },
    )
    .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::Import);

    let rows = answered(
        registry
            .import_attainments(
                entries(vec![submission("111", 5.0), submission("222", 2.5)]),
                options(false),
            )
            .await,
    );

    let bodies = bodies(&sent);
    assert_eq!(bodies.len(), 1);
    let items = &bodies[0];
    let ids = request_item_ids(items);
    assert_eq!(
        items[0],
        json!({
            "requestItemId": ids[0],
            "studentNumber": "111",
            "courseCode": "TKT10002",
            "enrolmentId": "enrolment-111",
            "attainmentDate": "2026-08-01T21:16:05Z",
            "attainmentLanguage": "fi",
            "gradeScaleId": "sis-0-5",
            "gradeId": "4",
            "credits": 5.0,
        })
    );
    assert_eq!(items[1]["studentNumber"], "222");
    assert_eq!(items[1]["credits"], 2.5);
    assert_ne!(ids[0], ids[1]);
    assert!(ids.iter().all(|id| Uuid::parse_str(id).is_ok()));

    assert_eq!(rows.len(), 2);
    for (index, row) in rows.iter().enumerate() {
        assert_eq!(row.row, index);
        assert_eq!(row.audit.request_item_id, ids[index]);
        assert_eq!(row.audit.request, items[index]);
        assert_eq!(
            row.audit
                .response
                .as_ref()
                .map(|item| &item["requestItemId"]),
            Some(&json!(ids[index]))
        );
        assert_eq!(
            row.audit
                .sent_student_number
                .as_ref()
                .map(StudentNumber::expose),
            items[index]["studentNumber"].as_str()
        );
        let Some(ImportAnswer::Submitted {
            submission: Some(submitted),
            is_repeat_in_batch: false,
        }) = &row.answer
        else {
            panic!("row {index} was not submitted");
        };
        assert_eq!(submitted.id.as_str(), format!("submitted-{index}"));
    }
    assert_eq!(registry.finish(), None);
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
}

#[tokio::test]
async fn the_same_rows_sent_again_go_out_under_fresh_ids() {
    let (mut server, client) = suotar().await;
    let (_mock, sent) = answering(&mut server, SuotarEndpoint::VerifyAttainments, |_, item| {
        vec![answer(item, "ok", "submissionPending", json!({}))]
    })
    .await;
    let (mut registry, _key) = gated(&client, CreditRegistrationPhase::Verify);

    for _ in 0..2 {
        registry
            .verify_attainments(
                entries(vec![verification("a"), verification("b")]),
                options(false),
            )
            .await;
    }

    let bodies = bodies(&sent);
    assert_eq!(bodies[0][0]["submittedAttainmentId"], "a");
    assert_eq!(bodies[0][1]["submittedAttainmentId"], "b");
    let ids: HashSet<String> = bodies
        .iter()
        .flat_map(|items| request_item_ids(items))
        .collect();
    assert_eq!(ids.len(), 4);
}

#[tokio::test]
async fn each_import_answer_reads_as_what_it_does_to_the_row() {
    let answers = |index: usize, item: &Value| -> Value {
        let submitted = json!({ "submittedAttainmentId": format!("submitted-{index}") });
        match index {
            0 => answer(item, "ok", "sent", submitted),
            1 => failure(item, "duplicateRequestItem", "repeat", submitted),
            2 => answer(
                item,
                "ok",
                "duplicateAttainment",
                json!({ "attainment": wire_attainment("CourseUnitAttainment", "4") }),
            ),
            3 => answer(
                item,
                "ok",
                "notImprovedAttainment",
                json!({ "previousAttainment": wire_attainment("CourseUnitAttainment", "5") }),
            ),
            4 => failure(item, "sisuTimeout", "Sisu timed out", submitted),
            5 => failure(item, "gradeScaleMismatch", "wrong scale", submitted),
            6 => failure(item, "serviceTemporarilyUnavailable", "down", Value::Null),
            7 => answer(item, "ok", "registered", Value::Null),
            _ => answer(item, "ok", "somethingNew", Value::Null),
        }
    };
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = answering(
        &mut server,
        SuotarEndpoint::ImportAttainments,
        move |index, item| vec![answers(index, item)],
    )
    .await;
    let (mut registry, _key) = gated(&client, CreditRegistrationPhase::Import);
    let submissions = (0..9)
        .map(|index| submission(&index.to_string(), 5.0))
        .collect();

    let rows = answered(
        registry
            .import_attainments(entries(submissions), options(false))
            .await,
    );
    let answers: Vec<&ImportAnswer> = rows
        .iter()
        .map(|row| row.answer.as_ref().expect("answered"))
        .collect();

    let submitted_id = |submission: &Option<SubmittedAttainmentRef>| {
        submission
            .as_ref()
            .map(|submission| submission.id.as_str().to_string())
    };
    let ImportAnswer::Submitted {
        submission,
        is_repeat_in_batch: false,
    } = answers[0]
    else {
        panic!("sent");
    };
    assert_eq!(submitted_id(submission).as_deref(), Some("submitted-0"));
    let ImportAnswer::Submitted {
        submission,
        is_repeat_in_batch: true,
    } = answers[1]
    else {
        panic!("duplicateRequestItem");
    };
    assert_eq!(submitted_id(submission).as_deref(), Some("submitted-1"));
    let ImportAnswer::Settled {
        held: HeldCredit::Duplicate,
        attainment: Some(held),
    } = answers[2]
    else {
        panic!("duplicateAttainment");
    };
    assert_eq!(held.grade_id.as_deref(), Some("4"));
    let ImportAnswer::Settled {
        held: HeldCredit::NotImproved,
        attainment: Some(held),
    } = answers[3]
    else {
        panic!("notImprovedAttainment");
    };
    assert_eq!(held.grade_id.as_deref(), Some("5"));
    let ImportAnswer::Refused {
        code: Code::SisuTimeout,
        submission,
        error_message,
    } = answers[4]
    else {
        panic!("sisuTimeout");
    };
    assert_eq!(submitted_id(submission).as_deref(), Some("submitted-4"));
    assert_eq!(error_message.as_deref(), Some("Sisu timed out"));
    assert!(matches!(
        answers[5],
        ImportAnswer::Refused {
            code: Code::GradeScaleMismatch,
            ..
        }
    ));
    assert!(matches!(
        answers[6],
        ImportAnswer::Refused {
            code: Code::SisuTimeout,
            ..
        }
    ));
    assert!(matches!(answers[7], ImportAnswer::UnknownSuccessCode));
    assert!(matches!(answers[8], ImportAnswer::UnknownSuccessCode));
}

#[tokio::test]
async fn each_verify_answer_reads_as_what_it_says_of_the_submission() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = answering(
        &mut server,
        SuotarEndpoint::VerifyAttainments,
        |index, item| {
            vec![match index {
                0 => answer(
                    item,
                    "ok",
                    "registered",
                    json!({ "attainment": wire_attainment("CourseUnitAttainment", "4") }),
                ),
                1 => answer(
                    item,
                    "ok",
                    "registered",
                    json!({ "attainment": wire_attainment("AssessmentItemAttainment", "4") }),
                ),
                2 => answer(
                    item,
                    "ok",
                    "submissionPending",
                    json!({ "retryAfter": "2026-09-02T10:00:00Z" }),
                ),
                3 => failure(item, "notRegistered", "no trace", Value::Null),
                4 => failure(item, "misregistered", "wrong person", Value::Null),
                _ => answer(item, "ok", "duplicateAttainment", Value::Null),
            }]
        },
    )
    .await;
    let (mut registry, _key) = gated(&client, CreditRegistrationPhase::Verify);
    let requests = (0..6)
        .map(|index| verification(&index.to_string()))
        .collect();

    let rows = answered(
        registry
            .verify_attainments(entries(requests), options(false))
            .await,
    );
    let readings: Vec<&VerificationReading> = rows
        .iter()
        .map(|row| &row.answer.as_ref().expect("answered").reading)
        .collect();

    let VerificationReading::Registered { attainment } = readings[0] else {
        panic!("registered");
    };
    assert_eq!(attainment.id, "sisu-4");
    assert!(matches!(
        readings[1],
        VerificationReading::PartiallyRegistered
    ));
    let VerificationReading::Pending {
        resubmit_not_before,
    } = readings[2]
    else {
        panic!("pending");
    };
    assert_eq!(
        *resubmit_not_before,
        Some(
            DateTime::parse_from_rfc3339("2026-09-02T10:00:00Z")
                .expect("time")
                .with_timezone(&Utc)
        )
    );
    assert!(matches!(readings[3], VerificationReading::NotRegistered));
    assert!(matches!(
        readings[4],
        VerificationReading::Failed {
            code: Code::Misregistered
        }
    ));
    assert!(matches!(readings[5], VerificationReading::Inconclusive));
    assert_eq!(
        rows[4]
            .answer
            .as_ref()
            .and_then(|answer| answer.error_message.as_deref()),
        Some("wrong person")
    );
}

#[tokio::test]
async fn a_person_answer_is_found_only_with_an_ok_person() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = answering(
        &mut server,
        SuotarEndpoint::ResolvePersons,
        |index, item| {
            let found = json!({ "studentNumber": "1", "personId": "person-1" });
            vec![match index {
                0 => answer(item, "ok", "personFound", found),
                1 => failure(item, "personNotFound", "nobody", Value::Null),
                2 => answer(item, "ok", "personFound", Value::Null),
                _ => failure(item, "somethingNew", "odd", Value::Null),
            }]
        },
    )
    .await;
    let (mut registry, _key) = gated(&client, CreditRegistrationPhase::ResolveEnrolments);

    let rows = answered(
        registry
            .resolve_persons(
                entries(vec![person("1"), person("2"), person("3"), person("4")]),
                options(true),
            )
            .await,
    );
    let readings: Vec<&PersonReading> = rows
        .iter()
        .map(|row| &row.answer.as_ref().expect("answered").reading)
        .collect();

    let PersonReading::Found(found) = readings[0] else {
        panic!("found");
    };
    assert_eq!(found.person_id.expose_secret(), "person-1");
    let codes: Vec<Option<Code>> = readings[1..]
        .iter()
        .map(|reading| match reading {
            PersonReading::Refused { code } => Some(*code),
            PersonReading::Found(_) => None,
        })
        .collect();
    assert_eq!(
        codes,
        [
            Some(Code::PersonNotFound),
            Some(Code::UnexpectedResponse),
            Some(Code::Unknown)
        ]
    );
}

#[tokio::test]
async fn an_enrolment_error_still_lists_the_existing_attainments() {
    let (mut server, client) = suotar().await;
    let (_mock, sent) = answering(
        &mut server,
        SuotarEndpoint::ResolveEnrolments,
        |index, item| {
            let existing = json!([{
                "id": "held-1",
                "type": "CourseUnitAttainment",
                "state": "ATTAINED",
                "gradeScaleId": "sis-0-5",
                "gradeId": 3,
            }]);
            vec![match index {
                0 => answer(
                    item,
                    "ok",
                    "enrolmentsListed",
                    json!({
                        "enrolments": [{
                            "id": "enrolment-1",
                            "state": "ENROLLED",
                            "gradeScaleId": "sis-0-5",
                            "credits": { "min": 5, "max": 5 },
                        }],
                        "existingAttainments": existing,
                    }),
                ),
                _ => failure(
                    item,
                    "enrolmentNotFound",
                    "no enrolment",
                    json!({ "enrolments": [], "existingAttainments": existing }),
                ),
            }]
        },
    )
    .await;
    let (mut registry, _key) = gated(&client, CreditRegistrationPhase::ResolveEnrolments);
    let lookup = |student_number: &str| EnrolmentLookup {
        student_number: StudentNumber::new(student_number),
        course_code: code("TKT10002"),
    };

    let rows = answered(
        registry
            .resolve_enrolments(entries(vec![lookup("1"), lookup("2")]), options(true))
            .await,
    );

    assert_eq!(bodies(&sent)[0][0]["courseCode"], "TKT10002");
    let listed = rows[0].answer.as_ref().expect("answered");
    assert!(matches!(listed.reading, EnrolmentReading::Listed));
    assert_eq!(listed.enrolments.len(), 1);
    assert_eq!(listed.enrolments[0].id, "enrolment-1");
    assert_eq!(
        listed.enrolments[0]
            .credits
            .as_ref()
            .and_then(|range| range.max),
        Some(5.0)
    );
    let missing = rows[1].answer.as_ref().expect("answered");
    let EnrolmentReading::Refused {
        code: Code::EnrolmentNotFound,
        error_message,
    } = &missing.reading
    else {
        panic!("refused");
    };
    assert_eq!(error_message.as_deref(), Some("no enrolment"));
    assert_eq!(missing.existing_attainments.len(), 1);
    assert_eq!(
        missing.existing_attainments[0].grade_id.as_deref(),
        Some("3")
    );
}

#[tokio::test]
async fn an_item_the_registry_skips_has_no_answer_and_the_first_of_a_repeated_id_wins() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = answering(
        &mut server,
        SuotarEndpoint::ResolvePersons,
        |index, item| {
            let found = json!({ "studentNumber": "1", "personId": "person-1" });
            match index {
                0 => vec![
                    answer(item, "ok", "personFound", found),
                    failure(item, "personNotFound", "nobody", Value::Null),
                ],
                1 => Vec::new(),
                _ => vec![
                    failure(item, "personNotFound", "nobody", Value::Null),
                    answer(
                        &json!({ "requestItemId": "never-sent" }),
                        "ok",
                        "personFound",
                        found,
                    ),
                ],
            }
        },
    )
    .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::ResolveEnrolments);

    let rows = answered(
        registry
            .resolve_persons(
                entries(vec![person("1"), person("2"), person("3")]),
                options(true),
            )
            .await,
    );

    assert_eq!(rows.len(), 3);
    assert!(matches!(
        rows[0].answer.as_ref().map(|answer| &answer.reading),
        Some(PersonReading::Found(_))
    ));
    assert_eq!(
        rows[0].audit.response.as_ref().map(|item| &item["code"]),
        Some(&json!("personFound"))
    );
    assert!(rows[1].answer.is_none());
    assert!(rows[1].audit.response.is_none());
    assert!(matches!(
        rows[2].answer.as_ref().map(|answer| &answer.reading),
        Some(PersonReading::Refused {
            code: Code::PersonNotFound
        })
    ));
    assert_eq!(registry.finish(), None);
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
}

#[tokio::test]
async fn an_answer_that_is_no_batch_refuses_every_row_without_counting_against_the_breaker() {
    for body in ["<html>not json</html>", r#"{"items": []}"#] {
        let (mut server, client) = suotar().await;
        let (_mock, sent) = replying(&mut server, SuotarEndpoint::ResolvePersons, 200, body).await;
        let (mut registry, key) = gated(&client, CreditRegistrationPhase::ResolveEnrolments);

        let (rows, error, refused_for) = refused(
            registry
                .resolve_persons(entries(vec![person("1"), person("2")]), options(true))
                .await,
        );

        assert_eq!(error.kind, Kind::ProtocolViolation);
        assert_eq!(refused_for, RefusedFor::WholeBatch);
        let items = &bodies(&sent)[0];
        assert_eq!(rows.len(), 2);
        for (row, item) in rows.iter().zip(items) {
            assert_eq!(&row.audit.request, item);
            assert_eq!(
                Some(row.audit.request_item_id.as_str()),
                item["requestItemId"].as_str()
            );
            assert!(row.audit.response.is_none());
        }
        assert!(registry.finish().is_some());
        assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
    }
}

#[tokio::test]
async fn a_malformed_request_comes_back_for_splitting_until_the_row_it_refuses_is_alone() {
    let (mut server, client) = suotar().await;
    let (_mock, sent) = replying(&mut server, SuotarEndpoint::ResolvePersons, 400, MALFORMED).await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::ResolveEnrolments);
    let full = registry.allowance(RegistryOperation::ResolvePersons);
    let started = Instant::now();

    let mut first = refused_as_malformed(
        registry
            .resolve_persons(
                entries(vec![person("1"), person("2"), person("3")]),
                options(true),
            )
            .await,
    );
    assert_eq!(rows_of(&first), [0, 1, 2], "the rows come back as sent");
    let second = first.split_off(first.len() / 2);

    let (rows, error, refused_for) = refused(registry.resolve_persons(first, resent_half()).await);
    assert_eq!(refused_for, RefusedFor::RowAlone);
    assert_eq!(error.kind, Kind::MalformedRequest);
    assert_eq!(rows.len(), 1);
    let mut third = refused_as_malformed(registry.resolve_persons(second, resent_half()).await);
    let fourth = third.split_off(third.len() / 2);
    assert_eq!((rows_of(&third), rows_of(&fourth)), (vec![1], vec![2]));

    let bodies = bodies(&sent);
    assert_eq!(
        bodies.iter().map(Vec::len).collect::<Vec<_>>(),
        [3, 1, 2],
        "each half goes out in a request of its own"
    );
    let ids: HashSet<String> = bodies
        .iter()
        .flat_map(|items| request_item_ids(items))
        .collect();
    assert_eq!(ids.len(), 6);
    let spent = full - registry.allowance(RegistryOperation::ResolvePersons);
    // The bucket refills while the test runs, by as much as a slow runner takes; one more for the
    // allowance rounding down.
    let per_second = rate_limit::endpoint_rate(SuotarEndpoint::ResolvePersons)
        .expect("resolve-persons is rate limited")
        .per_minute
        / 60.0;
    let refilled_at_most = (per_second * started.elapsed().as_secs_f64()).ceil() as usize + 1;
    assert!(
        spent <= 6 && spent + refilled_at_most >= 6,
        "spent {spent}, refilled at most {refilled_at_most}"
    );

    assert!(registry.finish().is_some());
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
}

#[tokio::test]
async fn a_malformed_request_that_may_not_split_blames_no_row_alone() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = replying(
        &mut server,
        SuotarEndpoint::VerifyAttainments,
        400,
        MALFORMED,
    )
    .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::Verify);

    for requests in [
        vec![verification("a"), verification("b")],
        vec![verification("c")],
    ] {
        let (rows, error, refused_for) = refused(
            registry
                .verify_attainments(entries(requests), options(false))
                .await,
        );
        assert_eq!(refused_for, RefusedFor::WholeBatch);
        assert_eq!(error.kind, Kind::MalformedRequest);
        assert!(!rows.is_empty());
    }
    assert!(registry.finish().is_some());
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
}

#[tokio::test]
async fn only_the_registry_failing_counts_against_the_breaker() {
    let cases = [
        (
            401,
            r#"{"error":{"code":"unauthorized","message":"bad token"}}"#,
            Kind::AuthenticationFailure,
            false,
        ),
        (
            404,
            r#"{"error":{"code":"notFound","message":"no route"}}"#,
            Kind::RejectedRequest,
            false,
        ),
        (503, UNAVAILABLE, Kind::TemporarilyUnavailable, true),
        (500, "", Kind::ServerError, true),
        (502, "bad gateway", Kind::ServerError, true),
    ];
    for (status, body, kind, is_counted) in cases {
        let (mut server, client) = suotar().await;
        let (_mock, _sent) =
            replying(&mut server, SuotarEndpoint::VerifyAttainments, status, body).await;
        let (mut registry, key) = gated(&client, CreditRegistrationPhase::Verify);

        let (_rows, error, refused_for) = refused(
            registry
                .verify_attainments(entries(vec![verification("a")]), options(false))
                .await,
        );

        assert_eq!(error.kind, kind, "{status}");
        assert_eq!(refused_for, RefusedFor::WholeBatch);
        assert!(registry.finish().is_some());
        assert_eq!(
            failures(&key, BreakerTarget::StudyRegistry),
            u32::from(is_counted),
            "{status}"
        );
    }
}

#[tokio::test]
async fn a_connection_that_never_opens_is_not_delivered_and_counts() {
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .expect("a free port")
        .port();
    let client = client_for(&format!("http://127.0.0.1:{port}"));
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::Import);

    let (_rows, error, _) = refused(
        registry
            .import_attainments(entries(vec![submission("1", 5.0)]), options(false))
            .await,
    );

    assert_eq!(error.kind, Kind::NotDelivered);
    assert!(!error.kind.may_have_been_acted_on());
    assert!(registry.finish().is_some());
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 1);
}

#[tokio::test]
async fn a_timed_out_import_may_have_landed_and_counts() {
    let (mut server, client) = suotar().await;
    let _mock = server
        .mock("POST", path(SuotarEndpoint::ImportAttainments).as_str())
        .with_chunked_body(|writer| {
            std::thread::sleep(Duration::from_millis(1500));
            writer.write_all(b"[]")
        })
        .create_async()
        .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::Import);
    registry.request_timeout = Some(Duration::from_millis(200));

    let (rows, error, refused_for) = refused(
        registry
            .import_attainments(entries(vec![submission("1", 5.0)]), options(false))
            .await,
    );

    assert_eq!(error.kind, Kind::NoAnswer);
    assert!(error.kind.may_have_been_acted_on());
    assert_eq!(refused_for, RefusedFor::WholeBatch);
    assert_eq!(rows.len(), 1);
    assert!(registry.finish().is_some());
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 1);
}

#[tokio::test]
async fn every_item_unavailable_counts_as_the_registry_failing() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = answering(&mut server, SuotarEndpoint::ResolvePersons, |_, item| {
        vec![failure(
            item,
            "serviceTemporarilyUnavailable",
            "down",
            Value::Null,
        )]
    })
    .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::ResolveEnrolments);

    let rows = answered(
        registry
            .resolve_persons(entries(vec![person("1"), person("2")]), options(true))
            .await,
    );

    assert!(rows.iter().all(|row| row.answer.is_some()));
    assert_eq!(registry.finish().as_deref(), Some(ALL_UNAVAILABLE));
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 1);
}

#[tokio::test]
async fn one_answered_item_among_unavailable_ones_is_a_plain_answer() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = answering(
        &mut server,
        SuotarEndpoint::ResolvePersons,
        |index, item| {
            vec![if index == 0 {
                answer(
                    item,
                    "ok",
                    "personFound",
                    json!({ "studentNumber": "1", "personId": "person-1" }),
                )
            } else {
                failure(item, "serviceTemporarilyUnavailable", "down", Value::Null)
            }]
        },
    )
    .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::ResolveEnrolments);

    registry
        .resolve_persons(entries(vec![person("1"), person("2")]), options(true))
        .await;

    assert_eq!(registry.finish(), None);
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
}

#[tokio::test]
async fn sisu_timing_out_on_every_submission_pauses_only_the_submitting_phase() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = answering(&mut server, SuotarEndpoint::ImportAttainments, |_, item| {
        vec![failure(item, "sisuTimeout", "Sisu timed out", Value::Null)]
    })
    .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::Import);

    registry
        .import_attainments(
            entries(vec![submission("1", 5.0), submission("2", 5.0)]),
            options(false),
        )
        .await;

    assert_eq!(registry.finish().as_deref(), Some(ALL_UNAVAILABLE));
    assert_eq!(failures(&key, BreakerTarget::SisuSubmissions), 1);
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
}

/// Trips the shared breaker of `scope` with a cooldown already over, so its next iteration probes.
fn half_open(scope: &RegistrationScope) -> ScopeKey {
    let key = ScopeKey::of(scope);
    while breaker::record_failure(&key, BreakerTarget::StudyRegistry, Duration::ZERO).is_none() {}
    assert!(breaker::is_half_open(&key, BreakerTarget::StudyRegistry));
    key
}

#[tokio::test]
async fn a_probe_sends_one_single_item_request_across_all_flows_and_closes_on_success() {
    let (mut server, client) = suotar().await;
    let (_mock, sent) = answering(&mut server, SuotarEndpoint::ResolvePersons, |_, item| {
        vec![answer(
            item,
            "ok",
            "personFound",
            json!({ "studentNumber": "1", "personId": "person-1" }),
        )]
    })
    .await;
    let scope = RegistrationScope::for_course(Uuid::new_v4());
    let key = half_open(&scope);
    let mut registry = gated_in(&client, CreditRegistrationPhase::ResolveEnrolments, &scope);

    assert_eq!(registry.allowance(RegistryOperation::ResolvePersons), 1);
    assert_eq!(registry.allowance(RegistryOperation::ResolveEnrolments), 1);
    assert_eq!(registry.roster_request_size(), 1);
    registry
        .resolve_persons(entries(vec![person("1")]), options(true))
        .await;
    assert_eq!(registry.allowance(RegistryOperation::ResolvePersons), 0);
    assert_eq!(registry.allowance(RegistryOperation::ResolveEnrolments), 0);

    assert_eq!(bodies(&sent).iter().map(Vec::len).collect::<Vec<_>>(), [1]);
    assert_eq!(registry.finish(), None);
    assert!(!breaker::is_half_open(&key, BreakerTarget::StudyRegistry));
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
}

#[tokio::test]
async fn a_failed_probe_opens_the_breaker_again() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = replying(
        &mut server,
        SuotarEndpoint::ResolvePersons,
        503,
        UNAVAILABLE,
    )
    .await;
    let scope = RegistrationScope::for_course(Uuid::new_v4());
    let key = half_open(&scope);
    let mut registry = gated_in(&client, CreditRegistrationPhase::ResolveEnrolments, &scope);

    registry
        .resolve_persons(entries(vec![person("1")]), options(true))
        .await;
    registry.finish();

    assert!(breaker::is_open(&key, BreakerTarget::StudyRegistry));
    assert!(
        SuotarStudyRegistry::admit(
            &client,
            "contract-test".to_string(),
            CreditRegistrationPhase::Verify,
            &scope,
            true
        )
        .is_err()
    );
}

fn roster_codes(alone: &[&str], batched: usize) -> Vec<RosterCode> {
    let alone = alone.iter().map(|alone_code| RosterCode {
        course_code: code(alone_code),
        is_fetched_alone: true,
    });
    let batched = (0..batched).map(|index| RosterCode {
        course_code: code(&format!("B{index}")),
        is_fetched_alone: false,
    });
    alone.chain(batched).collect()
}

#[tokio::test]
async fn a_roster_listing_answers_each_code_in_request_order_and_spends_one_request() {
    let (mut server, client) = suotar().await;
    let (_mock, sent) =
        answering(
            &mut server,
            SuotarEndpoint::ListByCourse,
            |index, item| match index {
                0 => vec![answer(
                    item,
                    "ok",
                    "enrolmentsListed",
                    json!({ "people": [{
                        "studentNumber": "1",
                        "personId": "person-1",
                        "primaryEmail": "one@example.com",
                        "enrolment": { "id": "enrolment-1", "state": "ENROLLED" },
                    }]}),
                )],
                1 => vec![failure(
                    item,
                    "courseCodeNotFound",
                    "no such code",
                    Value::Null,
                )],
                _ => Vec::new(),
            },
        )
        .await;
    let (mut registry, _key) = gated(&client, CreditRegistrationPhase::EnrolmentDiscovery);
    let before = registry.allowance(RegistryOperation::ListCourseRoster);

    let request = roster_codes(&[], 3);
    let listing = registry
        .list_course_roster(&request)
        .await
        .ok()
        .expect("listed");

    assert_eq!(bodies(&sent)[0][2]["courseCode"], "B2");
    assert_eq!(listing.rosters.len(), 3);
    let Ok(people) = &listing.rosters[0] else {
        panic!("no roster");
    };
    assert_eq!(people.len(), 1);
    assert_eq!(people[0].person_id.expose_secret(), "person-1");
    assert_eq!(
        people[0]
            .enrolment
            .as_ref()
            .and_then(|enrolment| enrolment.id.as_deref()),
        Some("enrolment-1")
    );
    assert_eq!(
        listing.rosters[1].as_ref().err(),
        Some(&Code::CourseCodeNotFound)
    );
    assert_eq!(
        listing.rosters[2].as_ref().err(),
        Some(&Code::UnexpectedResponse)
    );
    assert_eq!(
        registry.allowance(RegistryOperation::ListCourseRoster),
        before - 1
    );
}

#[tokio::test]
async fn a_roster_code_refused_on_its_own_counts_against_the_breaker_only_in_an_outage() {
    for (status, body, is_counted) in [(400, MALFORMED, false), (503, UNAVAILABLE, true)] {
        let (mut server, client) = suotar().await;
        let (_mock, _sent) =
            replying(&mut server, SuotarEndpoint::ListByCourse, status, body).await;
        let (mut registry, key) = gated(&client, CreditRegistrationPhase::EnrolmentDiscovery);

        let refusal = registry.list_course_roster(&roster_codes(&["A1"], 0)).await;

        assert!(refusal.is_err());
        assert!(registry.finish().is_some());
        assert_eq!(
            failures(&key, BreakerTarget::StudyRegistry),
            u32::from(is_counted),
            "{status}"
        );
    }
}

#[tokio::test]
async fn course_codes_get_a_verdict_only_where_the_registry_gave_one() {
    let (mut server, client) = suotar().await;
    let (_mock, sent) = answering(
        &mut server,
        SuotarEndpoint::ValidateCourseCodes,
        |index, item| {
            let result = json!({ "courseCode": item["courseCode"] });
            vec![match index {
                0 => answer(item, "ok", "courseAllowed", result),
                1 => failure(item, "courseNotAllowed", "closed for credits", result),
                _ => failure(item, "sisuTimeout", "slow", Value::Null),
            }]
        },
    )
    .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::ConfigValidation);
    let codes = [code("TKT1"), code("TKT2"), code("TKT3")];

    let verdicts = registry
        .validate_course_codes(&codes)
        .await
        .ok()
        .expect("validated");

    assert_eq!(bodies(&sent).len(), 1);
    assert_eq!(verdicts.get("TKT1"), Some(&CourseCodeVerdict::Allowed));
    assert_eq!(
        verdicts.get("TKT2"),
        Some(&CourseCodeVerdict::NotAllowed {
            reason: "closed for credits".to_string()
        })
    );
    assert_eq!(verdicts.get("TKT3"), None);
    assert_eq!(registry.finish(), None);
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 0);
}

#[tokio::test]
async fn a_refused_course_code_check_drops_its_verdicts_and_counts_in_an_outage() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = replying(
        &mut server,
        SuotarEndpoint::ValidateCourseCodes,
        503,
        UNAVAILABLE,
    )
    .await;
    let (mut registry, key) = gated(&client, CreditRegistrationPhase::ConfigValidation);

    let refusal = registry.validate_course_codes(&[code("TKT1")]).await;

    assert!(refusal.is_err_and(|error| error.kind == Kind::TemporarilyUnavailable));
    assert!(registry.finish().is_some());
    assert_eq!(failures(&key, BreakerTarget::StudyRegistry), 1);
}

#[tokio::test]
async fn an_interactive_lookup_teaches_no_breaker() {
    let (mut server, client) = suotar().await;
    let (_mock, _sent) = replying(
        &mut server,
        SuotarEndpoint::ResolvePersons,
        503,
        UNAVAILABLE,
    )
    .await;
    let registry = InteractiveSuotar::new(&client, "contract-test".to_string());
    let global = failures(&ScopeKey::Global, BreakerTarget::StudyRegistry);

    let refusal = registry.look_up_person(&StudentNumber::new("1")).await;

    assert!(refusal.is_err_and(|error| error == PersonLookupError::StudyRegistryUnavailable));
    assert_eq!(
        failures(&ScopeKey::Global, BreakerTarget::StudyRegistry),
        global
    );
}

#[tokio::test]
async fn an_interactive_person_lookup_tells_not_found_from_unanswered() {
    type Reply = fn(&Value) -> Vec<Value>;
    let cases: [(Reply, &str); 3] = [
        (
            |item| vec![failure(item, "personNotFound", "nobody", Value::Null)],
            "not found",
        ),
        (|_| Vec::new(), "unanswered"),
        (
            |item| {
                vec![answer(
                    item,
                    "ok",
                    "personFound",
                    json!({ "studentNumber": "1", "personId": "person-1" }),
                )]
            },
            "found",
        ),
    ];
    for (reply, expected) in cases {
        let (mut server, client) = suotar().await;
        let (_mock, sent) = answering(
            &mut server,
            SuotarEndpoint::ResolvePersons,
            move |_, item| reply(item),
        )
        .await;
        let registry = InteractiveSuotar::new(&client, "contract-test".to_string());

        let lookup = registry
            .look_up_person(&StudentNumber::new("012345678"))
            .await;

        assert_eq!(bodies(&sent)[0][0]["studentNumber"], "012345678");
        let reading = match lookup {
            Ok(None) => "not found",
            Err(PersonLookupError::ItemMissingFromResponse) => "unanswered",
            Ok(Some(person)) => {
                assert_eq!(person.sisu_person_id.expose_secret(), "person-1");
                "found"
            }
            Err(error) => panic!("{error:?}"),
        };
        assert_eq!(reading, expected);
    }
}

#[tokio::test]
async fn a_roster_search_finds_the_number_and_notes_a_code_that_did_not_answer() {
    let (mut server, client) = suotar().await;
    let _refused = server
        .mock("POST", path(SuotarEndpoint::ListByCourse).as_str())
        .match_request(|request| request_body(request)[0]["courseCode"] == "TKT2")
        .with_status(503)
        .with_body(UNAVAILABLE)
        .create_async()
        .await;
    let (_listed, _sent) = answering(&mut server, SuotarEndpoint::ListByCourse, |_, item| {
        vec![answer(
            item,
            "ok",
            "enrolmentsListed",
            json!({ "people": [
                { "studentNumber": "2", "personId": "person-2" },
                { "studentNumber": "1", "personId": "person-1" },
            ]}),
        )]
    })
    .await;
    let registry = InteractiveSuotar::new(&client, "contract-test".to_string());

    let search = registry
        .search_course_rosters(&[code("TKT1"), code("TKT2")], &StudentNumber::new("1"))
        .await;

    assert!(search.has_unanswered_code);
    assert_eq!(
        search
            .person
            .as_ref()
            .map(|person| person.person_id.expose_secret().to_string()),
        Some("person-1".to_string())
    );
}
