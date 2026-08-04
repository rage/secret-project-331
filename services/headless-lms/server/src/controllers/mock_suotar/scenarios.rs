//! Named scenarios: small compositions of the control primitives, exposed as one command.
//!
//! Specs stay free to use the primitives directly, so this catalogue cannot harden into a second
//! informal API. Every scenario returns the identifiers it minted and the scope its rows are ticked
//! with, so a spec restates nothing.

use std::collections::BTreeMap;

use chrono::Duration;
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use serde_json::json;

use crate::prelude::*;

use super::commands::{CommandError, arm_fault};
use super::faults::{Effect, FaultSpec, Lifetime, OwnerRef, Predicate, Stage, WhenSpec};
use super::ids;
use super::store::{EntityHash, MockSuotarStore};
use super::world::{
    AttainmentState, CreditRange, DatePeriod, DuplicateDetection, EnrolmentState, LocalizedName,
    MockAttainment, MockCourseUnit, MockEnrolment, MockPerson, MockProductAccessToken,
    MockRealisation, PersonBehaviour, ProductDocumentState, ProductTokenState, RealisationKind,
    Ripeness,
};

const ACCEPTOR_PERSON_ID: &str = "hy-hlo-acceptor";
const PASS_FAIL_SCALE: &str = "sis-hyl-hyv";
const GRADED_SCALE: &str = "sis-0-5";

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioArgs {
    pub student_number: Option<String>,
    pub course_code: Option<String>,
    pub realisation_kind: Option<RealisationKind>,
    pub owner: Option<OwnerRef>,
    pub primary_email: Option<String>,
    pub secondary_email: Option<String>,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
}

pub const SCENARIOS: [&str; 23] = [
    "happy-path",
    "happy-path-auto",
    "happy-path-instant",
    "slow-registration",
    "open-university",
    "no-enrolment",
    "needs-reenrolment",
    "expired-study-right",
    "no-acceptor",
    "import-not-allowed",
    "already-attained-same",
    "already-attained-better",
    "unknown-person",
    "timeout-but-landed",
    "timeout-but-landed-silent",
    "timeout-nothing-landed",
    "post-send-death",
    "misregistered-later",
    "sisu-flaky",
    "double-submission-trap",
    "reject-auth",
    "large-roster",
    "enrolment-appears-later",
];

pub async fn apply(
    store: &MockSuotarStore,
    generation: &str,
    name: &str,
    args: ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    if !SCENARIOS.contains(&name) {
        return Err(CommandError::new(
            "unknownScenario",
            format!("No scenario `{name}`. Known: {}.", SCENARIOS.join(", ")),
        ));
    }
    let mut result = match name {
        "happy-path" => plain(store, generation, &args, Ripeness::Manual).await?,
        "slow-registration" => plain(store, generation, &args, Ripeness::Manual).await?,
        "happy-path-auto" => {
            plain(
                store,
                generation,
                &args,
                Ripeness::AutoAfterVerifyCalls { calls: 1 },
            )
            .await?
        }
        "happy-path-instant" => plain(store, generation, &args, Ripeness::AtImport).await?,
        "open-university" => open_university(store, generation, &args).await?,
        "no-enrolment" => {
            let student_number = put_person(store, generation, &args, None).await?;
            json!({ "studentNumber": student_number })
        }
        "needs-reenrolment" => {
            enrolment_in_state(store, generation, &args, EnrolmentState::Processing).await?
        }
        "expired-study-right" => expired_study_right(store, generation, &args).await?,
        "no-acceptor" => no_acceptor(store, generation, &args).await?,
        "import-not-allowed" => import_not_allowed(store, generation, &args).await?,
        "already-attained-same" => {
            already_attained(store, generation, &args, PASS_FAIL_SCALE, "1").await?
        }
        "already-attained-better" => {
            already_attained(store, generation, &args, GRADED_SCALE, "5").await?
        }
        "unknown-person" => unknown_person(&args)?,
        "timeout-but-landed" => timeout(store, generation, &args, Stage::AfterWrite, true).await?,
        "timeout-but-landed-silent" => {
            timeout(store, generation, &args, Stage::AfterWrite, false).await?
        }
        "timeout-nothing-landed" => {
            timeout(store, generation, &args, Stage::Resolve, false).await?
        }
        "post-send-death" => post_send_death(store, generation, &args).await?,
        "misregistered-later" => misregistered_later(store, generation, &args).await?,
        "sisu-flaky" => sisu_flaky(store, generation, &args).await?,
        "double-submission-trap" => double_submission_trap(store, generation, &args).await?,
        "reject-auth" => reject_auth(store, generation, &args).await?,
        "large-roster" => large_roster(store, generation, &args).await?,
        "enrolment-appears-later" => enrolment_appears_later(store, generation, &args).await?,
        _ => unreachable!("checked against the catalogue above"),
    };

    // The scope comes from the owner the caller passed, not from the fixtures touched:
    // `unknown-person` deliberately creates nothing and `reject-auth` touches no fixture at all.
    if let Some(object) = result.as_object_mut() {
        object.insert("scenario".to_string(), json!(name));
        object.insert("parallelSafe".to_string(), json!(is_parallel_safe(name)));
        match &args.owner {
            Some(owner) if !owner.is_empty() => {
                object.insert(
                    "scope".to_string(),
                    json!({ "courseSlug": owner.course, "userEmail": owner.user }),
                );
                object.insert("owner".to_string(), json!(owner));
            }
            _ => {
                object.insert("scope".to_string(), serde_json::Value::Null);
            }
        }
    }
    Ok(result)
}

/// True only for a scenario whose writes stay person-scoped. Every other scenario reaches
/// `ensure_course`, which overwrites the realisation and course behaviour for the whole course code
/// — safe for one spec alone, but a clobber for any other spec sharing that course code.
fn is_parallel_safe(name: &str) -> bool {
    matches!(name, "no-enrolment" | "unknown-person" | "reject-auth")
}

async fn plain(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
    ripeness: Ripeness,
) -> Result<serde_json::Value, CommandError> {
    let kind = args.realisation_kind.unwrap_or(RealisationKind::Degree);
    let realisation = ensure_course(store, generation, args, CourseShape::default()).await?;
    let student_number = put_person(store, generation, args, Some(ripeness)).await?;
    let course_code = course_code(args)?;
    let enrolment_id = put_enrolment(
        store,
        generation,
        &student_number,
        &course_code,
        &realisation,
        EnrolmentState::Enrolled,
        validity_now(),
    )
    .await?;
    Ok(json!({
        "studentNumber": student_number,
        "personId": ids::person_id(&student_number),
        "enrolmentId": enrolment_id,
        "realisationId": realisation.id,
        "courseCode": course_code,
        "kind": kind,
    }))
}

async fn open_university(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let course_code = course_code(args)?;
    let product_id = ids::product_id(&course_code);
    let shape = CourseShape {
        kind: RealisationKind::OpenUniversity,
        product_id: Some(product_id.clone()),
        ..Default::default()
    };
    let realisation = ensure_course(store, generation, args, shape).await?;
    let student_number = put_person(store, generation, args, Some(Ripeness::Manual)).await?;
    let enrolment_id = put_enrolment(
        store,
        generation,
        &student_number,
        &course_code,
        &realisation,
        EnrolmentState::Enrolled,
        validity_now(),
    )
    .await?;
    let access_token = ids::product_access_token(&product_id);
    let token = MockProductAccessToken {
        id: format!("{product_id}-token"),
        access_token: access_token.clone(),
        state: ProductTokenState::Enabled,
        document_state: ProductDocumentState::Active,
        open_university_product_id: product_id.clone(),
    };
    store
        .upsert_json(
            generation,
            EntityHash::ProductTokens,
            &BTreeMap::from([(product_id.clone(), token)]),
        )
        .await?;
    store.reindex(generation).await?;
    Ok(json!({
        "studentNumber": student_number,
        "enrolmentId": enrolment_id,
        "realisationId": realisation.id,
        "courseCode": course_code,
        "productId": product_id,
        "accessToken": access_token,
    }))
}

async fn enrolment_in_state(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
    state: EnrolmentState,
) -> Result<serde_json::Value, CommandError> {
    let realisation = ensure_course(store, generation, args, CourseShape::default()).await?;
    let student_number = put_person(store, generation, args, Some(Ripeness::Manual)).await?;
    let course_code = course_code(args)?;
    let enrolment_id = put_enrolment(
        store,
        generation,
        &student_number,
        &course_code,
        &realisation,
        state,
        validity_now(),
    )
    .await?;
    Ok(json!({ "studentNumber": student_number, "enrolmentId": enrolment_id }))
}

async fn expired_study_right(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let realisation = ensure_course(store, generation, args, CourseShape::default()).await?;
    let student_number = put_person(store, generation, args, Some(Ripeness::Manual)).await?;
    let course_code = course_code(args)?;
    let now = Utc::now();
    let expired = DatePeriod {
        start_date: (now - Duration::days(1200)).date_naive(),
        end_date: (now - Duration::days(400)).date_naive(),
    };
    let enrolment_id = put_enrolment(
        store,
        generation,
        &student_number,
        &course_code,
        &realisation,
        EnrolmentState::Enrolled,
        expired,
    )
    .await?;
    Ok(json!({ "studentNumber": student_number, "enrolmentId": enrolment_id }))
}

async fn no_acceptor(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let shape = CourseShape {
        acceptor: None,
        ..Default::default()
    };
    let realisation = ensure_course(store, generation, args, shape).await?;
    let student_number = put_person(store, generation, args, Some(Ripeness::Manual)).await?;
    let course_code = course_code(args)?;
    let enrolment_id = put_enrolment(
        store,
        generation,
        &student_number,
        &course_code,
        &realisation,
        EnrolmentState::Enrolled,
        validity_now(),
    )
    .await?;
    Ok(json!({
        "studentNumber": student_number,
        "enrolmentId": enrolment_id,
        "realisationId": realisation.id,
    }))
}

async fn import_not_allowed(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let shape = CourseShape {
        import_allowed: false,
        ..Default::default()
    };
    let realisation = ensure_course(store, generation, args, shape).await?;
    let student_number = put_person(store, generation, args, Some(Ripeness::Manual)).await?;
    let course_code = course_code(args)?;
    let enrolment_id = put_enrolment(
        store,
        generation,
        &student_number,
        &course_code,
        &realisation,
        EnrolmentState::Enrolled,
        validity_now(),
    )
    .await?;
    Ok(json!({
        "courseCode": course_code,
        "studentNumber": student_number,
        "enrolmentId": enrolment_id,
    }))
}

async fn already_attained(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
    grade_scale_id: &str,
    grade_id: &str,
) -> Result<serde_json::Value, CommandError> {
    let shape = CourseShape {
        grade_scale_id: grade_scale_id.to_string(),
        ..Default::default()
    };
    let realisation = ensure_course(store, generation, args, shape).await?;
    let student_number = put_person(store, generation, args, Some(Ripeness::Manual)).await?;
    let course_code = course_code(args)?;
    let enrolment_id = put_enrolment(
        store,
        generation,
        &student_number,
        &course_code,
        &realisation,
        EnrolmentState::Enrolled,
        validity_now(),
    )
    .await?;
    let attainment_id = ids::pushed_attainment_id(&student_number, &course_code, grade_id);
    let attainment = MockAttainment {
        id: attainment_id.clone(),
        attainment_type: "CourseUnitAttainment".to_string(),
        state: AttainmentState::Attained,
        person_id: ids::person_id(&student_number),
        student_number: student_number.clone(),
        course_code: course_code.clone(),
        course_unit_id: ids::course_unit_id(&course_code),
        assessment_item_id: realisation.assessment_item_id.clone(),
        course_unit_realisation_id: realisation.id.clone(),
        attainment_date: Utc::now().date_naive(),
        registration_date: Utc::now().date_naive(),
        grade_scale_id: grade_scale_id.to_string(),
        grade_id: grade_id.to_string(),
        passed: true,
        from_submission: None,
    };
    store
        .upsert_json(
            generation,
            EntityHash::Attainments,
            &BTreeMap::from([(attainment_id.clone(), attainment)]),
        )
        .await?;
    store.reindex(generation).await?;
    Ok(json!({
        "studentNumber": student_number,
        "enrolmentId": enrolment_id,
        "attainmentId": attainment_id,
        "gradeScaleId": grade_scale_id,
        "gradeId": grade_id,
    }))
}

/// `PP = 99` inside the caller's own spec block is guaranteed absent, so no global reserved range is
/// needed.
fn unknown_person(args: &ScenarioArgs) -> Result<serde_json::Value, CommandError> {
    let student_number = args.student_number.clone().ok_or_else(|| {
        CommandError::new(
            "missingArgument",
            "`unknown-person` needs a studentNumber from your own block to derive the absent one.",
        )
    })?;
    if student_number.len() < 2 {
        return Err(CommandError::new(
            "invalidArgument",
            "A student number needs at least two digits.",
        ));
    }
    let absent = format!("{}99", &student_number[..student_number.len() - 2]);
    Ok(json!({ "studentNumber": absent }))
}

async fn timeout(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
    stage: Stage,
    disclose: bool,
) -> Result<serde_json::Value, CommandError> {
    let mut base = plain(store, generation, args, Ripeness::Manual).await?;
    let student_number = string_field(&base, "studentNumber")?;
    // `sisuTimeout` after the write leaves the world indistinguishable from a successful import,
    // which is exactly the ground truth verify has to find.
    let fault_id = format!("timeout-{student_number}");
    arm(
        store,
        generation,
        &fault_id,
        vec![
            Predicate::Endpoint(SuotarEndpoint::ImportAttainments),
            Predicate::Stage(stage),
            Predicate::StudentNumber(student_number.clone()),
        ],
        Effect::ItemLevel {
            code: "sisuTimeout".to_string(),
            message: None,
            disclose_submitted_attainment_id: disclose,
        },
        Lifetime {
            matching_items: Some(1),
            ..Default::default()
        },
    )
    .await?;
    merge(
        &mut base,
        json!({ "faultId": fault_id, "discloseId": disclose }),
    );
    Ok(base)
}

async fn post_send_death(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let mut base = plain(store, generation, args, Ripeness::Manual).await?;
    let student_number = string_field(&base, "studentNumber")?;
    let fault_id = format!("post-send-death-{student_number}");
    arm(
        store,
        generation,
        &fault_id,
        vec![
            Predicate::Endpoint(SuotarEndpoint::ImportAttainments),
            Predicate::Stage(Stage::AfterWrite),
            Predicate::StudentNumber(student_number),
        ],
        Effect::ConnectionReset,
        Lifetime {
            matching_calls: Some(1),
            ..Default::default()
        },
    )
    .await?;
    merge(&mut base, json!({ "faultId": fault_id }));
    Ok(base)
}

async fn misregistered_later(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let mut base = plain(store, generation, args, Ripeness::Manual).await?;
    let student_number = string_field(&base, "studentNumber")?;
    merge(
        &mut base,
        json!({
            "followUp": {
                "command": "transitionSubmissionsFor",
                "studentNumber": student_number,
                "to": "misregistered",
            }
        }),
    );
    Ok(base)
}

/// Driven at `verify`, not `import`: import's contract has no item-level transient code, and a
/// retry storm there would pin the double submission.
async fn sisu_flaky(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let mut base = plain(store, generation, args, Ripeness::Manual).await?;
    let student_number = string_field(&base, "studentNumber")?;
    let fault_id = format!("sisu-flaky-{student_number}");
    arm(
        store,
        generation,
        &fault_id,
        vec![
            Predicate::Endpoint(SuotarEndpoint::VerifyAttainments),
            Predicate::Stage(Stage::Resolve),
            Predicate::StudentNumber(student_number),
        ],
        Effect::ItemLevel {
            code: "sisuTemporarilyUnavailable".to_string(),
            message: None,
            disclose_submitted_attainment_id: false,
        },
        Lifetime {
            matching_items: Some(3),
            ..Default::default()
        },
    )
    .await?;
    merge(&mut base, json!({ "faultId": fault_id }));
    Ok(base)
}

async fn double_submission_trap(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let mut base = plain(store, generation, args, Ripeness::Manual).await?;
    let student_number = string_field(&base, "studentNumber")?;
    let mut person: MockPerson = store
        .get_json(generation, EntityHash::Persons, &student_number)
        .await?
        .ok_or_else(|| CommandError::new("unknownPerson", "the scenario's own person vanished"))?;
    // Per person, so the one setting that makes a double submission visible does not blind every
    // concurrently running spec to real ones.
    person.behaviour.duplicate_detection = Some(DuplicateDetection::AllowDoubles);
    store
        .upsert_json(
            generation,
            EntityHash::Persons,
            &BTreeMap::from([(student_number.clone(), person)]),
        )
        .await?;
    let fault_id = format!("double-submission-trap-{student_number}");
    arm(
        store,
        generation,
        &fault_id,
        vec![
            Predicate::Endpoint(SuotarEndpoint::ImportAttainments),
            Predicate::Stage(Stage::AfterWrite),
            Predicate::StudentNumber(student_number),
        ],
        Effect::ItemLevel {
            code: "sisuTimeout".to_string(),
            message: None,
            disclose_submitted_attainment_id: false,
        },
        Lifetime {
            matching_items: Some(1),
            ..Default::default()
        },
    )
    .await?;
    merge(&mut base, json!({ "faultId": fault_id }));
    Ok(base)
}

/// Armed on the four endpoints whose items carry a student number, so the rejection stays inside
/// one spec's traffic.
async fn reject_auth(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let student_number = args.student_number.clone().ok_or_else(|| {
        CommandError::new(
            "missingArgument",
            "`reject-auth` needs a studentNumber, or the 401 reaches everyone's traffic.",
        )
    })?;
    let mut fault_ids = Vec::new();
    for endpoint in [
        SuotarEndpoint::ResolvePersons,
        SuotarEndpoint::ResolveEnrolments,
        SuotarEndpoint::ImportAttainments,
        SuotarEndpoint::VerifyAttainments,
    ] {
        let fault_id = format!("reject-auth-{student_number}-{}", endpoint_slug(endpoint));
        arm(
            store,
            generation,
            &fault_id,
            vec![
                Predicate::Endpoint(endpoint),
                Predicate::Stage(Stage::Auth),
                Predicate::StudentNumber(student_number.clone()),
            ],
            Effect::RequestLevel {
                status: 401,
                code: "unauthorized".to_string(),
                message: None,
            },
            Lifetime::default(),
        )
        .await?;
        fault_ids.push(fault_id);
    }
    Ok(json!({ "studentNumber": student_number, "faultIds": fault_ids }))
}

/// Course-only scope: a user half would narrow a scoped tick to one row of six hundred and put the
/// materialise bound permanently out of reach.
async fn large_roster(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let realisation = ensure_course(store, generation, args, CourseShape::default()).await?;
    let course_code = course_code(args)?;
    let now = Utc::now();
    let validity = validity_now();
    let mut persons = BTreeMap::new();
    let mut enrolments = BTreeMap::new();
    let mut student_numbers = Vec::new();
    for _ in 0..600 {
        let sequence = store.next_person_seq(generation).await?;
        let student_number = format!("99{sequence:07}");
        student_numbers.push(student_number.clone());
        persons.insert(
            student_number.clone(),
            MockPerson {
                person_id: ids::person_id(&student_number),
                first_names: "Zzyzx".to_string(),
                last_name: format!("Roster{sequence}"),
                primary_email: format!("zzyzx.roster.{student_number}@helsinki.example"),
                secondary_email: None,
                behaviour: PersonBehaviour::default(),
                owner_user_email: None,
                student_number: student_number.clone(),
            },
        );
        let enrolment_id = ids::enrolment_id(&student_number, realisation.kind);
        enrolments.insert(
            enrolment_id.clone(),
            MockEnrolment {
                id: enrolment_id,
                student_number: student_number.clone(),
                course_code: course_code.clone(),
                realisation_id: realisation.id.clone(),
                state: EnrolmentState::Enrolled,
                study_right_id: ids::study_right_id(&student_number, realisation.kind),
                study_right_validity_period: validity.clone(),
                enrolment_date_time: now,
            },
        );
    }
    store
        .upsert_json(generation, EntityHash::Persons, &persons)
        .await?;
    store
        .upsert_json(generation, EntityHash::Enrolments, &enrolments)
        .await?;
    store.reindex(generation).await?;
    Ok(json!({
        "courseCode": course_code,
        "realisationId": realisation.id,
        "studentNumbers": student_numbers,
    }))
}

async fn enrolment_appears_later(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    let realisation = ensure_course(store, generation, args, CourseShape::default()).await?;
    let student_number = put_person(store, generation, args, Some(Ripeness::Manual)).await?;
    let course_code = course_code(args)?;
    let validity = validity_now();
    Ok(json!({
        "studentNumber": student_number,
        "courseCode": course_code,
        "followUp": {
            "command": "upsertEnrolments",
            "enrolments": [{
                "studentNumber": student_number,
                "courseCode": course_code,
                "realisationId": realisation.id,
                "kind": realisation.kind,
                "state": "ENROLLED",
                "studyRightValidityPeriod": validity,
            }],
        },
    }))
}

struct CourseShape {
    kind: RealisationKind,
    grade_scale_id: String,
    credits: CreditRange,
    acceptor: Option<String>,
    import_allowed: bool,
    product_id: Option<String>,
}

impl Default for CourseShape {
    fn default() -> Self {
        Self {
            kind: RealisationKind::Degree,
            grade_scale_id: PASS_FAIL_SCALE.to_string(),
            credits: CreditRange { min: 5.0, max: 5.0 },
            acceptor: Some(ACCEPTOR_PERSON_ID.to_string()),
            import_allowed: true,
            product_id: None,
        }
    }
}

async fn ensure_course(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
    shape: CourseShape,
) -> Result<MockRealisation, CommandError> {
    let course_code = course_code(args)?;
    let kind = args.realisation_kind.unwrap_or(shape.kind);
    let now = Utc::now();
    let realisation = MockRealisation {
        id: ids::realisation_id(&course_code, kind),
        name: LocalizedName {
            fi: course_code.clone(),
            sv: course_code.clone(),
            en: course_code.clone(),
        },
        assessment_item_id: ids::assessment_item_id(&course_code, kind),
        kind,
        activity_period: DatePeriod {
            start_date: (now - Duration::days(180)).date_naive(),
            end_date: (now + Duration::days(180)).date_naive(),
        },
        grade_scale_id: shape.grade_scale_id,
        credits: shape.credits,
        acceptor_person_id: shape.acceptor,
        open_university_product_id: shape.product_id,
    };

    let mut unit: MockCourseUnit = store
        .get_json(generation, EntityHash::CourseUnits, &course_code)
        .await?
        .unwrap_or_else(|| MockCourseUnit {
            course_unit_id: ids::course_unit_id(&course_code),
            name: LocalizedName {
                fi: course_code.clone(),
                sv: course_code.clone(),
                en: course_code.clone(),
            },
            realisations: Vec::new(),
            behaviour: Default::default(),
            owner_course_slug: args.owner.as_ref().and_then(|owner| owner.course.clone()),
            course_code: course_code.clone(),
        });
    unit.behaviour.import_allowed = shape.import_allowed;
    unit.realisations
        .retain(|existing| existing.id != realisation.id);
    unit.realisations.push(realisation.clone());
    store
        .upsert_json(
            generation,
            EntityHash::CourseUnits,
            &BTreeMap::from([(course_code, unit)]),
        )
        .await?;
    store.reindex(generation).await?;
    Ok(realisation)
}

async fn put_person(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
    ripeness: Option<Ripeness>,
) -> Result<String, CommandError> {
    let student_number = match &args.student_number {
        Some(student_number) => student_number.clone(),
        None => {
            let sequence = store.next_person_seq(generation).await?;
            format!("99{sequence:07}")
        }
    };
    let person = MockPerson {
        person_id: ids::person_id(&student_number),
        first_names: args
            .first_names
            .clone()
            .unwrap_or_else(|| "Zzyzx".to_string()),
        last_name: args
            .last_name
            .clone()
            .unwrap_or_else(|| "Scenario".to_string()),
        primary_email: args
            .primary_email
            .clone()
            .unwrap_or_else(|| format!("zzyzx.scenario.{student_number}@helsinki.example")),
        secondary_email: args.secondary_email.clone(),
        behaviour: PersonBehaviour {
            ripeness,
            duplicate_detection: None,
        },
        owner_user_email: args.owner.as_ref().and_then(|owner| owner.user.clone()),
        student_number: student_number.clone(),
    };
    store
        .upsert_json(
            generation,
            EntityHash::Persons,
            &BTreeMap::from([(student_number.clone(), person)]),
        )
        .await?;
    store.reindex(generation).await?;
    Ok(student_number)
}

async fn put_enrolment(
    store: &MockSuotarStore,
    generation: &str,
    student_number: &str,
    course_code: &str,
    realisation: &MockRealisation,
    state: EnrolmentState,
    validity: DatePeriod,
) -> Result<String, CommandError> {
    let enrolment_id = ids::enrolment_id(student_number, realisation.kind);
    let enrolment = MockEnrolment {
        id: enrolment_id.clone(),
        student_number: student_number.to_string(),
        course_code: course_code.to_string(),
        realisation_id: realisation.id.clone(),
        state,
        study_right_id: ids::study_right_id(student_number, realisation.kind),
        study_right_validity_period: validity,
        enrolment_date_time: Utc::now(),
    };
    store
        .upsert_json(
            generation,
            EntityHash::Enrolments,
            &BTreeMap::from([(enrolment_id.clone(), enrolment)]),
        )
        .await?;
    store.reindex(generation).await?;
    Ok(enrolment_id)
}

async fn arm(
    store: &MockSuotarStore,
    generation: &str,
    id: &str,
    when: Vec<Predicate>,
    then: Effect,
    lifetime: Lifetime,
) -> Result<(), CommandError> {
    arm_fault(
        store,
        generation,
        FaultSpec {
            id: id.to_string(),
            when: WhenSpec::Predicates(when),
            then,
            lifetime,
            proves_double_submission: false,
        },
    )
    .await?;
    Ok(())
}

fn course_code(args: &ScenarioArgs) -> Result<String, CommandError> {
    args.course_code
        .clone()
        .ok_or_else(|| CommandError::new("missingArgument", "This scenario needs a courseCode."))
}

fn validity_now() -> DatePeriod {
    let now = Utc::now();
    DatePeriod {
        start_date: (now - Duration::days(365)).date_naive(),
        end_date: (now + Duration::days(365)).date_naive(),
    }
}

fn string_field(value: &serde_json::Value, field: &str) -> Result<String, CommandError> {
    value
        .get(field)
        .and_then(|value| value.as_str())
        .map(str::to_string)
        .ok_or_else(|| CommandError::new("internalError", format!("scenario lost its {field}")))
}

fn merge(target: &mut serde_json::Value, extra: serde_json::Value) {
    if let (Some(target), Some(extra)) = (target.as_object_mut(), extra.as_object()) {
        for (key, value) in extra {
            target.insert(key.clone(), value.clone());
        }
    }
}

fn endpoint_slug(endpoint: SuotarEndpoint) -> &'static str {
    match endpoint {
        SuotarEndpoint::ResolvePersons => "resolve-persons",
        SuotarEndpoint::ResolveEnrolments => "resolve-enrolments",
        SuotarEndpoint::ImportAttainments => "import",
        SuotarEndpoint::VerifyAttainments => "verify",
        SuotarEndpoint::ProductAccessTokens => "product-tokens",
        SuotarEndpoint::ListByCourse => "list-by-course",
    }
}
