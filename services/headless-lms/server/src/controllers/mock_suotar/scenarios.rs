//! Named scenarios: small compositions of the control primitives, exposed as one command.
//!
//! A scenario earns its place only by composing something data alone cannot express — an armed fault
//! — or by being a hands-free dev demo; per-spec fixtures come from the seed instead.
//!
//! Each writes the course unit for its `courseCode` whole, so its caller has to own that course code,
//! and returns the identifiers it minted plus the scope its rows are ticked with.

use std::collections::BTreeMap;

use chrono::Duration;
use serde_json::json;

use crate::prelude::*;

use super::commands::{CommandError, arm_fault};
use super::faults::{Effect, FaultSpec, Lifetime, OwnerRef, Predicate, Stage, WhenSpec};
use super::ids;
use super::store::{EntityHash, MockSuotarStore};
use super::wire::Endpoint;
use super::world::{
    CourseBehaviour, CreditRange, DatePeriod, LocalizedName, MockCourseUnit, MockEnrolment,
    MockPerson, MockRealisation, PersonBehaviour, RealisationKind, SuotarCourse,
};

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

pub const SCENARIOS: [&str; 3] = ["happy-path", "timeout-but-landed", "import-unanswered"];

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
        "happy-path" => plain(store, generation, &args).await?,
        "timeout-but-landed" => timeout(store, generation, &args).await?,
        "import-unanswered" => unanswered(store, generation, &args).await?,
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
) -> Result<serde_json::Value, CommandError> {
    let realisation = ensure_course(store, generation, args).await?;
    let student_number = put_person(store, generation, args).await?;
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

/// `sisuTimeout` after the write, with the written submission's id in `result`: the case a client cannot
/// resolve without verifying.
async fn timeout(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    arm_after_import(
        store,
        generation,
        args,
        "timeout",
        Stage::AfterWrite,
        Effect::ItemLevel {
            code: "sisuTimeout".to_string(),
            message: None,
        },
    )
    .await
}

/// The import lands but its item is missing from the response, so the client learns no id at all.
async fn unanswered(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<serde_json::Value, CommandError> {
    arm_after_import(
        store,
        generation,
        args,
        "unanswered",
        Stage::Respond,
        Effect::DropItem,
    )
    .await
}

async fn arm_after_import(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
    fault_prefix: &str,
    stage: Stage,
    effect: Effect,
) -> Result<serde_json::Value, CommandError> {
    let mut base = plain(store, generation, args).await?;
    let student_number = string_field(&base, "studentNumber")?;
    let course_code = string_field(&base, "courseCode")?;
    let fault_id = format!("{fault_prefix}-{student_number}-{course_code}");
    arm(
        store,
        generation,
        &fault_id,
        vec![
            Predicate::Endpoint(Endpoint::ImportAttainments),
            Predicate::Stage(stage),
            Predicate::StudentNumber(student_number.clone()),
            Predicate::CourseCode(course_code),
        ],
        effect,
        Lifetime {
            matching_items: Some(1),
            ..Default::default()
        },
    )
    .await?;
    merge(&mut base, json!({ "faultId": fault_id }));
    Ok(base)
}

/// A five-credit pass/fail course Suotar carries: the scenarios differ in the fault they arm, not in
/// their data.
async fn ensure_course(
    store: &MockSuotarStore,
    generation: &str,
    args: &ScenarioArgs,
) -> Result<MockRealisation, CommandError> {
    let course_code = course_code(args)?;
    let kind = args.realisation_kind.unwrap_or(RealisationKind::Degree);
    let now = Utc::now();
    let name = LocalizedName {
        fi: course_code.clone(),
        sv: course_code.clone(),
        en: course_code.clone(),
    };
    let realisation = MockRealisation {
        id: ids::realisation_id(&course_code, kind),
        name: Some(name.clone()),
        assessment_item_id: ids::assessment_item_id(&course_code, kind),
        kind,
        activity_period: Some(DatePeriod {
            start_date: (now - Duration::days(180)).date_naive(),
            end_date: Some((now + Duration::days(180)).date_naive()),
        }),
        grade_scale_id: None,
    };

    let mut unit: MockCourseUnit = store
        .get_json(generation, EntityHash::CourseUnits, &course_code)
        .await?
        .unwrap_or_else(|| MockCourseUnit {
            course_unit_id: ids::course_unit_id(&course_code),
            name,
            credits: None,
            grade_scale_id: None,
            realisations: Vec::new(),
            suotar_course: None,
            behaviour: CourseBehaviour::default(),
            owner_course_slug: args.owner.as_ref().and_then(|owner| owner.course.clone()),
            course_code: course_code.clone(),
        });
    unit.credits = Some(CreditRange {
        min: 5.0,
        max: Some(5.0),
    });
    unit.grade_scale_id = Some(PASS_FAIL_SCALE.to_string());
    unit.suotar_course = Some(SuotarCourse {
        name: course_code.clone(),
    });
    unit.behaviour = CourseBehaviour::default();
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
) -> Result<String, CommandError> {
    let student_number = match &args.student_number {
        Some(student_number) => student_number.clone(),
        None => {
            let sequence = store.next_person_seq(generation).await?;
            format!("99{sequence:07}")
        }
    };
    let person =
        MockPerson {
            person_id: ids::person_id(&student_number),
            first_names: Some(
                args.first_names
                    .clone()
                    .unwrap_or_else(|| "Zzyzx".to_string()),
            ),
            last_name: Some(
                args.last_name
                    .clone()
                    .unwrap_or_else(|| "Scenario".to_string()),
            ),
            primary_email: Some(args.primary_email.clone().unwrap_or_else(|| {
                format!("zzyzx.scenario.{student_number}@helsinki.example.com")
            })),
            secondary_email: args.secondary_email.clone(),
            behaviour: PersonBehaviour::default(),
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
    let enrolment =
        MockEnrolment::enrolled_now(student_number, course_code, realisation, Utc::now());
    let enrolment_id = enrolment.id.clone();
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
