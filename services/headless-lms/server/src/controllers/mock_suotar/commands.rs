//! The control command RPC and the three inspection GETs.
//!
//! `execute` is a plain async function so the seed can drive the same surface from Rust.

use std::collections::BTreeMap;

use chrono::NaiveDate;
use serde::Deserializer;
use serde_json::json;
use sqlx::PgPool;

use crate::prelude::*;

use super::default_world;
use super::faults::{Fault, OwnerRef, Predicate, ResolvedOwner, Stage, validate};
use super::ids;
use super::scenarios;
use super::store::{EntityHash, MockSuotarStore, OwnerKeys, World};
use super::wire::Endpoint;
use super::world::{
    AttainmentLevel, AttainmentState, CourseBehaviour, CreditRange, DatePeriod, EnrolmentState,
    GradeScale, ImporterVisibility, LocalizedName, MockAttainment, MockCourseUnit, MockEnrolment,
    MockPerson, MockRealisation, MockStudyRight, MockSubmission, PENDING_WINDOW_HOURS,
    PersonBehaviour, RealisationKind, RecordedCall, SendState, SuotarCourse, WorldDefaults,
    person_course_key,
};

const DEFAULT_CALL_LIMIT: usize = 200;
const WORLD_DUMP_CALL_LIMIT: usize = 100;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", tag = "command")]
pub enum MockSuotarCommand {
    Reset {
        scope: ResetScope,
    },
    PushWorld(WorldPush),
    UpsertPersons {
        persons: Vec<PersonUpsert>,
    },
    #[serde(rename_all = "camelCase")]
    UpsertCourseUnits {
        course_units: Vec<CourseUnitUpsert>,
    },
    UpsertEnrolments {
        enrolments: Vec<EnrolmentUpsert>,
    },
    UpsertAttainments {
        attainments: Vec<AttainmentUpsert>,
    },
    #[serde(rename_all = "camelCase")]
    DeletePersons {
        student_numbers: Vec<String>,
    },
    AllocatePerson(AllocatePerson),
    #[serde(rename_all = "camelCase")]
    GenerateRoster {
        course_code: String,
        realisation_id: String,
        count: u32,
        #[serde(default)]
        student_number_prefix: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    SetPersonBehaviour {
        student_number: String,
        patch: PersonBehaviourPatch,
    },
    #[serde(rename_all = "camelCase")]
    SetCourseBehaviour {
        course_code: String,
        patch: CourseBehaviourPatch,
    },
    #[serde(rename_all = "camelCase")]
    TransitionSubmission {
        submitted_attainment_id: String,
        to: SubmissionTarget,
    },
    #[serde(rename_all = "camelCase")]
    TransitionSubmissionsFor {
        student_number: String,
        course_code: Option<String>,
        to: SubmissionTarget,
    },
    ListSubmissions(SubmissionFilter),
    ArmFault(super::faults::FaultSpec),
    DisarmFault {
        id: String,
    },
    DisarmFaults {
        owner: OwnerRef,
    },
    ListFaults(FaultFilter),
    SetDefaults {
        patch: DefaultsPatch,
    },
    ApplyScenario {
        name: String,
        #[serde(default)]
        args: scenarios::ScenarioArgs,
    },
    ListCalls(CallFilter),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ResetScope {
    World,
    Faults,
    Calls,
    Persons(PersonScope),
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonScope {
    pub student_numbers: Option<Vec<String>>,
    pub owner: Option<OwnerRef>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldPush {
    pub defaults: Option<WorldDefaults>,
    #[serde(default)]
    pub persons: Vec<PersonUpsert>,
    #[serde(default)]
    pub course_units: Vec<CourseUnitUpsert>,
    #[serde(default)]
    pub enrolments: Vec<EnrolmentUpsert>,
    #[serde(default)]
    pub attainments: Vec<AttainmentUpsert>,
    #[serde(default)]
    pub submissions: Vec<MockSubmission>,
    #[serde(default)]
    pub sisu_violations: Vec<SisuViolationsUpsert>,
}

/// What Sisu refuses an attainment of this student on this course with, answered as
/// `sisuValidationFailed`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SisuViolationsUpsert {
    pub student_number: String,
    pub course_code: String,
    pub violations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonUpsert {
    pub student_number: String,
    pub person_id: Option<String>,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub primary_email: Option<String>,
    pub secondary_email: Option<String>,
    #[serde(default)]
    pub behaviour: PersonBehaviour,
    pub owner_user_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RealisationUpsert {
    pub id: Option<String>,
    pub name: Option<LocalizedName>,
    pub assessment_item_id: Option<String>,
    #[serde(default = "degree")]
    pub kind: RealisationKind,
    pub activity_period: Option<DatePeriod>,
    /// The assessment item's own scale; absent falls back to the course unit's.
    pub grade_scale_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseUnitUpsert {
    pub course_code: String,
    pub course_unit_id: Option<String>,
    pub name: Option<LocalizedName>,
    pub credits: Option<CreditRange>,
    pub grade_scale_id: Option<String>,
    #[serde(default)]
    pub realisations: Vec<RealisationUpsert>,
    /// Never defaulted: absent is a code Suotar does not carry.
    pub suotar_course: Option<SuotarCourse>,
    #[serde(default)]
    pub behaviour: CourseBehaviour,
    pub owner_course_slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentUpsert {
    pub id: Option<String>,
    pub student_number: String,
    pub course_code: String,
    pub realisation_id: Option<String>,
    #[serde(default = "degree")]
    pub kind: RealisationKind,
    pub state: EnrolmentState,
    /// Absent derives one from `kind`; an explicit `null` is an enrolment with no study right.
    #[serde(
        default,
        deserialize_with = "explicit_null",
        skip_serializing_if = "Option::is_none"
    )]
    pub study_right_id: Option<Option<String>>,
    /// Absent is a study right the importer did not return.
    pub study_right_validity_period: Option<DatePeriod>,
    pub study_right_grant_date: Option<NaiveDate>,
    /// Absent is now; an explicit `null` is an enrolment the importer hands over no time for.
    #[serde(
        default,
        deserialize_with = "explicit_null",
        skip_serializing_if = "Option::is_none"
    )]
    pub enrolment_date_time: Option<Option<DateTime<Utc>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttainmentUpsert {
    pub id: Option<String>,
    pub student_number: String,
    pub course_code: String,
    pub person_id: Option<String>,
    #[serde(default = "degree")]
    pub kind: RealisationKind,
    pub attainment_type: Option<String>,
    pub state: Option<AttainmentState>,
    pub attainment_date: NaiveDate,
    pub registration_date: Option<NaiveDate>,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub passed: Option<bool>,
    pub credits: Option<f64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AllocatePerson {
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub primary_email: Option<String>,
    pub secondary_email: Option<String>,
    pub owner_user_email: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonBehaviourPatch {
    pub study_right_unresolvable: Option<bool>,
    pub primary_email: Option<String>,
    pub secondary_email: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseBehaviourPatch {
    pub no_acceptors: Option<bool>,
    pub acceptor_lookup_fails: Option<bool>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SubmissionTarget {
    Registered,
    PartiallyRegistered,
    Misregistered,
    NotRegistered,
    TimedOutButLanded,
    TimedOutNothingLanded,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmissionFilter {
    pub student_number: Option<String>,
    pub course_code: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FaultFilter {
    pub id: Option<String>,
    pub owner: Option<OwnerRef>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultsPatch {
    pub accepted_token: Option<String>,
    pub grade_scales: Option<Vec<GradeScale>>,
    pub call_log_capacity: Option<usize>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallFilter {
    pub endpoint: Option<Endpoint>,
    pub student_number: Option<String>,
    pub course_code: Option<String>,
    pub request_item_id: Option<String>,
    pub fault_id: Option<String>,
    pub correlation_id: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum CommandResult {
    Ok {
        command: String,
        result: serde_json::Value,
    },
    Error {
        command: Option<String>,
        code: String,
        message: String,
    },
    NotImplemented {
        command: String,
    },
}

pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl CommandError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
        }
    }
}

impl From<anyhow::Error> for CommandError {
    fn from(error: anyhow::Error) -> Self {
        Self::new("internalError", error.to_string())
    }
}

type Outcome = Result<serde_json::Value, CommandError>;

impl MockSuotarCommand {
    pub fn name(&self) -> &'static str {
        match self {
            Self::Reset { .. } => "reset",
            Self::PushWorld(_) => "pushWorld",
            Self::UpsertPersons { .. } => "upsertPersons",
            Self::UpsertCourseUnits { .. } => "upsertCourseUnits",
            Self::UpsertEnrolments { .. } => "upsertEnrolments",
            Self::UpsertAttainments { .. } => "upsertAttainments",
            Self::DeletePersons { .. } => "deletePersons",
            Self::AllocatePerson(_) => "allocatePerson",
            Self::GenerateRoster { .. } => "generateRoster",
            Self::SetPersonBehaviour { .. } => "setPersonBehaviour",
            Self::SetCourseBehaviour { .. } => "setCourseBehaviour",
            Self::TransitionSubmission { .. } => "transitionSubmission",
            Self::TransitionSubmissionsFor { .. } => "transitionSubmissionsFor",
            Self::ListSubmissions(_) => "listSubmissions",
            Self::ArmFault(_) => "armFault",
            Self::DisarmFault { .. } => "disarmFault",
            Self::DisarmFaults { .. } => "disarmFaults",
            Self::ListFaults(_) => "listFaults",
            Self::SetDefaults { .. } => "setDefaults",
            Self::ApplyScenario { .. } => "applyScenario",
            Self::ListCalls(_) => "listCalls",
        }
    }
}

pub async fn execute(
    store: &MockSuotarStore,
    pool: &PgPool,
    command: MockSuotarCommand,
) -> CommandResult {
    let name = command.name().to_string();
    match run(store, pool, command).await {
        Ok(result) => CommandResult::Ok {
            command: name,
            result,
        },
        Err(error) => CommandResult::Error {
            command: Some(name),
            code: error.code,
            message: error.message,
        },
    }
}

async fn run(store: &MockSuotarStore, pool: &PgPool, command: MockSuotarCommand) -> Outcome {
    // `reset { world }` installs nothing: the next contract request builds the world lazily.
    if let MockSuotarCommand::Reset {
        scope: ResetScope::World,
    } = &command
    {
        store.flush().await?;
        return Ok(json!({ "flushed": true }));
    }
    if let MockSuotarCommand::PushWorld(push) = command {
        let marker = default_world::db_generation_marker(pool).await;
        let world = world_from_push(push);
        let counts = json!({
            "persons": world.persons.len(),
            "courseUnits": world.course_units.len(),
            "enrolments": world.enrolments.len(),
            "attainments": world.attainments.len(),
            "submissions": world.submissions.len(),
            "sisuViolations": world.sisu_violations.len(),
        });
        let generation = store.install_world(&world, marker.as_deref()).await?;
        return Ok(json!({ "generation": generation, "counts": counts }));
    }

    let generation = current_generation(store, pool).await?;
    match command {
        MockSuotarCommand::Reset { scope } => reset(store, &generation, scope).await,
        MockSuotarCommand::PushWorld(_) => unreachable!("handled above"),
        MockSuotarCommand::UpsertPersons { persons } => {
            upsert_command(
                store,
                &generation,
                EntityHash::Persons,
                "studentNumbers",
                persons,
                person_from,
                |person| person.student_number.clone(),
            )
            .await
        }
        MockSuotarCommand::UpsertCourseUnits { course_units } => {
            upsert_command(
                store,
                &generation,
                EntityHash::CourseUnits,
                "courseCodes",
                course_units,
                course_unit_from,
                |unit| unit.course_code.clone(),
            )
            .await
        }
        MockSuotarCommand::UpsertEnrolments { enrolments } => {
            upsert_command(
                store,
                &generation,
                EntityHash::Enrolments,
                "enrolmentIds",
                enrolments,
                enrolment_from,
                |enrolment| enrolment.id.clone(),
            )
            .await
        }
        MockSuotarCommand::UpsertAttainments { attainments } => {
            upsert_command(
                store,
                &generation,
                EntityHash::Attainments,
                "attainmentIds",
                attainments,
                attainment_from,
                |attainment| attainment.id.clone(),
            )
            .await
        }
        MockSuotarCommand::DeletePersons { student_numbers } => {
            delete_persons(store, &generation, &student_numbers).await
        }
        MockSuotarCommand::AllocatePerson(args) => allocate_person(store, &generation, args).await,
        MockSuotarCommand::GenerateRoster {
            course_code,
            realisation_id,
            count,
            student_number_prefix,
        } => {
            generate_roster(
                store,
                &generation,
                &course_code,
                &realisation_id,
                count,
                student_number_prefix.as_deref(),
            )
            .await
        }
        MockSuotarCommand::SetPersonBehaviour {
            student_number,
            patch,
        } => {
            let mut person: MockPerson = store
                .get_json(&generation, EntityHash::Persons, &student_number)
                .await?
                .ok_or_else(|| {
                    CommandError::new(
                        "unknownPerson",
                        format!("No person `{student_number}` in the world."),
                    )
                })?;
            if let Some(unresolvable) = patch.study_right_unresolvable {
                person.behaviour.study_right_unresolvable = unresolvable;
            }
            if let Some(email) = patch.primary_email {
                person.primary_email = Some(email);
            }
            if let Some(email) = patch.secondary_email {
                person.secondary_email = Some(email);
            }
            store
                .upsert_json(
                    &generation,
                    EntityHash::Persons,
                    &BTreeMap::from([(student_number.clone(), person)]),
                )
                .await?;
            Ok(json!({ "studentNumber": student_number }))
        }
        MockSuotarCommand::SetCourseBehaviour { course_code, patch } => {
            let mut unit: MockCourseUnit = store
                .get_json(&generation, EntityHash::CourseUnits, &course_code)
                .await?
                .ok_or_else(|| {
                    CommandError::new(
                        "unknownCourseUnit",
                        format!("No course unit `{course_code}` in the world."),
                    )
                })?;
            if let Some(no_acceptors) = patch.no_acceptors {
                unit.behaviour.no_acceptors = no_acceptors;
            }
            if let Some(fails) = patch.acceptor_lookup_fails {
                unit.behaviour.acceptor_lookup_fails = fails;
            }
            store
                .upsert_json(
                    &generation,
                    EntityHash::CourseUnits,
                    &BTreeMap::from([(course_code.clone(), unit)]),
                )
                .await?;
            Ok(json!({ "courseCode": course_code }))
        }
        MockSuotarCommand::TransitionSubmission {
            submitted_attainment_id,
            to,
        } => transition(store, &generation, &[submitted_attainment_id], to).await,
        MockSuotarCommand::TransitionSubmissionsFor {
            student_number,
            course_code,
            to,
        } => {
            let ids =
                submission_ids_for(store, &generation, &student_number, course_code.as_deref())
                    .await?;
            transition(store, &generation, &ids, to).await
        }
        MockSuotarCommand::ListSubmissions(filter) => {
            let submissions: BTreeMap<String, MockSubmission> =
                store.all_json(&generation, EntityHash::Submissions).await?;
            let matching: Vec<&MockSubmission> = submissions
                .values()
                .filter(|submission| {
                    filter
                        .student_number
                        .as_ref()
                        .is_none_or(|value| &submission.student_number == value)
                        && filter
                            .course_code
                            .as_ref()
                            .is_none_or(|value| &submission.course_code == value)
                })
                .collect();
            Ok(json!({ "submissions": matching }))
        }
        MockSuotarCommand::ArmFault(spec) => arm_fault(store, &generation, spec).await,
        MockSuotarCommand::DisarmFault { id } => {
            store
                .disarm_faults(&generation, std::slice::from_ref(&id))
                .await?;
            Ok(json!({ "disarmed": [id] }))
        }
        MockSuotarCommand::DisarmFaults { owner } => {
            let resolved = resolve_owner(store, &generation, &owner).await?;
            let ids: Vec<String> = store
                .faults(&generation)
                .await?
                .into_iter()
                .filter(|fault| fault.owner.as_ref().is_some_and(|o| overlaps(o, &resolved)))
                .map(|fault| fault.id)
                .collect();
            store.disarm_faults(&generation, &ids).await?;
            Ok(json!({ "disarmed": ids }))
        }
        MockSuotarCommand::ListFaults(filter) => {
            let remaining = store.remaining_budgets(&generation).await?;
            let faults: Vec<serde_json::Value> = store
                .faults(&generation)
                .await?
                .into_iter()
                .filter(|fault| filter.id.as_ref().is_none_or(|id| &fault.id == id))
                .map(|fault| {
                    let left = remaining.get(&fault.id).copied().unwrap_or(0);
                    let spent = fault.lifetime.budget().is_some() && left <= 0;
                    json!({ "fault": fault, "remaining": left, "spent": spent })
                })
                .collect();
            Ok(json!({ "faults": faults }))
        }
        MockSuotarCommand::SetDefaults { patch } => {
            let mut defaults = store.preamble(&generation).await?.defaults;
            apply_defaults_patch(&mut defaults, patch);
            store.set_defaults(&generation, &defaults).await?;
            Ok(serde_json::to_value(&defaults).unwrap_or(serde_json::Value::Null))
        }
        MockSuotarCommand::ApplyScenario { name, args } => {
            scenarios::apply(store, &generation, &name, args).await
        }
        MockSuotarCommand::ListCalls(filter) => list_calls(store, &generation, filter).await,
    }
}

/// The shared body behind every `Upsert*` command. `key_of` reads the id off the built entity rather
/// than the wire type, so a derived id is what comes back under `result_key`.
async fn upsert_command<U, T: Serialize>(
    store: &MockSuotarStore,
    generation: &str,
    hash: EntityHash,
    result_key: &'static str,
    items: Vec<U>,
    build: impl Fn(U) -> T,
    key_of: impl Fn(&T) -> String,
) -> Outcome {
    let entries: BTreeMap<String, T> = items
        .into_iter()
        .map(|item| {
            let entity = build(item);
            (key_of(&entity), entity)
        })
        .collect();
    let mut result = serde_json::Map::new();
    result.insert(
        result_key.to_string(),
        json!(entries.keys().collect::<Vec<_>>()),
    );
    store.upsert_json(generation, hash, &entries).await?;
    store.reindex(generation).await?;
    Ok(serde_json::Value::Object(result))
}

/// Builds the world lazily if a command arrives before any contract request has.
async fn current_generation(
    store: &MockSuotarStore,
    pool: &PgPool,
) -> Result<String, CommandError> {
    if let Some(generation) = store.live_generation().await?
        && store.preamble(&generation).await?.defaults_present
    {
        return Ok(generation);
    }
    let marker = default_world::db_generation_marker(pool).await;
    Ok(store
        .install_if_absent(&default_world::build(), marker.as_deref())
        .await?)
}

async fn reset(store: &MockSuotarStore, generation: &str, scope: ResetScope) -> Outcome {
    match scope {
        // `Reset { scope: World }` never reaches this match — `run()` intercepts it first.
        ResetScope::World => unreachable!("world reset is handled in `run` before dispatch"),
        ResetScope::Faults => {
            store.clear_faults(generation).await?;
            Ok(json!({ "cleared": "faults" }))
        }
        ResetScope::Calls => {
            store.clear_hash(generation, EntityHash::Calls).await?;
            Ok(json!({ "cleared": "calls" }))
        }
        ResetScope::Persons(scope) => {
            let mut student_numbers = scope.student_numbers.unwrap_or_default();
            if let Some(owner) = scope.owner {
                let resolved = resolve_owner(store, generation, &owner).await?;
                student_numbers.extend(resolved.student_numbers);
            }
            student_numbers.sort();
            student_numbers.dedup();
            delete_persons(store, generation, &student_numbers).await
        }
    }
}

/// Destructive with no undo: nothing keeps a copy of a person a spec upserted.
async fn delete_persons(
    store: &MockSuotarStore,
    generation: &str,
    student_numbers: &[String],
) -> Outcome {
    let submissions: BTreeMap<String, MockSubmission> =
        store.all_json(generation, EntityHash::Submissions).await?;
    let attainments: BTreeMap<String, MockAttainment> =
        store.all_json(generation, EntityHash::Attainments).await?;
    let enrolments: BTreeMap<String, MockEnrolment> =
        store.all_json(generation, EntityHash::Enrolments).await?;

    let doomed_submissions: Vec<String> = submissions
        .values()
        .filter(|s| student_numbers.contains(&s.student_number))
        .map(|s| s.submitted_attainment_id.clone())
        .collect();
    let doomed_attainments: Vec<String> = attainments
        .values()
        .filter(|a| student_numbers.contains(&a.student_number))
        .map(|a| a.id.clone())
        .collect();
    let doomed_enrolments: Vec<String> = enrolments
        .values()
        .filter(|e| student_numbers.contains(&e.student_number))
        .map(|e| e.id.clone())
        .collect();

    store
        .delete_fields(generation, EntityHash::Persons, student_numbers)
        .await?;
    store
        .delete_fields(generation, EntityHash::Submissions, &doomed_submissions)
        .await?;
    store
        .delete_fields(generation, EntityHash::Attainments, &doomed_attainments)
        .await?;
    store
        .delete_fields(generation, EntityHash::Enrolments, &doomed_enrolments)
        .await?;
    store.reindex(generation).await?;
    Ok(json!({
        "studentNumbers": student_numbers,
        "submissions": doomed_submissions,
        "attainments": doomed_attainments,
        "enrolments": doomed_enrolments,
    }))
}

/// Draws from a range disjoint from the seed's per-spec blocks. A convenience, not an isolation
/// primitive.
async fn allocate_person(
    store: &MockSuotarStore,
    generation: &str,
    args: AllocatePerson,
) -> Outcome {
    let sequence = store.next_person_seq(generation).await?;
    let student_number = format!("99{sequence:07}");
    let person =
        MockPerson {
            person_id: ids::person_id(&student_number),
            first_names: Some(args.first_names.unwrap_or_else(|| "Zzyzx".to_string())),
            last_name: Some(args.last_name.unwrap_or_else(|| "Allocated".to_string())),
            primary_email: Some(args.primary_email.unwrap_or_else(|| {
                format!("zzyzx.allocated.{student_number}@helsinki.example.com")
            })),
            secondary_email: args.secondary_email,
            behaviour: PersonBehaviour::default(),
            owner_user_email: args.owner_user_email,
            student_number: student_number.clone(),
        };
    let result = json!({ "studentNumber": student_number, "personId": person.person_id });
    store
        .upsert_json(
            generation,
            EntityHash::Persons,
            &BTreeMap::from([(student_number, person)]),
        )
        .await?;
    store.reindex(generation).await?;
    Ok(result)
}

async fn generate_roster(
    store: &MockSuotarStore,
    generation: &str,
    course_code: &str,
    realisation_id: &str,
    count: u32,
    student_number_prefix: Option<&str>,
) -> Outcome {
    let unit: MockCourseUnit = store
        .get_json(generation, EntityHash::CourseUnits, course_code)
        .await?
        .ok_or_else(|| {
            CommandError::new(
                "unknownCourseUnit",
                format!("No course unit `{course_code}` in the world."),
            )
        })?;
    let realisation = unit.realisation(realisation_id).cloned().ok_or_else(|| {
        CommandError::new(
            "unknownRealisation",
            format!("`{realisation_id}` is not a realisation of `{course_code}`."),
        )
    })?;
    // The allocator range, clear of every seeded fixture's `900…` number.
    let prefix = student_number_prefix.unwrap_or("99");
    let now = Utc::now();

    let mut persons = BTreeMap::new();
    let mut enrolments = BTreeMap::new();
    let mut student_numbers = Vec::new();
    for _ in 0..count {
        let sequence = store.next_person_seq(generation).await?;
        let student_number = format!("{prefix}{sequence:07}");
        student_numbers.push(student_number.clone());
        persons.insert(
            student_number.clone(),
            MockPerson {
                person_id: ids::person_id(&student_number),
                first_names: Some("Zzyzx".to_string()),
                last_name: Some(format!("Roster{sequence}")),
                primary_email: Some(format!(
                    "zzyzx.roster.{student_number}@helsinki.example.com"
                )),
                secondary_email: None,
                behaviour: PersonBehaviour::default(),
                owner_user_email: None,
                student_number: student_number.clone(),
            },
        );
        let enrolment =
            MockEnrolment::enrolled_now(&student_number, course_code, &realisation, now);
        enrolments.insert(enrolment.id.clone(), enrolment);
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
        "realisationId": realisation_id,
        "studentNumbers": student_numbers,
    }))
}

async fn submission_ids_for(
    store: &MockSuotarStore,
    generation: &str,
    student_number: &str,
    course_code: Option<&str>,
) -> Result<Vec<String>, CommandError> {
    let submissions: BTreeMap<String, MockSubmission> =
        store.all_json(generation, EntityHash::Submissions).await?;
    Ok(submissions
        .values()
        .filter(|submission| submission.student_number == student_number)
        .filter(|submission| course_code.is_none_or(|code| submission.course_code == code))
        .map(|submission| submission.submitted_attainment_id.clone())
        .collect())
}

/// Moves submissions to where the importer and the send would have left them. Attainments minted
/// from a submission are replaced wholesale, so a later transition never leaves an earlier one's
/// attainment behind.
async fn transition(
    store: &MockSuotarStore,
    generation: &str,
    ids: &[String],
    to: SubmissionTarget,
) -> Outcome {
    let now = Utc::now();
    let mut updated: BTreeMap<String, MockSubmission> = BTreeMap::new();
    let mut minted: BTreeMap<String, MockAttainment> = BTreeMap::new();
    let mut retired: Vec<String> = Vec::new();
    let defaults = store.preamble(generation).await?.defaults;

    for id in ids {
        let Some(mut submission): Option<MockSubmission> = store
            .get_json(generation, EntityHash::Submissions, id)
            .await?
        else {
            return Err(CommandError::new(
                "unknownSubmission",
                format!("No submission `{id}` in the world."),
            ));
        };
        let final_id = ids::final_attainment_id(id);
        retired.extend([id.clone(), final_id.clone()]);
        let mut mint = |attainment_id: &str, level: AttainmentLevel, state: AttainmentState| {
            let attainment = MockAttainment::from_submission(
                &submission,
                attainment_id,
                level,
                state,
                &defaults,
                now,
            );
            minted.insert(attainment_id.to_string(), attainment);
        };
        let importer = match to {
            SubmissionTarget::Registered | SubmissionTarget::TimedOutButLanded => {
                mint(&final_id, AttainmentLevel::Final, AttainmentState::Attained);
                ImporterVisibility::Final {
                    attainment_id: final_id,
                }
            }
            SubmissionTarget::PartiallyRegistered => {
                mint(id, AttainmentLevel::Partial, AttainmentState::Attained);
                ImporterVisibility::Partial {
                    attainment_id: id.clone(),
                }
            }
            SubmissionTarget::Misregistered => {
                mint(
                    &final_id,
                    AttainmentLevel::Final,
                    AttainmentState::Misregistered,
                );
                ImporterVisibility::Misregistered {
                    attainment_id: final_id,
                }
            }
            SubmissionTarget::NotRegistered | SubmissionTarget::TimedOutNothingLanded => {
                ImporterVisibility::None
            }
        };
        submission.importer = importer;
        match to {
            SubmissionTarget::NotRegistered => submission.send_state = SendState::Rejected,
            SubmissionTarget::TimedOutButLanded => submission.send_state = SendState::Attempted,
            SubmissionTarget::TimedOutNothingLanded => {
                submission.send_state = SendState::Attempted;
                submission.created_at = submission
                    .created_at
                    .min(now - chrono::Duration::hours(PENDING_WINDOW_HOURS + 1));
            }
            // A misregistration is a later correction in Sisu, past Suotar's recent-send check.
            SubmissionTarget::Misregistered => {
                submission.created_at = submission
                    .created_at
                    .min(now - chrono::Duration::hours(super::logic::RECENTLY_ACCEPTED_HOURS + 1));
            }
            SubmissionTarget::Registered | SubmissionTarget::PartiallyRegistered => {}
        }
        updated.insert(id.clone(), submission);
    }

    retired.retain(|id| !minted.contains_key(id));
    store
        .delete_fields(generation, EntityHash::Attainments, &retired)
        .await?;
    store
        .upsert_json(generation, EntityHash::Submissions, &updated)
        .await?;
    store
        .upsert_json(generation, EntityHash::Attainments, &minted)
        .await?;
    store.reindex(generation).await?;
    Ok(json!({
        "submittedAttainmentIds": updated.keys().collect::<Vec<_>>(),
        "attainmentIds": minted.keys().collect::<Vec<_>>(),
    }))
}

pub async fn arm_fault(
    store: &MockSuotarStore,
    generation: &str,
    spec: super::faults::FaultSpec,
) -> Outcome {
    let (fault, _) = build_fault(store, generation, spec).await?;
    let result = json!({
        "id": fault.id,
        "parallelSafe": fault.parallel_safe,
        "owner": fault.owner,
        "seq": fault.seq,
    });
    store.arm_fault(generation, &fault).await?;
    Ok(result)
}

async fn build_fault(
    store: &MockSuotarStore,
    generation: &str,
    spec: super::faults::FaultSpec,
) -> Result<(Fault, (Endpoint, Stage)), CommandError> {
    let predicates = spec.when.into_predicates();
    let validated = validate(&predicates, &spec.then, spec.proves_double_submission)
        .map_err(|problem| CommandError::new(&problem.code, problem.message))?;
    let owner = match predicates.iter().find_map(|predicate| match predicate {
        Predicate::Owner(owner) => Some(owner.clone()),
        _ => None,
    }) {
        Some(owner) => Some(resolve_owner(store, generation, &owner).await?),
        None => None,
    };
    let parallel_safe = predicates.iter().any(|predicate| {
        matches!(
            predicate,
            Predicate::Owner(_) | Predicate::StudentNumber(_) | Predicate::CourseCode(_)
        )
    });
    let seq = store.next_fault_seq(generation).await?;
    Ok((
        Fault {
            id: spec.id,
            seq,
            when: predicates,
            then: spec.then,
            lifetime: spec.lifetime,
            proves_double_submission: spec.proves_double_submission,
            owner,
            parallel_safe,
            armed_at: Utc::now(),
        },
        validated,
    ))
}

async fn resolve_owner(
    store: &MockSuotarStore,
    generation: &str,
    owner: &OwnerRef,
) -> Result<ResolvedOwner, CommandError> {
    let mut resolved = ResolvedOwner {
        user: owner.user.clone(),
        course: owner.course.clone(),
        ..Default::default()
    };
    for (half, prefix) in [
        (owner.user.as_ref(), "user"),
        (owner.course.as_ref(), "course"),
    ] {
        let Some(value) = half else { continue };
        let field = format!("{prefix}:{value}");
        let Some(keys): Option<OwnerKeys> = store.owner_keys(generation, &field).await? else {
            // A fault that can never match must not be armed silently.
            let known = store.known_owner_refs(generation).await?.join(", ");
            return Err(CommandError::new(
                "unknownOwner",
                format!("`{field}` names nobody in the world. It knows: {known}."),
            ));
        };
        if prefix == "user" {
            resolved.student_numbers = keys.student_numbers;
        } else {
            resolved.course_codes = keys.course_codes;
        }
    }
    Ok(resolved)
}

fn overlaps(fault_owner: &ResolvedOwner, wanted: &ResolvedOwner) -> bool {
    let user_matches = wanted.user.is_some() && fault_owner.user == wanted.user;
    let course_matches = wanted.course.is_some() && fault_owner.course == wanted.course;
    user_matches || course_matches
}

async fn list_calls(store: &MockSuotarStore, generation: &str, filter: CallFilter) -> Outcome {
    let limit = filter.limit.unwrap_or(DEFAULT_CALL_LIMIT);
    let calls = store.recent_calls(generation, limit).await?;
    let matching: Vec<&RecordedCall> = calls
        .iter()
        .filter(|call| {
            filter
                .endpoint
                .is_none_or(|endpoint| call.endpoint == endpoint)
        })
        .filter(|call| {
            filter
                .correlation_id
                .as_ref()
                .is_none_or(|id| call.correlation_id.as_ref() == Some(id))
        })
        .filter(|call| {
            filter
                .fault_id
                .as_ref()
                .is_none_or(|id| call.faults.applied.contains(id))
        })
        // One item must match every item-level key: a batch holding (A, X) and (B, Y) is no call
        // for (A, Y).
        .filter(|call| {
            call.items.iter().any(|item| {
                filter
                    .student_number
                    .as_ref()
                    .is_none_or(|value| item.student_number.as_ref() == Some(value))
                    && filter
                        .course_code
                        .as_ref()
                        .is_none_or(|value| item.course_code.as_ref() == Some(value))
                    && filter
                        .request_item_id
                        .as_ref()
                        .is_none_or(|value| &item.request_item_id == value)
            }) || (filter.student_number.is_none()
                && filter.course_code.is_none()
                && filter.request_item_id.is_none())
        })
        .collect();
    Ok(json!({ "calls": matching, "scanned": calls.len() }))
}

fn apply_defaults_patch(defaults: &mut WorldDefaults, patch: DefaultsPatch) {
    if let Some(value) = patch.accepted_token {
        defaults.accepted_token = value;
    }
    if let Some(value) = patch.grade_scales {
        defaults.grade_scales = value;
    }
    if let Some(value) = patch.call_log_capacity {
        defaults.call_log_capacity = value;
    }
}

pub fn world_from_push(push: WorldPush) -> World {
    World {
        defaults: push.defaults.unwrap_or_default(),
        persons: push
            .persons
            .into_iter()
            .map(|person| (person.student_number.clone(), person_from(person)))
            .collect(),
        course_units: push
            .course_units
            .into_iter()
            .map(|unit| (unit.course_code.clone(), course_unit_from(unit)))
            .collect(),
        enrolments: push
            .enrolments
            .into_iter()
            .map(|enrolment| {
                let enrolment = enrolment_from(enrolment);
                (enrolment.id.clone(), enrolment)
            })
            .collect(),
        attainments: push
            .attainments
            .into_iter()
            .map(|attainment| {
                let attainment = attainment_from(attainment);
                (attainment.id.clone(), attainment)
            })
            .collect(),
        submissions: push
            .submissions
            .into_iter()
            .map(|submission| (submission.submitted_attainment_id.clone(), submission))
            .collect(),
        sisu_violations: push
            .sisu_violations
            .into_iter()
            .filter(|upsert| !upsert.violations.is_empty())
            .map(|upsert| {
                (
                    person_course_key(&upsert.student_number, &upsert.course_code),
                    upsert.violations,
                )
            })
            .collect(),
    }
}

fn degree() -> RealisationKind {
    RealisationKind::Degree
}

/// Keeps an explicit `null` apart from an absent key, which serde otherwise folds together.
fn explicit_null<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

fn person_from(upsert: PersonUpsert) -> MockPerson {
    MockPerson {
        person_id: upsert
            .person_id
            .unwrap_or_else(|| ids::person_id(&upsert.student_number)),
        student_number: upsert.student_number,
        first_names: upsert.first_names,
        last_name: upsert.last_name,
        primary_email: upsert.primary_email,
        secondary_email: upsert.secondary_email,
        behaviour: upsert.behaviour,
        owner_user_email: upsert.owner_user_email,
    }
}

fn course_unit_from(upsert: CourseUnitUpsert) -> MockCourseUnit {
    let course_code = upsert.course_code;
    let name = upsert.name.unwrap_or_else(|| localized(&course_code));
    MockCourseUnit {
        course_unit_id: upsert
            .course_unit_id
            .unwrap_or_else(|| ids::course_unit_id(&course_code)),
        realisations: upsert
            .realisations
            .into_iter()
            .map(|realisation| MockRealisation {
                id: realisation
                    .id
                    .unwrap_or_else(|| ids::realisation_id(&course_code, realisation.kind)),
                name: Some(realisation.name.unwrap_or_else(|| name.clone())),
                assessment_item_id: realisation
                    .assessment_item_id
                    .unwrap_or_else(|| ids::assessment_item_id(&course_code, realisation.kind)),
                kind: realisation.kind,
                activity_period: realisation.activity_period,
                grade_scale_id: realisation.grade_scale_id,
            })
            .collect(),
        credits: upsert.credits,
        grade_scale_id: upsert.grade_scale_id,
        suotar_course: upsert.suotar_course,
        behaviour: upsert.behaviour,
        owner_course_slug: upsert.owner_course_slug,
        name,
        course_code,
    }
}

fn enrolment_from(upsert: EnrolmentUpsert) -> MockEnrolment {
    MockEnrolment {
        id: upsert.id.unwrap_or_else(|| {
            ids::enrolment_id(&upsert.student_number, &upsert.course_code, upsert.kind)
        }),
        realisation_id: upsert
            .realisation_id
            .unwrap_or_else(|| ids::realisation_id(&upsert.course_code, upsert.kind)),
        study_right_id: upsert
            .study_right_id
            .unwrap_or_else(|| Some(ids::study_right_id(&upsert.student_number, upsert.kind))),
        study_right: upsert
            .study_right_validity_period
            .map(|validity| MockStudyRight {
                validity,
                grant_date: upsert.study_right_grant_date,
            }),
        enrolment_date_time: upsert
            .enrolment_date_time
            .unwrap_or_else(|| Some(Utc::now())),
        student_number: upsert.student_number,
        course_code: upsert.course_code,
        state: upsert.state,
    }
}

/// A course-unit attainment, the default, carries no assessment item or realisation.
fn attainment_from(upsert: AttainmentUpsert) -> MockAttainment {
    let attainment_type = upsert
        .attainment_type
        .unwrap_or_else(|| super::wire::COURSE_UNIT_ATTAINMENT.to_string());
    let is_assessment_item = attainment_type == super::wire::ASSESSMENT_ITEM_ATTAINMENT;
    MockAttainment {
        id: upsert.id.unwrap_or_else(|| {
            ids::pushed_attainment_id(
                &upsert.student_number,
                &upsert.course_code,
                &upsert.grade_id,
            )
        }),
        state: upsert.state.unwrap_or(AttainmentState::Attained),
        person_id: upsert
            .person_id
            .unwrap_or_else(|| ids::person_id(&upsert.student_number)),
        course_unit_id: ids::course_unit_id(&upsert.course_code),
        assessment_item_id: is_assessment_item
            .then(|| ids::assessment_item_id(&upsert.course_code, upsert.kind)),
        course_unit_realisation_id: is_assessment_item
            .then(|| ids::realisation_id(&upsert.course_code, upsert.kind)),
        attainment_type,
        registration_date: upsert.registration_date.unwrap_or(upsert.attainment_date),
        passed: Some(upsert.passed.unwrap_or(true)),
        credits: upsert.credits,
        attainment_date: upsert.attainment_date,
        grade_scale_id: upsert.grade_scale_id,
        grade_id: upsert.grade_id,
        student_number: upsert.student_number,
        course_code: upsert.course_code,
        from_submission: None,
    }
}

fn localized(text: &str) -> LocalizedName {
    LocalizedName {
        fi: text.to_string(),
        sv: text.to_string(),
        en: text.to_string(),
    }
}

pub async fn health(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let db_generation = default_world::db_generation_marker(&pool).await;
    let generation = match store.live_generation().await {
        Ok(generation) => generation,
        Err(error) => return token.authorized_ok(internal_error(&error)),
    };
    let body = match &generation {
        Some(generation) => {
            let (counts, preamble) = match (
                store.counts(generation).await,
                store.preamble(generation).await,
            ) {
                (Ok(counts), Ok(preamble)) => (counts, preamble),
                (Err(error), _) | (_, Err(error)) => {
                    return token.authorized_ok(internal_error(&error));
                }
            };
            json!({
                "enabled": true,
                "generation": generation,
                "dbGeneration": db_generation,
                "worldDbGeneration": preamble.db_generation,
                "generationMatches": preamble.db_generation.is_some()
                    && preamble.db_generation == db_generation,
                "counts": counts,
                "defaults": preamble.defaults,
            })
        }
        // Never installs one: a health check that built a world could not report an empty one.
        None => json!({
            "enabled": true,
            "generation": serde_json::Value::Null,
            "dbGeneration": db_generation,
            "worldDbGeneration": serde_json::Value::Null,
            "generationMatches": false,
            "counts": serde_json::Value::Null,
            "defaults": serde_json::Value::Null,
        }),
    };
    token.authorized_ok(HttpResponse::Ok().json(body))
}

pub async fn world(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let Some(generation) = (match store.live_generation().await {
        Ok(generation) => generation,
        Err(error) => return token.authorized_ok(internal_error(&error)),
    }) else {
        return token.authorized_ok(HttpResponse::Ok().json(json!({ "generation": null })));
    };
    match dump(&store, &generation).await {
        Ok(body) => token.authorized_ok(HttpResponse::Ok().json(body)),
        Err(error) => token.authorized_ok(internal_error(&error)),
    }
}

async fn dump(store: &MockSuotarStore, generation: &str) -> anyhow::Result<serde_json::Value> {
    let preamble = store.preamble(generation).await?;
    let counts = store.counts(generation).await?;
    Ok(json!({
        "generation": generation,
        "defaults": preamble.defaults,
        "persons": store.all_json::<MockPerson>(generation, EntityHash::Persons).await?,
        "courseUnits": store.all_json::<MockCourseUnit>(generation, EntityHash::CourseUnits).await?,
        "enrolments": store.all_json::<MockEnrolment>(generation, EntityHash::Enrolments).await?,
        "attainments": store.all_json::<MockAttainment>(generation, EntityHash::Attainments).await?,
        "submissions": store.all_json::<MockSubmission>(generation, EntityHash::Submissions).await?,
        "sisuViolations": store.all_json::<Vec<String>>(generation, EntityHash::SisuViolations).await?,
        "faults": store.faults(generation).await?,
        "calls": store.recent_calls(generation, WORLD_DUMP_CALL_LIMIT).await?,
        "callLogLen": counts.call_log_len,
    }))
}

pub async fn command(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let parsed: MockSuotarCommand = match serde_json::from_slice(&body) {
        Ok(parsed) => parsed,
        Err(error) => {
            return token.authorized_ok(HttpResponse::BadRequest().json(CommandResult::Error {
                command: None,
                code: "unknownCommand".to_string(),
                message: error.to_string(),
            }));
        }
    };
    let result = execute(&store, &pool, parsed).await;
    token.authorized_ok(match &result {
        CommandResult::Ok { .. } => HttpResponse::Ok().json(&result),
        CommandResult::NotImplemented { .. } => HttpResponse::NotImplemented().json(&result),
        CommandResult::Error { code, .. } if code == "internalError" => {
            HttpResponse::InternalServerError().json(&result)
        }
        CommandResult::Error { .. } => HttpResponse::BadRequest().json(&result),
    })
}

fn internal_error(error: &anyhow::Error) -> HttpResponse {
    error!("mock Suotar control failure: {error:?}");
    HttpResponse::InternalServerError().json(CommandResult::Error {
        command: None,
        code: "internalError".to_string(),
        message: error.to_string(),
    })
}

/// Nothing here is exported to utoipa or `bindings.ts`; no mock's DTOs are.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/command", web::post().to(command))
        .route("/health", web::get().to(health))
        .route("/world", web::get().to(world));
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Nothing generates the Playwright client from the Rust side, so a rename is only caught here.
    #[test]
    fn the_shapes_the_typescript_client_sends_deserialize() {
        let armed: MockSuotarCommand = serde_json::from_value(json!({
            "command": "armFault",
            "id": "outage-503",
            "when": [
                { "endpoint": "import_attainments" },
                { "stage": "requestGate" },
                { "owner": { "user": "someone@example.com", "course": "crs-401" } }
            ],
            "then": { "kind": "requestLevel", "status": 503, "code": "serviceTemporarilyUnavailable" },
            "lifetime": { "matchingCalls": 1 }
        }))
        .expect("armFault");
        assert_eq!(armed.name(), "armFault");

        let pushed: MockSuotarCommand = serde_json::from_value(json!({
            "command": "pushWorld",
            "persons": [{
                "studentNumber": "900000101",
                "firstNames": "Zzyzx",
                "lastName": "Happypath",
                "primaryEmail": "zzyzx.happypath@helsinki.example.com",
                "behaviour": { "studyRightUnresolvable": true }
            }],
            "courseUnits": [{
                "courseCode": "CRS-101",
                "credits": { "min": 5, "max": 5 },
                "gradeScaleId": "sis-hyl-hyv",
                "suotarCourse": { "name": "CRS-101" },
                "realisations": [{
                    "kind": "openUniversity",
                    "activityPeriod": { "startDate": "2026-01-01", "endDate": "2026-12-31" }
                }]
            }],
            "enrolments": [{
                "studentNumber": "900000101",
                "courseCode": "CRS-101",
                "state": "ENROLLED",
                "studyRightId": null
            }]
        }))
        .expect("pushWorld");
        assert_eq!(pushed.name(), "pushWorld");

        let reset: MockSuotarCommand = serde_json::from_value(json!({
            "command": "reset",
            "scope": { "persons": { "studentNumbers": ["900000101"] } }
        }))
        .expect("reset persons");
        assert_eq!(reset.name(), "reset");

        let world: MockSuotarCommand =
            serde_json::from_value(json!({ "command": "reset", "scope": "world" }))
                .expect("reset world");
        assert_eq!(world.name(), "reset");
    }
}
