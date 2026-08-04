//! Named scenarios: small compositions of the control primitives, exposed as one command.
//!
//! Deliberately few. Per-spec fixtures come from the seed, which is the better mechanism for
//! parallel specs, so a scenario earns its place only by composing something data alone cannot
//! express — an armed fault — or by being a hands-free dev demo. Everything else stays a primitive.
//!
//! Every scenario writes the course unit for its `courseCode` whole, realisation and course
//! behaviour included, so its caller has to own that course code. Each returns the identifiers it
//! minted and the scope its rows are ticked with, so a spec restates nothing.

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
    CreditRange, DatePeriod, EnrolmentState, LocalizedName, MockCourseUnit, MockEnrolment,
    MockPerson, MockRealisation, PersonBehaviour, RealisationKind, Ripeness,
};

const ACCEPTOR_PERSON_ID: &str = "hy-hlo-acceptor";
const PASS_FAIL_SCALE: &str = "sis-hyl-hyv";

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

pub const SCENARIOS: [&str; 5] = [
    "happy-path",
    "happy-path-auto",
    "timeout-but-landed",
    "timeout-nothing-landed",
    "post-send-death",
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
        "happy-path-auto" => {
            plain(
                store,
                generation,
                &args,
                Ripeness::AutoAfterVerifyCalls { calls: 1 },
            )
            .await?
        }
        "timeout-but-landed" => timeout(store, generation, &args, Stage::AfterWrite, true).await?,
        "timeout-nothing-landed" => {
            timeout(store, generation, &args, Stage::Resolve, false).await?
        }
        "post-send-death" => post_send_death(store, generation, &args).await?,
        _ => unreachable!("checked against the catalogue above"),
    };

    // The scope comes from the owner the caller passed, not from the fixtures touched.
    if let Some(object) = result.as_object_mut() {
        object.insert("scenario".to_string(), json!(name));
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

async fn plain(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
    ripeness: Ripeness,
) -> Result<serde_json::Value, CommandError> {
    let realisation = ensure_course(store, generation, args).await?;
    let student_number = put_person(store, generation, args, Some(ripeness)).await?;
    let course_code = course_code(args)?;
    let enrolment_id = put_enrolment(
        store,
        generation,
        &student_number,
        &course_code,
        &realisation,
    )
    .await?;
    Ok(json!({
        "studentNumber": student_number,
        "personId": ids::person_id(&student_number),
        "enrolmentId": enrolment_id,
        "realisationId": realisation.id,
        "courseCode": course_code,
        "kind": realisation.kind,
    }))
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
    // which is exactly the ground truth verify has to find. At `resolve` nothing landed.
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

/// A five-credit pass/fail realisation with an acceptor: every scenario here wants the course to be
/// registrable, and differs in the fault it arms rather than in its data.
async fn ensure_course(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<MockRealisation, CommandError> {
    let course_code = course_code(args)?;
    let kind = args.realisation_kind.unwrap_or(RealisationKind::Degree);
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
        grade_scale_id: PASS_FAIL_SCALE.to_string(),
        credits: CreditRange { min: 5.0, max: 5.0 },
        acceptor_person_id: Some(ACCEPTOR_PERSON_ID.to_string()),
        open_university_product_id: None,
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
    unit.behaviour.import_allowed = true;
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
) -> Result<String, CommandError> {
    let now = Utc::now();
    let enrolment_id = ids::enrolment_id(student_number, realisation.kind);
    let enrolment = MockEnrolment {
        id: enrolment_id.clone(),
        student_number: student_number.to_string(),
        course_code: course_code.to_string(),
        realisation_id: realisation.id.clone(),
        state: EnrolmentState::Enrolled,
        study_right_id: ids::study_right_id(student_number, realisation.kind),
        study_right_validity_period: DatePeriod {
            start_date: (now - Duration::days(365)).date_naive(),
            end_date: (now + Duration::days(365)).date_naive(),
        },
        enrolment_date_time: now,
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
