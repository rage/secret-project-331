//! The control command RPC and the three inspection GETs.
//!
//! `execute` is a plain async function so the seed can drive the same surface from Rust.

use std::collections::BTreeMap;

use chrono::NaiveDate;
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use serde_json::json;
use sqlx::PgPool;

use crate::prelude::*;

use super::default_world;
use super::faults::{
    Fault, FaultMatch, ItemAddress, OwnerRef, Predicate, ResolvedOwner, Stage, matches_item,
    matches_request, resolvable_keys, validate,
};
use super::ids;
use super::scenarios;
use super::store::{EntityHash, MockSuotarStore, OwnerKeys, World};
use super::world::{
    AttainmentState, CourseBehaviour, CreditRange, DatePeriod, DuplicateDetection, EnrolmentState,
    GradeScale, LocalizedName, MockAttainment, MockCourseUnit, MockEnrolment, MockPerson,
    MockProductAccessToken, MockRealisation, MockSubmission, PersonBehaviour, ProductDocumentState,
    ProductTokenState, RealisationKind, RecordedCall, Ripeness, SubmissionLifecycle, WorldDefaults,
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
    UpsertCourseUnits {
        course_units: Vec<CourseUnitUpsert>,
    },
    UpsertEnrolments {
        enrolments: Vec<EnrolmentUpsert>,
    },
    UpsertAttainments {
        attainments: Vec<AttainmentUpsert>,
    },
    UpsertProductAccessTokens {
        tokens: Vec<ProductAccessTokenUpsert>,
    },
    DeletePersons {
        student_numbers: Vec<String>,
    },
    AllocatePerson(AllocatePerson),
    GenerateRoster {
        course_code: String,
        realisation_id: String,
        count: u32,
        #[serde(default)]
        student_number_prefix: Option<String>,
    },
    SetPersonBehaviour {
        student_number: String,
        patch: PersonBehaviourPatch,
    },
    SetCourseBehaviour {
        course_code: String,
        patch: CourseBehaviourPatch,
    },
    TransitionSubmission {
        submitted_attainment_id: String,
        to: SubmissionTarget,
    },
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
    ExplainFault {
        fault: super::faults::FaultSpec,
        against: Option<HypotheticalRequest>,
    },
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
    pub product_tokens: Vec<ProductAccessTokenUpsert>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonUpsert {
    pub student_number: String,
    pub person_id: Option<String>,
    pub first_names: String,
    pub last_name: String,
    pub primary_email: String,
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
    pub activity_period: DatePeriod,
    pub grade_scale_id: String,
    pub credits: CreditRange,
    /// Never derived: null means no acceptor, which is how `acceptorNotFound` is reached from data
    /// alone.
    pub acceptor_person_id: Option<String>,
    pub open_university_product_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseUnitUpsert {
    pub course_code: String,
    pub course_unit_id: Option<String>,
    pub name: Option<LocalizedName>,
    #[serde(default)]
    pub realisations: Vec<RealisationUpsert>,
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
    pub study_right_id: Option<String>,
    pub study_right_validity_period: DatePeriod,
    pub enrolment_date_time: Option<DateTime<Utc>>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAccessTokenUpsert {
    pub open_university_product_id: String,
    pub id: Option<String>,
    pub access_token: Option<String>,
    pub state: Option<ProductTokenState>,
    pub document_state: Option<ProductDocumentState>,
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
    pub ripeness: Option<Ripeness>,
    pub duplicate_detection: Option<DuplicateDetection>,
    pub primary_email: Option<String>,
    pub secondary_email: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseBehaviourPatch {
    pub import_allowed: Option<bool>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SubmissionTarget {
    Registered,
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
    pub ripeness: Option<Ripeness>,
    pub duplicate_detection: Option<DuplicateDetection>,
    pub grade_scales: Option<Vec<GradeScale>>,
    pub call_log_capacity: Option<usize>,
    pub include_non_enrolled_in_result: Option<bool>,
    pub realisation_id_required: Option<bool>,
    pub static_grade_error_code: Option<String>,
    /// The one target field that may itself be `None`, so an absent key and an explicit `null` are
    /// otherwise indistinguishable.
    #[serde(default)]
    pub clear_static_grade_error_code: bool,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallFilter {
    pub endpoint: Option<SuotarEndpoint>,
    pub student_number: Option<String>,
    pub course_code: Option<String>,
    pub request_item_id: Option<String>,
    pub fault_id: Option<String>,
    pub correlation_id: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HypotheticalRequest {
    pub endpoint: SuotarEndpoint,
    #[serde(default)]
    pub items: Vec<HypotheticalItem>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HypotheticalItem {
    pub request_item_id: String,
    pub student_number: Option<String>,
    pub course_code: Option<String>,
    pub submitted_attainment_id: Option<String>,
    pub product_id: Option<String>,
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
            Self::UpsertProductAccessTokens { .. } => "upsertProductAccessTokens",
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
            Self::ExplainFault { .. } => "explainFault",
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
            "productTokens": world.product_tokens.len(),
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
        MockSuotarCommand::UpsertProductAccessTokens { tokens } => {
            upsert_command(
                store,
                &generation,
                EntityHash::ProductTokens,
                "productIds",
                tokens,
                product_token_from,
                |token| token.open_university_product_id.clone(),
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
            if let Some(ripeness) = patch.ripeness {
                person.behaviour.ripeness = Some(ripeness);
            }
            if let Some(detection) = patch.duplicate_detection {
                person.behaviour.duplicate_detection = Some(detection);
            }
            if let Some(email) = patch.primary_email {
                person.primary_email = email;
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
            if let Some(allowed) = patch.import_allowed {
                unit.behaviour.import_allowed = allowed;
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
        MockSuotarCommand::ExplainFault { fault, against } => {
            explain_fault(store, &generation, fault, against).await
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
    let person = MockPerson {
        person_id: ids::person_id(&student_number),
        first_names: args.first_names.unwrap_or_else(|| "Zzyzx".to_string()),
        last_name: args.last_name.unwrap_or_else(|| "Allocated".to_string()),
        primary_email: args
            .primary_email
            .unwrap_or_else(|| format!("zzyzx.allocated.{student_number}@helsinki.example")),
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
    // A spec index owns only a hundred numbers, so a large roster has to come from the allocator
    // range.
    let prefix = student_number_prefix.unwrap_or("99");
    let now = Utc::now();
    let validity = DatePeriod {
        start_date: (now - chrono::Duration::days(365)).date_naive(),
        end_date: (now + chrono::Duration::days(365)).date_naive(),
    };

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
                course_code: course_code.to_string(),
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

async fn transition(
    store: &MockSuotarStore,
    generation: &str,
    ids: &[String],
    to: SubmissionTarget,
) -> Outcome {
    let now = Utc::now();
    let mut touched = Vec::new();
    let mut updated: BTreeMap<String, MockSubmission> = BTreeMap::new();
    let mut new_attainments: BTreeMap<String, MockAttainment> = BTreeMap::new();
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
        match to {
            SubmissionTarget::Registered => {
                let attainment_id = ids::final_attainment_id(id);
                let attainment = MockAttainment::from_submission(
                    &submission,
                    &attainment_id,
                    AttainmentState::Attained,
                    &defaults,
                    now,
                );
                new_attainments.insert(attainment_id.clone(), attainment);
                submission.lifecycle = SubmissionLifecycle::Registered {
                    attainment_id,
                    registered_at: now,
                };
            }
            SubmissionTarget::Misregistered => {
                let attainment_id = ids::final_attainment_id(id);
                let attainment = MockAttainment::from_submission(
                    &submission,
                    &attainment_id,
                    AttainmentState::Misregistered,
                    &defaults,
                    now,
                );
                new_attainments.insert(attainment_id.clone(), attainment);
                submission.lifecycle = SubmissionLifecycle::Misregistered {
                    attainment_id,
                    misregistered_at: now,
                };
            }
            SubmissionTarget::NotRegistered => {
                submission.lifecycle = SubmissionLifecycle::Pending {
                    ripeness: Ripeness::Manual,
                };
            }
            SubmissionTarget::TimedOutButLanded => {
                submission.lifecycle = SubmissionLifecycle::TimedOutButLanded {
                    ripeness: Ripeness::Manual,
                };
            }
            SubmissionTarget::TimedOutNothingLanded => {
                submission.lifecycle = SubmissionLifecycle::TimedOutNothingLanded;
            }
        }
        touched.push(id.clone());
        updated.insert(id.clone(), submission);
    }

    store
        .upsert_json(generation, EntityHash::Submissions, &updated)
        .await?;
    store
        .upsert_json(generation, EntityHash::Attainments, &new_attainments)
        .await?;
    store.reindex(generation).await?;
    Ok(json!({
        "submittedAttainmentIds": touched,
        "attainmentIds": new_attainments.keys().collect::<Vec<_>>(),
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
) -> Result<(Fault, (SuotarEndpoint, Stage)), CommandError> {
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

async fn explain_fault(
    store: &MockSuotarStore,
    generation: &str,
    spec: super::faults::FaultSpec,
    against: Option<HypotheticalRequest>,
) -> Outcome {
    let (fault, (endpoint, stage)) = build_fault(store, generation, spec).await?;
    let mut explanation = json!({
        "valid": true,
        "endpoint": endpoint,
        "stage": stage,
        "parallelSafe": fault.parallel_safe,
        "owner": fault.owner,
        "resolvableKeys": resolvable_keys(endpoint),
        "requestShaped": fault.then.is_request_shaped(),
    });
    if let Some(request) = against {
        let items: Vec<ItemAddress> = request
            .items
            .iter()
            .map(|item| ItemAddress {
                request_item_id: item.request_item_id.clone(),
                student_number: item.student_number.clone(),
                course_code: item.course_code.clone(),
                product_id: item.product_id.clone(),
                submitted_attainment_id: item.submitted_attainment_id.clone(),
            })
            .collect();
        let mut per_stage = serde_json::Map::new();
        for candidate in Stage::ALL {
            let outcome = if fault.then.is_request_shaped() {
                matches_request(&fault, request.endpoint, candidate, &items)
            } else {
                items
                    .iter()
                    .map(|item| matches_item(&fault, request.endpoint, candidate, item))
                    .find(FaultMatch::fires)
                    .unwrap_or(FaultMatch::Missed("no item matched"))
            };
            per_stage.insert(
                candidate.as_str().to_string(),
                match outcome {
                    FaultMatch::Fires => json!({ "fires": true }),
                    FaultMatch::Missed(predicate) => {
                        json!({ "fires": false, "failedPredicate": predicate })
                    }
                },
            );
        }
        if let Some(object) = explanation.as_object_mut() {
            object.insert("against".to_string(), serde_json::Value::Object(per_stage));
        }
    }
    Ok(explanation)
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
            resolved.product_ids = keys.product_ids;
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
        .filter(|call| {
            filter.student_number.as_ref().is_none_or(|value| {
                call.items
                    .iter()
                    .any(|item| item.student_number.as_ref() == Some(value))
            })
        })
        .filter(|call| {
            filter.course_code.as_ref().is_none_or(|value| {
                call.items
                    .iter()
                    .any(|item| item.course_code.as_ref() == Some(value))
            })
        })
        .filter(|call| {
            filter
                .request_item_id
                .as_ref()
                .is_none_or(|value| call.items.iter().any(|item| &item.request_item_id == value))
        })
        .collect();
    Ok(json!({ "calls": matching, "scanned": calls.len() }))
}

fn apply_defaults_patch(defaults: &mut WorldDefaults, patch: DefaultsPatch) {
    if let Some(value) = patch.accepted_token {
        defaults.accepted_token = value;
    }
    if let Some(value) = patch.ripeness {
        defaults.ripeness = value;
    }
    if let Some(value) = patch.duplicate_detection {
        defaults.duplicate_detection = value;
    }
    if let Some(value) = patch.grade_scales {
        defaults.grade_scales = value;
    }
    if let Some(value) = patch.call_log_capacity {
        defaults.call_log_capacity = value;
    }
    if let Some(value) = patch.include_non_enrolled_in_result {
        defaults.include_non_enrolled_in_result = value;
    }
    if let Some(value) = patch.realisation_id_required {
        defaults.realisation_id_required = value;
    }
    if let Some(value) = patch.static_grade_error_code {
        defaults.static_grade_error_code = Some(value);
    } else if patch.clear_static_grade_error_code {
        defaults.static_grade_error_code = None;
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
        product_tokens: push
            .product_tokens
            .into_iter()
            .map(|token| {
                let token = product_token_from(token);
                (token.open_university_product_id.clone(), token)
            })
            .collect(),
    }
}

fn degree() -> RealisationKind {
    RealisationKind::Degree
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
                name: realisation.name.unwrap_or_else(|| name.clone()),
                assessment_item_id: realisation
                    .assessment_item_id
                    .unwrap_or_else(|| ids::assessment_item_id(&course_code, realisation.kind)),
                kind: realisation.kind,
                activity_period: realisation.activity_period,
                grade_scale_id: realisation.grade_scale_id,
                credits: realisation.credits,
                acceptor_person_id: realisation.acceptor_person_id,
                open_university_product_id: realisation.open_university_product_id,
            })
            .collect(),
        behaviour: upsert.behaviour,
        owner_course_slug: upsert.owner_course_slug,
        name,
        course_code,
    }
}

fn enrolment_from(upsert: EnrolmentUpsert) -> MockEnrolment {
    MockEnrolment {
        id: upsert
            .id
            .unwrap_or_else(|| ids::enrolment_id(&upsert.student_number, upsert.kind)),
        realisation_id: upsert
            .realisation_id
            .unwrap_or_else(|| ids::realisation_id(&upsert.course_code, upsert.kind)),
        study_right_id: upsert
            .study_right_id
            .unwrap_or_else(|| ids::study_right_id(&upsert.student_number, upsert.kind)),
        enrolment_date_time: upsert.enrolment_date_time.unwrap_or_else(Utc::now),
        student_number: upsert.student_number,
        course_code: upsert.course_code,
        state: upsert.state,
        study_right_validity_period: upsert.study_right_validity_period,
    }
}

fn attainment_from(upsert: AttainmentUpsert) -> MockAttainment {
    MockAttainment {
        id: upsert.id.unwrap_or_else(|| {
            ids::pushed_attainment_id(
                &upsert.student_number,
                &upsert.course_code,
                &upsert.grade_id,
            )
        }),
        attainment_type: upsert
            .attainment_type
            .unwrap_or_else(|| "CourseUnitAttainment".to_string()),
        state: upsert.state.unwrap_or(AttainmentState::Attained),
        person_id: upsert
            .person_id
            .unwrap_or_else(|| ids::person_id(&upsert.student_number)),
        course_unit_id: ids::course_unit_id(&upsert.course_code),
        assessment_item_id: ids::assessment_item_id(&upsert.course_code, upsert.kind),
        course_unit_realisation_id: ids::realisation_id(&upsert.course_code, upsert.kind),
        registration_date: upsert.registration_date.unwrap_or(upsert.attainment_date),
        passed: upsert.passed.unwrap_or(true),
        attainment_date: upsert.attainment_date,
        grade_scale_id: upsert.grade_scale_id,
        grade_id: upsert.grade_id,
        student_number: upsert.student_number,
        course_code: upsert.course_code,
        from_submission: None,
    }
}

fn product_token_from(upsert: ProductAccessTokenUpsert) -> MockProductAccessToken {
    MockProductAccessToken {
        id: upsert
            .id
            .unwrap_or_else(|| format!("{}-token", upsert.open_university_product_id)),
        access_token: upsert
            .access_token
            .unwrap_or_else(|| ids::product_access_token(&upsert.open_university_product_id)),
        state: upsert.state.unwrap_or(ProductTokenState::Enabled),
        document_state: upsert
            .document_state
            .unwrap_or(ProductDocumentState::Active),
        open_university_product_id: upsert.open_university_product_id,
    }
}

fn localized(text: &str) -> LocalizedName {
    LocalizedName {
        fi: text.to_string(),
        sv: text.to_string(),
        en: text.to_string(),
    }
}

/// A command's argument shape, its result shape and whether the automated suite may call it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandDoc {
    pub command: &'static str,
    pub arguments: &'static str,
    pub result: &'static str,
    /// False means the command reaches data its caller does not own: dev and manual debugging only.
    pub parallel_safe: bool,
}

/// `SuotarEndpoint` values are snake_case in an otherwise camelCase surface, because the enum's
/// serde spelling is fixed by its database type.
pub const COMMANDS: [CommandDoc; 23] = [
    CommandDoc {
        command: "reset",
        arguments: "{ scope: \"world\" | \"faults\" | \"calls\" | { persons: { studentNumbers?, owner? } } }",
        result: "{ flushed } | { cleared } | { studentNumbers, submissions, attainments, enrolments }",
        parallel_safe: false,
    },
    CommandDoc {
        command: "pushWorld",
        arguments: "{ defaults?, persons[], courseUnits[], enrolments[], attainments[], submissions[], productTokens[] }",
        result: "{ generation, counts }",
        parallel_safe: false,
    },
    CommandDoc {
        command: "upsertPersons",
        arguments: "{ persons: [{ studentNumber, personId?, firstNames, lastName, primaryEmail, secondaryEmail?, behaviour?, ownerUserEmail? }] }",
        result: "{ studentNumbers }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "upsertCourseUnits",
        arguments: "{ courseUnits: [{ courseCode, courseUnitId?, name?, realisations[], behaviour?, ownerCourseSlug? }] }",
        result: "{ courseCodes }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "upsertEnrolments",
        arguments: "{ enrolments: [{ id?, studentNumber, courseCode, realisationId?, kind?, state, studyRightId?, studyRightValidityPeriod, enrolmentDateTime? }] }",
        result: "{ enrolmentIds }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "upsertAttainments",
        arguments: "{ attainments: [{ id?, studentNumber, courseCode, kind?, attainmentDate, gradeScaleId, gradeId, state?, passed? }] }",
        result: "{ attainmentIds }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "upsertProductAccessTokens",
        arguments: "{ tokens: [{ openUniversityProductId, id?, accessToken?, state?, documentState? }] }",
        result: "{ productIds }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "deletePersons",
        arguments: "{ studentNumbers: [] }",
        result: "{ studentNumbers, submissions, attainments, enrolments }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "allocatePerson",
        arguments: "{ firstNames?, lastName?, primaryEmail?, secondaryEmail?, ownerUserEmail? }",
        result: "{ studentNumber, personId }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "generateRoster",
        arguments: "{ courseCode, realisationId, count, studentNumberPrefix? }",
        result: "{ courseCode, realisationId, studentNumbers }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "setPersonBehaviour",
        arguments: "{ studentNumber, patch: { ripeness?, duplicateDetection?, primaryEmail?, secondaryEmail? } }",
        result: "{ studentNumber }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "setCourseBehaviour",
        arguments: "{ courseCode, patch: { importAllowed? } }",
        result: "{ courseCode }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "transitionSubmission",
        arguments: "{ submittedAttainmentId, to }",
        result: "{ submittedAttainmentIds, attainmentIds }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "transitionSubmissionsFor",
        arguments: "{ studentNumber, courseCode?, to }",
        result: "{ submittedAttainmentIds, attainmentIds }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "listSubmissions",
        arguments: "{ studentNumber?, courseCode? }",
        result: "{ submissions }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "armFault",
        arguments: "{ id, when, then, lifetime?, provesDoubleSubmission? }",
        result: "{ id, parallelSafe, owner, seq }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "disarmFault",
        arguments: "{ id }",
        result: "{ disarmed }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "disarmFaults",
        arguments: "{ owner: { user?, course? } }",
        result: "{ disarmed }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "listFaults",
        arguments: "{ id?, owner? }",
        result: "{ faults: [{ fault, remaining, spent }] }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "explainFault",
        arguments: "{ fault, against?: { endpoint, items[] } }",
        result: "{ valid, endpoint, stage, parallelSafe, owner, resolvableKeys, against? }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "setDefaults",
        arguments: "{ patch: { acceptedToken?, ripeness?, duplicateDetection?, gradeScales?, callLogCapacity?, includeNonEnrolledInResult?, realisationIdRequired?, staticGradeErrorCode?, clearStaticGradeErrorCode? } }",
        result: "the whole defaults object",
        parallel_safe: false,
    },
    CommandDoc {
        command: "applyScenario",
        arguments: "{ name, args: { studentNumber?, courseCode, realisationKind?, owner?, primaryEmail?, secondaryEmail?, firstNames?, lastName? } }",
        result: "{ scenario, scope, ...minted identifiers }",
        parallel_safe: true,
    },
    CommandDoc {
        command: "listCalls",
        arguments: "{ endpoint?, studentNumber?, courseCode?, requestItemId?, faultId?, correlationId?, limit? }",
        result: "{ calls, scanned }",
        parallel_safe: true,
    },
];

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
        "productTokens": store.all_json::<MockProductAccessToken>(generation, EntityHash::ProductTokens).await?,
        "faults": store.faults(generation).await?,
        "calls": store.recent_calls(generation, WORLD_DUMP_CALL_LIMIT).await?,
        "callLogLen": counts.call_log_len,
    }))
}

pub async fn commands(
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().json(json!({ "commands": COMMANDS })))
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
        .route("/world", web::get().to(world))
        .route("/commands", web::get().to(commands));
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Serde names every variant it knows in its unknown-variant error, which is where the expected
    /// list comes from.
    fn variants_serde_knows() -> Vec<String> {
        let error = serde_json::from_value::<MockSuotarCommand>(json!({ "command": "\u{1}" }))
            .expect_err("an invented command tag must not deserialize");
        let message = error.to_string();
        message
            .split('`')
            .skip(1)
            .step_by(2)
            .filter(|name| *name != "\u{1}")
            .map(str::to_string)
            .collect()
    }

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
            "then": { "kind": "requestLevel", "status": 503, "code": "sisuTemporarilyUnavailable" },
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
                "primaryEmail": "zzyzx.happypath@helsinki.example",
                "behaviour": { "ripeness": { "autoAfterVerifyCalls": { "calls": 1 } } }
            }],
            "courseUnits": [{
                "courseCode": "CRS-101",
                "realisations": [{
                    "kind": "openUniversity",
                    "activityPeriod": { "startDate": "2026-01-01", "endDate": "2026-12-31" },
                    "gradeScaleId": "sis-hyl-hyv",
                    "credits": { "min": 5, "max": 5 }
                }]
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

    #[test]
    fn the_command_listing_names_every_variant() {
        let listed: Vec<String> = COMMANDS.iter().map(|doc| doc.command.to_string()).collect();
        for name in variants_serde_knows() {
            assert!(
                listed.contains(&name),
                "command `{name}` is missing from the listing"
            );
        }
        assert_eq!(listed.len(), COMMANDS.len());
    }
}
