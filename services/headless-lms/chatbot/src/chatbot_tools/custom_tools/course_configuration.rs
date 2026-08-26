use std::str::FromStr;
use std::time::Duration;

use indexmap::IndexMap;
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{
    certificate_configurations, chapters, course_instances,
    course_modules::CompletionPolicy,
    courses, exams, peer_or_self_review_configs,
    roles::{Role, UserRole, get_course_related_roles},
    user_details::get_users_details_by_user_id_map,
    users,
};
use headless_lms_utils::{
    json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType, string_array_property},
    services::sisu::SisuClient,
};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, tool_permission::ToolPermission,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
    user_context::ChatbotTurnContext,
};

/// Long enough for a real Sisu round trip, short enough that a hung upstream cannot stall the
/// whole tool call.
const SISU_LOOKUP_TIMEOUT: Duration = Duration::from_secs(5);

pub type CourseConfigurationTool = ToolProperties<CourseConfigurationState>;

pub struct CourseConfigurationState {
    facets: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum CourseConfigurationFacet {
    Modules,
    Certificates,
    Exams,
    Schedule,
    ReviewPolicy,
    Policies,
    Staff,
}

impl CourseConfigurationFacet {
    fn wire_name(self) -> &'static str {
        match self {
            Self::Modules => "modules",
            Self::Certificates => "certificates",
            Self::Exams => "exams",
            Self::Schedule => "schedule",
            Self::ReviewPolicy => "review_policy",
            Self::Policies => "policies",
            Self::Staff => "staff",
        }
    }

    fn from_wire_name(s: &str) -> Option<Self> {
        match s {
            "modules" => Some(Self::Modules),
            "certificates" => Some(Self::Certificates),
            "exams" => Some(Self::Exams),
            "schedule" => Some(Self::Schedule),
            "review_policy" => Some(Self::ReviewPolicy),
            "policies" => Some(Self::Policies),
            "staff" => Some(Self::Staff),
            _ => None,
        }
    }
}

pub struct CourseConfigurationArguments {
    course_id: Uuid,
    facets: Vec<CourseConfigurationFacet>,
}

impl<'de> serde::Deserialize<'de> for CourseConfigurationArguments {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(serde::Deserialize)]
        struct Raw {
            course_id: String,
            facets: Vec<String>,
        }
        let raw = Raw::deserialize(deserializer)?;
        let course_id = Uuid::from_str(&raw.course_id).map_err(serde::de::Error::custom)?;

        let mut facets = Vec::new();
        for wire_name in &raw.facets {
            let facet = CourseConfigurationFacet::from_wire_name(wire_name).ok_or_else(|| {
                serde::de::Error::custom(format!(
                    "Unknown facet '{wire_name}'. Valid facets: modules, certificates, exams, schedule, review_policy, policies, staff."
                ))
            })?;
            if !facets.contains(&facet) {
                facets.push(facet);
            }
        }
        if facets.is_empty() {
            return Err(serde::de::Error::custom(
                "At least one facet must be requested.",
            ));
        }

        Ok(CourseConfigurationArguments { course_id, facets })
    }
}

impl ChatbotToolDeclaration for CourseConfigurationTool {
    const NAME: &'static str = "course_configuration";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportCourses;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Get how a course is configured for support purposes: modules and their completion policy, certificates, exams, chapter/instance schedule, peer-or-self review policy, course-level policies, and staff contacts. Requires global admin.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "course_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The id of the course to inspect.".to_string()),
                        }),
                    ),
                    (
                        "facets".to_string(),
                        string_array_property(Some(
                            "Which parts of the course configuration to fetch. Valid values: 'modules', 'certificates', 'exams', 'schedule', 'review_policy', 'policies', 'staff'. At least one is required.",
                        )),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ChatbotTool for CourseConfigurationTool {
    type Arguments = CourseConfigurationArguments;

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let course_id = arguments.course_id;
        let course = courses::get_course(conn, course_id).await.map_err(|e| {
            chatbot_err!(
                ToolUseError,
                format!("No course found with id {course_id}."),
                e
            )
        })?;

        // Fetched once and shared across facets instead of once per facet, since a single call
        // commonly requests several facets that would otherwise repeat the same query.
        let modules = if arguments.facets.iter().any(|f| {
            matches!(
                f,
                CourseConfigurationFacet::Modules
                    | CourseConfigurationFacet::Certificates
                    | CourseConfigurationFacet::Exams
                    | CourseConfigurationFacet::Staff
            )
        }) {
            Some(course_modules_for(conn, course_id).await?)
        } else {
            None
        };

        let mut facets = IndexMap::new();
        for facet in &arguments.facets {
            let value = match facet {
                CourseConfigurationFacet::Modules => {
                    let modules = modules.as_ref().expect("prefetched above");
                    json!(modules.iter().map(module_to_json).collect::<Vec<_>>())
                }
                CourseConfigurationFacet::Certificates => {
                    let configurations =
                        certificate_configurations::get_default_certificate_configurations_and_requirements_by_course(
                            conn, course_id,
                        )
                        .await?;
                    let modules = modules.as_ref().expect("prefetched above");
                    json!(
                        configurations
                            .iter()
                            .map(|c| {
                                let module_names = c
                                    .requirements
                                    .course_module_ids
                                    .iter()
                                    .map(|module_id| {
                                        modules
                                            .iter()
                                            .find(|m| &m.id == module_id)
                                            .and_then(|m| m.name.clone())
                                            .unwrap_or_else(|| "Default module".to_string())
                                    })
                                    .collect::<Vec<_>>();
                                json!({
                                    "certificate_configuration_id": c.certificate_configuration.id,
                                    "is_default_certificate_configuration": c.requirements.is_default_certificate_configuration(),
                                    "required_course_module_ids": c.requirements.course_module_ids,
                                    "required_course_module_names": module_names,
                                })
                            })
                            .collect::<Vec<_>>()
                    )
                }
                CourseConfigurationFacet::Exams => {
                    let course_exams = exams::get_exams_for_course(conn, course_id).await?;
                    let modules = modules.as_ref().expect("prefetched above");
                    let exam_ids: Vec<Uuid> = course_exams.iter().map(|e| e.id).collect();
                    let exams_by_id: std::collections::HashMap<Uuid, exams::ExamSummary> =
                        exams::get_summaries_by_ids(conn, &exam_ids)
                            .await?
                            .into_iter()
                            .map(|exam| (exam.id, exam))
                            .collect();
                    let mut rows = Vec::with_capacity(course_exams.len());
                    for course_exam in &course_exams {
                        let Some(exam) = exams_by_id.get(&course_exam.id) else {
                            continue;
                        };
                        let required_by_modules = modules
                            .iter()
                            .filter(|m| {
                                m.completion_policy
                                    .automatic()
                                    .map(|r| r.requires_exam)
                                    .unwrap_or(false)
                            })
                            .map(|m| {
                                m.name
                                    .clone()
                                    .unwrap_or_else(|| "Default module".to_string())
                            })
                            .collect::<Vec<_>>();
                        rows.push(json!({
                            "exam_id": exam.id,
                            "name": exam.name,
                            "starts_at": exam.starts_at,
                            "ends_at": exam.ends_at,
                            "time_minutes": exam.time_minutes,
                            "minimum_points_treshold": exam.minimum_points_treshold,
                            "grade_manually": exam.grade_manually,
                            "modules_that_require_this_exam_for_automatic_completion": required_by_modules,
                        }));
                    }
                    json!(rows)
                }
                CourseConfigurationFacet::Schedule => {
                    let db_chapters = chapters::get_course_chapters(conn, course_id).await?;
                    let instances =
                        course_instances::get_course_instances_for_course(conn, course_id).await?;
                    let overrides = chapters::exercise_deadline_overrides_by_chapter_for_course(
                        conn, course_id,
                    )
                    .await?;

                    let chapters_json = db_chapters
                        .iter()
                        .map(|c| {
                            let override_summary = overrides.get(&c.id).map(|o| {
                                json!({
                                    "earliest_exercise_deadline_override": o.earliest_exercise_deadline_override,
                                    "exercise_deadline_override_count": o.exercise_deadline_override_count,
                                    "exercise_deadline_override_distinct_count": o.exercise_deadline_override_distinct_count,
                                })
                            });
                            json!({
                                "chapter_number": c.chapter_number,
                                "name": c.name,
                                "opens_at": c.opens_at,
                                "deadline": c.deadline,
                                "per_exercise_deadline_overrides": override_summary,
                            })
                        })
                        .collect::<Vec<_>>();

                    let instances_json = instances
                        .iter()
                        .map(|i| {
                            json!({
                                "name": i.name,
                                "starts_at": i.starts_at,
                                "ends_at": i.ends_at,
                            })
                        })
                        .collect::<Vec<_>>();

                    json!({
                        "chapter_locking_enabled": course.chapter_locking_enabled,
                        "chapters": chapters_json,
                        "course_instances": instances_json,
                    })
                }
                CourseConfigurationFacet::ReviewPolicy => {
                    let config = peer_or_self_review_configs::get_default_for_course_by_course_id(
                        conn, course_id,
                    )
                    .await?;
                    json!({
                        "peer_reviews_to_give": config.peer_reviews_to_give,
                        "peer_reviews_to_receive": config.peer_reviews_to_receive,
                        "accepting_threshold": config.accepting_threshold,
                        "processing_strategy": config.processing_strategy,
                        "manual_review_cutoff_in_days": config.manual_review_cutoff_in_days,
                        "points_are_all_or_nothing": config.points_are_all_or_nothing,
                        "reset_answer_if_zero_points_from_review": config.reset_answer_if_zero_points_from_review,
                        "flagged_answers_threshold": course.flagged_answers_threshold,
                        "flagged_answers_skip_manual_review_and_allow_retry": course.flagged_answers_skip_manual_review_and_allow_retry,
                        "note": "This is the course's default review config. Individual exercises can override it with their own.",
                    })
                }
                CourseConfigurationFacet::Policies => {
                    json!({
                        "closed_at": course.closed_at,
                        "closed_additional_message": course.closed_additional_message,
                        "closed_course_successor_id": course.closed_course_successor_id,
                        "cheater_detection_enabled": course.cheater_detection_enabled,
                        "ai_policy": course.ai_policy,
                        "course_material_ai_instructions": course.course_material_ai_instructions,
                        "is_draft": course.is_draft,
                        "is_test_mode": course.is_test_mode,
                        "is_unlisted": course.is_unlisted,
                        "is_joinable_by_code_only": course.is_joinable_by_code_only,
                        "ask_marketing_consent": course.ask_marketing_consent,
                    })
                }
                CourseConfigurationFacet::Staff => {
                    staff_facet(
                        conn,
                        app_config,
                        course_id,
                        modules.as_ref().expect("prefetched above"),
                    )
                    .await?
                }
            };
            facets.insert(facet.wire_name().to_string(), value);
        }

        Ok(CourseConfigurationTool {
            state: CourseConfigurationState { facets },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string_pretty(&self.state.facets)
            .unwrap_or_else(|_| "Failed to serialize course configuration.".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some(
            "When the admin needs a human to contact, prefer the role-based staff list over the \
             static instance fields, and say which source a contact came from. Deadline and \
             completion policy questions should quote the exact configured values."
                .to_string(),
        )
    }
}

async fn course_modules_for(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ChatbotResult<Vec<headless_lms_models::course_modules::CourseModule>> {
    Ok(headless_lms_models::course_modules::get_by_course_id(conn, course_id).await?)
}

fn module_to_json(module: &headless_lms_models::course_modules::CourseModule) -> serde_json::Value {
    let (completion_policy, exercises_attempted_treshold, points_treshold, requires_exam) =
        match &module.completion_policy {
            CompletionPolicy::Automatic(requirements) => (
                "automatic",
                requirements.number_of_exercises_attempted_treshold,
                requirements.number_of_points_treshold,
                Some(requirements.requires_exam),
            ),
            CompletionPolicy::Manual => ("manual", None, None, None),
        };
    json!({
        "course_module_id": module.id,
        "name": module.name,
        "order_number": module.order_number,
        "completion_policy": completion_policy,
        "automatic_completion_number_of_exercises_attempted_treshold": exercises_attempted_treshold,
        "automatic_completion_number_of_points_treshold": points_treshold,
        "automatic_completion_requires_exam": requires_exam,
        "ects_credits": module.ects_credits,
        "uh_course_code": module.uh_course_code,
        "certification_enabled": module.certification_enabled,
        "enable_registering_completion_to_uh_open_university": module.enable_registering_completion_to_uh_open_university,
        "enable_credit_registration_via_suotar": module.enable_credit_registration_via_suotar,
    })
}

/// Staff contacts in freshness order: static instance fields, then role-based assignments, then
/// (only when both are empty and a Sisu code exists) a best-effort Sisu lookup.
async fn staff_facet(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    modules: &[headless_lms_models::course_modules::CourseModule],
) -> ChatbotResult<serde_json::Value> {
    let instances = course_instances::get_course_instances_for_course(conn, course_id).await?;
    let static_instance_contacts = instances
        .iter()
        .map(|i| {
            json!({
                "instance_name": i.name,
                "support_email": i.support_email,
                "teacher_in_charge_name": i.teacher_in_charge_name,
                "teacher_in_charge_email": i.teacher_in_charge_email,
            })
        })
        .collect::<Vec<_>>();

    let related_roles = get_course_related_roles(conn, course_id).await?;
    let role_based_roles: Vec<Role> = related_roles
        .into_iter()
        .filter(|role| {
            !role.is_global
                && matches!(
                    role.role,
                    UserRole::Teacher | UserRole::Assistant | UserRole::CourseOrExamCreator
                )
        })
        .collect();

    let mut role_based = Vec::with_capacity(role_based_roles.len());
    if !role_based_roles.is_empty() {
        let role_user_ids: Vec<Uuid> = role_based_roles.iter().map(|role| role.user_id).collect();
        let role_users = users::get_by_ids(conn, &role_user_ids).await?;
        let details = get_users_details_by_user_id_map(conn, &role_users).await?;
        for role in &role_based_roles {
            let scope = if role.course_instance_id.is_some() {
                "course_instance"
            } else if role.course_id.is_some() {
                "course"
            } else {
                "organization"
            };
            let detail = details.get(&role.user_id);
            role_based.push(json!({
                "name": detail.and_then(|d| combined_name(d)),
                "email": detail.map(|d| d.email.clone()),
                "role": role.role,
                "scope": scope,
            }));
        }
    }

    let sisu_course_code = modules.iter().find_map(|m| m.uh_course_code.clone());

    let sisu_fallback = if static_instance_contacts.is_empty()
        && role_based.is_empty()
        && let Some(code) = sisu_course_code
    {
        Some(sisu_lookup(app_config, &code).await)
    } else {
        None
    };

    Ok(json!({
        "static_instance_contacts": static_instance_contacts,
        "role_based_staff": role_based,
        "sisu_fallback": sisu_fallback,
    }))
}

fn combined_name(detail: &headless_lms_models::user_details::UserDetail) -> Option<String> {
    let name = [detail.first_name.as_deref(), detail.last_name.as_deref()]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(" ");
    (!name.is_empty()).then_some(name)
}

/// Looks the course code up in Sisu, degrading to a note rather than failing the tool call:
/// an external HTTP hiccup must not take down a support answer that has other facets to give.
async fn sisu_lookup(
    app_config: &ApplicationConfiguration,
    uh_course_code: &str,
) -> serde_json::Value {
    let client = match SisuClient::new(app_config.base_url.clone()) {
        Ok(client) => client,
        Err(e) => {
            return json!({
                "error": format!("Sisu lookup failed, look up code {uh_course_code} manually: {e}"),
            });
        }
    };

    match tokio::time::timeout(
        SISU_LOOKUP_TIMEOUT,
        client.get_course_contacts(uh_course_code),
    )
    .await
    {
        Ok(Ok(contacts)) if !contacts.is_empty() => json!({
            "course_code": uh_course_code,
            "contacts": contacts,
        }),
        Ok(Ok(_)) => json!({
            "error": format!("Sisu has no responsible-teacher contact for code {uh_course_code}, look it up manually."),
        }),
        Ok(Err(e)) => json!({
            "error": format!("Sisu lookup failed, look up code {uh_course_code} manually: {e}"),
        }),
        Err(_) => json!({
            "error": format!("Sisu lookup timed out, look up code {uh_course_code} manually."),
        }),
    }
}
