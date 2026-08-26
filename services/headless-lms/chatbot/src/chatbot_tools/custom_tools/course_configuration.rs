use std::str::FromStr;
use std::time::Duration;

use chrono::{DateTime, Utc};
use indexmap::IndexMap;
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{
    certificate_configurations, chapters, course_instances,
    course_modules::CompletionPolicy,
    courses::{self, CourseAiPolicy},
    exams, peer_or_self_review_configs,
    peer_or_self_review_configs::PeerReviewProcessingStrategy,
    roles::{Role, UserRole, get_course_related_roles},
    user_details::get_users_details_by_user_id_map,
    users,
};
use headless_lms_utils::{
    json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType, string_array_property},
    services::sisu::{SisuClient, SisuCourseContact},
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
    facets: IndexMap<String, CourseConfigurationFacetValue>,
    base_url: String,
    course_id: Uuid,
}

#[derive(serde::Serialize)]
#[serde(untagged)]
enum CourseConfigurationFacetValue {
    Modules(Vec<ModuleInfo>),
    Certificates(Vec<CertificateConfigurationInfo>),
    Exams(Vec<ExamInfo>),
    Schedule(ScheduleInfo),
    ReviewPolicy(ReviewPolicyInfo),
    Policies(PoliciesInfo),
    Staff(StaffInfo),
}

#[derive(serde::Serialize)]
struct ModuleInfo {
    course_module_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    order_number: i32,
    completion_policy: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    automatic_completion_number_of_points_treshold: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    automatic_completion_requires_exam: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ects_credits: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    uh_course_code: Option<String>,
    certification_enabled: bool,
    enable_registering_completion_to_uh_open_university: bool,
    enable_credit_registration_via_suotar: bool,
}

#[derive(serde::Serialize)]
struct CertificateConfigurationInfo {
    certificate_configuration_id: Uuid,
    is_default_certificate_configuration: bool,
    required_course_module_ids: Vec<Uuid>,
    required_course_module_names: Vec<String>,
}

#[derive(serde::Serialize)]
struct ExamInfo {
    exam_id: Uuid,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    starts_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ends_at: Option<DateTime<Utc>>,
    time_minutes: i32,
    minimum_points_treshold: i32,
    grade_manually: bool,
    modules_that_require_this_exam_for_automatic_completion: Vec<String>,
}

#[derive(serde::Serialize)]
struct ScheduleInfo {
    chapter_locking_enabled: bool,
    chapters: Vec<ChapterScheduleInfo>,
    course_instances: Vec<CourseInstanceScheduleInfo>,
}

#[derive(serde::Serialize)]
struct ChapterScheduleInfo {
    chapter_number: i32,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    opens_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    deadline: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    per_exercise_deadline_overrides: Option<ChapterDeadlineOverrideSummary>,
}

#[derive(serde::Serialize)]
struct ChapterDeadlineOverrideSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    earliest_exercise_deadline_override: Option<DateTime<Utc>>,
    exercise_deadline_override_count: i64,
    exercise_deadline_override_distinct_count: i64,
}

#[derive(serde::Serialize)]
struct CourseInstanceScheduleInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    starts_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ends_at: Option<DateTime<Utc>>,
}

#[derive(serde::Serialize)]
struct ReviewPolicyInfo {
    peer_reviews_to_give: i32,
    peer_reviews_to_receive: i32,
    accepting_threshold: f32,
    processing_strategy: PeerReviewProcessingStrategy,
    manual_review_cutoff_in_days: i32,
    points_are_all_or_nothing: bool,
    reset_answer_if_zero_points_from_review: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    flagged_answers_threshold: Option<i32>,
    flagged_answers_skip_manual_review_and_allow_retry: bool,
    note: &'static str,
}

#[derive(serde::Serialize)]
struct PoliciesInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    closed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    closed_additional_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    closed_course_successor_id: Option<Uuid>,
    cheater_detection_enabled: bool,
    ai_policy: CourseAiPolicy,
    #[serde(skip_serializing_if = "Option::is_none")]
    course_material_ai_instructions: Option<bool>,
    is_draft: bool,
    is_test_mode: bool,
    is_unlisted: bool,
    is_joinable_by_code_only: bool,
    ask_marketing_consent: bool,
}

#[derive(serde::Serialize)]
struct StaffInfo {
    static_instance_contacts: Vec<StaticInstanceContactInfo>,
    role_based_staff: Vec<RoleBasedStaffContactInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sisu_fallback: Option<SisuFallbackResult>,
}

#[derive(serde::Serialize)]
struct StaticInstanceContactInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    instance_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    support_email: Option<String>,
    teacher_in_charge_name: String,
    teacher_in_charge_email: String,
}

#[derive(serde::Serialize)]
struct RoleBasedStaffContactInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
    role: UserRole,
    scope: &'static str,
}

#[derive(serde::Serialize)]
#[serde(untagged)]
enum SisuFallbackResult {
    Contacts {
        course_code: String,
        contacts: Vec<SisuCourseContact>,
    },
    Error {
        error: String,
    },
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
        let base_url = app_config.base_url.trim_end_matches('/').to_string();
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
                    let modules = modules.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected modules to have been prefetched".to_string()
                        )
                    })?;
                    CourseConfigurationFacetValue::Modules(
                        modules.iter().map(module_to_info).collect(),
                    )
                }
                CourseConfigurationFacet::Certificates => {
                    let configurations =
                        certificate_configurations::get_default_certificate_configurations_and_requirements_by_course(
                            conn, course_id,
                        )
                        .await?;
                    let modules = modules.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected modules to have been prefetched".to_string()
                        )
                    })?;
                    let infos = configurations
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
                            CertificateConfigurationInfo {
                                certificate_configuration_id: c.certificate_configuration.id,
                                is_default_certificate_configuration: c
                                    .requirements
                                    .is_default_certificate_configuration(),
                                required_course_module_ids: c
                                    .requirements
                                    .course_module_ids
                                    .clone(),
                                required_course_module_names: module_names,
                            }
                        })
                        .collect::<Vec<_>>();
                    CourseConfigurationFacetValue::Certificates(infos)
                }
                CourseConfigurationFacet::Exams => {
                    let course_exams = exams::get_exams_for_course(conn, course_id).await?;
                    let modules = modules.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected modules to have been prefetched".to_string()
                        )
                    })?;
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
                        rows.push(ExamInfo {
                            exam_id: exam.id,
                            name: exam.name.clone(),
                            starts_at: exam.starts_at,
                            ends_at: exam.ends_at,
                            time_minutes: exam.time_minutes,
                            minimum_points_treshold: exam.minimum_points_treshold,
                            grade_manually: exam.grade_manually,
                            modules_that_require_this_exam_for_automatic_completion:
                                required_by_modules,
                        });
                    }
                    CourseConfigurationFacetValue::Exams(rows)
                }
                CourseConfigurationFacet::Schedule => {
                    let db_chapters = chapters::get_course_chapters(conn, course_id).await?;
                    let instances =
                        course_instances::get_course_instances_for_course(conn, course_id).await?;
                    let overrides = chapters::exercise_deadline_overrides_by_chapter_for_course(
                        conn, course_id,
                    )
                    .await?;

                    let chapters_info = db_chapters
                        .iter()
                        .map(|c| {
                            let override_summary =
                                overrides
                                    .get(&c.id)
                                    .map(|o| ChapterDeadlineOverrideSummary {
                                        earliest_exercise_deadline_override: o
                                            .earliest_exercise_deadline_override,
                                        exercise_deadline_override_count: o
                                            .exercise_deadline_override_count,
                                        exercise_deadline_override_distinct_count: o
                                            .exercise_deadline_override_distinct_count,
                                    });
                            ChapterScheduleInfo {
                                chapter_number: c.chapter_number,
                                name: c.name.clone(),
                                opens_at: c.opens_at,
                                deadline: c.deadline,
                                per_exercise_deadline_overrides: override_summary,
                            }
                        })
                        .collect::<Vec<_>>();

                    let instances_info = instances
                        .iter()
                        .map(|i| CourseInstanceScheduleInfo {
                            name: i.name.clone(),
                            starts_at: i.starts_at,
                            ends_at: i.ends_at,
                        })
                        .collect::<Vec<_>>();

                    CourseConfigurationFacetValue::Schedule(ScheduleInfo {
                        chapter_locking_enabled: course.chapter_locking_enabled,
                        chapters: chapters_info,
                        course_instances: instances_info,
                    })
                }
                CourseConfigurationFacet::ReviewPolicy => {
                    let config = peer_or_self_review_configs::get_default_for_course_by_course_id(
                        conn, course_id,
                    )
                    .await?;
                    CourseConfigurationFacetValue::ReviewPolicy(ReviewPolicyInfo {
                        peer_reviews_to_give: config.peer_reviews_to_give,
                        peer_reviews_to_receive: config.peer_reviews_to_receive,
                        accepting_threshold: config.accepting_threshold,
                        processing_strategy: config.processing_strategy,
                        manual_review_cutoff_in_days: config.manual_review_cutoff_in_days,
                        points_are_all_or_nothing: config.points_are_all_or_nothing,
                        reset_answer_if_zero_points_from_review: config
                            .reset_answer_if_zero_points_from_review,
                        flagged_answers_threshold: course.flagged_answers_threshold,
                        flagged_answers_skip_manual_review_and_allow_retry: course
                            .flagged_answers_skip_manual_review_and_allow_retry,
                        note: "This is the course's default review config. Individual exercises can override it with their own.",
                    })
                }
                CourseConfigurationFacet::Policies => {
                    CourseConfigurationFacetValue::Policies(PoliciesInfo {
                        closed_at: course.closed_at,
                        closed_additional_message: course.closed_additional_message.clone(),
                        closed_course_successor_id: course.closed_course_successor_id,
                        cheater_detection_enabled: course.cheater_detection_enabled,
                        ai_policy: course.ai_policy,
                        course_material_ai_instructions: course.course_material_ai_instructions,
                        is_draft: course.is_draft,
                        is_test_mode: course.is_test_mode,
                        is_unlisted: course.is_unlisted,
                        is_joinable_by_code_only: course.is_joinable_by_code_only,
                        ask_marketing_consent: course.ask_marketing_consent,
                    })
                }
                CourseConfigurationFacet::Staff => {
                    let modules = modules.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected modules to have been prefetched".to_string()
                        )
                    })?;
                    CourseConfigurationFacetValue::Staff(
                        staff_facet(conn, app_config, course_id, modules).await?,
                    )
                }
            };
            facets.insert(facet.wire_name().to_string(), value);
        }

        Ok(CourseConfigurationTool {
            state: CourseConfigurationState {
                facets,
                base_url,
                course_id,
            },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string_pretty(&self.state.facets)
            .unwrap_or_else(|_| "Failed to serialize course configuration.".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        let facets = &self.state.facets;
        let mut notes: Vec<String> = Vec::new();

        if let Some(CourseConfigurationFacetValue::Modules(modules)) = facets.get("modules") {
            if modules.iter().any(|m| m.completion_policy == "manual") {
                notes.push(
                    "A module with completion_policy \"manual\" is completed by staff action, \
                     not automatically; the absent automatic_completion_* fields there mean \
                     \"not applicable\", not \"no threshold configured\"."
                        .to_string(),
                );
            }
            if modules.iter().any(|m| m.completion_policy == "automatic") {
                notes.push(
                    "For \"automatic\" modules, an absent points or exercises-attempted \
                     threshold means that particular requirement isn't imposed (the other one \
                     still gates completion), and switching a module to \"manual\" wipes any \
                     stored thresholds. Meeting the listed thresholds is not sufficient by \
                     itself: an answer sitting in WaitingForManualGrading still blocks \
                     completion, and automatic_completion_requires_exam: true requires a passed \
                     exam (by the exam's minimum_points_treshold), not merely an attempted one. \
                     \"Attempted\" means an exercise's activity_progress is submitted or \
                     completed."
                        .to_string(),
                );
            }
            if modules.iter().any(|m| m.name.is_none()) {
                notes.push(
                    "A module with no name is the course's default/base module; elsewhere in \
                     the platform it is shown under the course's own name (e.g. as \"Default \
                     module\" in the certificates facet)."
                        .to_string(),
                );
            }
            notes.push(
                "enable_registering_completion_to_uh_open_university and \
                 enable_credit_registration_via_suotar are mutually exclusive \
                 credit-registration routes (student-initiated link vs. system push); both \
                 false means the student cannot register credits at all. \
                 certification_enabled alone is not sufficient for a certificate to exist — a \
                 certificate_configuration must also reference the module."
                    .to_string(),
            );
            notes.push(format!(
                "Modules can be reviewed at {base_url}/manage/courses/{course_id}/modules, \
                 though that page renders completion_policy as an automatic-completion checkbox \
                 rather than a named policy and shows no certificate settings.",
                base_url = self.state.base_url,
                course_id = self.state.course_id
            ));
        }

        if let Some(CourseConfigurationFacetValue::Certificates(certs)) = facets.get("certificates")
        {
            if certs.is_empty() {
                notes.push(
                    "This facet only returns certificate configurations that require exactly \
                     one module (\"default\" is inferred from that, not a stored flag); a \
                     genuine certificate spanning multiple modules is invisible here, so an \
                     empty list does not mean the course has no certificate."
                        .to_string(),
                );
            } else {
                notes.push(
                    "is_default_certificate_configuration is always true in this output and \
                     carries no information."
                        .to_string(),
                );
            }
        }

        if let Some(CourseConfigurationFacetValue::Exams(exams)) = facets.get("exams") {
            if !exams.is_empty() {
                notes.push(
                    "time_minutes is the per-student budget counted from that student's own \
                     exam enrollment start, not from starts_at; both it and the exam window \
                     must still be open. minimum_points_treshold is the pass threshold in \
                     points. Exams belong to an organization, so the same exam can be attached \
                     to several courses, and modules_that_require_this_exam_for_automatic_completion \
                     is computed across all of the course's modules and attached to every exam \
                     row — it does not identify which exam a given module actually requires, \
                     and over-reports on a multi-exam course."
                        .to_string(),
                );
                notes.push(format!(
                    "Each exam can be reviewed at {}/manage/exams/<exam_id>; that page does not \
                     show modules_that_require_this_exam_for_automatic_completion.",
                    self.state.base_url
                ));
            }
            if exams.iter().any(|e| e.ends_at.is_none()) {
                notes.push(
                    "An exam with ends_at absent blocks all submissions — it does not mean the \
                     deadline is unset or unlimited."
                        .to_string(),
                );
            }
        }

        if let Some(CourseConfigurationFacetValue::Schedule(schedule)) = facets.get("schedule") {
            notes.push(
                "chapter_locking_enabled is only the course-level switch; per-user chapter \
                 locking (Unlocked / CompletedAndLocked / NotUnlockedYet) is separate and not \
                 shown here, so a \"locked chapter\" complaint can come from either mechanism."
                    .to_string(),
            );
            notes.push(format!(
                "chapter_locking_enabled can be checked in the Edit dialog at \
                 {base_url}/manage/courses/{course_id}/overview; chapter opens_at and deadline \
                 can be checked at {base_url}/manage/courses/{course_id}/pages, inside each \
                 chapter's own edit dialog rather than the chapter list itself.",
                base_url = self.state.base_url,
                course_id = self.state.course_id
            ));
            if schedule.chapters.iter().any(|c| c.opens_at.is_none()) {
                notes.push(
                    "A chapter with opens_at absent is always open, not \"opening date \
                     unknown\"; deadline absent means no deadline."
                        .to_string(),
                );
            }
            if schedule
                .chapters
                .iter()
                .any(|c| c.per_exercise_deadline_overrides.is_some())
            {
                notes.push(
                    "earliest_exercise_deadline_override is the earliest effective exercise \
                     deadline (falling back to the chapter's own), so it is populated even with \
                     zero real overrides; only a non-zero exercise_deadline_override_count means \
                     exercises actually differ from the chapter deadline."
                        .to_string(),
                );
            }
            if schedule
                .course_instances
                .iter()
                .any(|i| i.starts_at.is_none() || i.ends_at.is_none())
            {
                notes.push(
                    "A course instance with starts_at or ends_at absent is open-ended on that \
                     side."
                        .to_string(),
                );
            }
        }

        if let Some(CourseConfigurationFacetValue::ReviewPolicy(review)) =
            facets.get("review_policy")
        {
            notes.push(
                "accepting_threshold is compared against the average of received Likert 1–5 \
                 answers, not points or a percentage. peer_reviews_to_give gates entry to the \
                 review queue at all — a student who never gives reviews is never queued to \
                 receive any, which is the most common cause of \"I never got my peer \
                 reviews\". manual_review_cutoff_in_days is a timeout on the student's own wait, \
                 not a teacher deadline."
                    .to_string(),
            );
            notes.push(match review.processing_strategy {
                PeerReviewProcessingStrategy::AutomaticallyGradeByAverage => {
                    "processing_strategy AutomaticallyGradeByAverage: below \
                     accepting_threshold the answer is rejected, and \
                     reset_answer_if_zero_points_from_review takes effect under this strategy."
                        .to_string()
                }
                PeerReviewProcessingStrategy::AutomaticallyGradeOrManualReviewByAverage => {
                    "processing_strategy AutomaticallyGradeOrManualReviewByAverage: below \
                     accepting_threshold the answer goes to a teacher instead of being \
                     auto-rejected."
                        .to_string()
                }
                PeerReviewProcessingStrategy::ManualReviewEverything => {
                    "processing_strategy ManualReviewEverything: a teacher reviews every \
                     answer, but only once the give-and-receive counts are met."
                        .to_string()
                }
            });
            if review.flagged_answers_threshold.is_none() {
                notes.push(
                    "flagged_answers_threshold absent means peer flagging never \
                     auto-escalates an answer."
                        .to_string(),
                );
            }
            notes.push(format!(
                "Peer-review settings can be checked at \
                 {base_url}/cms/courses/{course_id}/default-peer-review, and \
                 flagged_answers_threshold / flagged_answers_skip_manual_review_and_allow_retry \
                 in the Edit dialog at {base_url}/manage/courses/{course_id}/overview.",
                base_url = self.state.base_url,
                course_id = self.state.course_id
            ));
        }

        if let Some(CourseConfigurationFacetValue::Policies(policies)) = facets.get("policies") {
            notes.push(
                "closed_at is a scheduled closing timestamp: absent means the course is never \
                 scheduled to close, and a future value means it is still open today — compare \
                 it to now rather than treating its presence as \"closed\". \
                 closed_course_successor_id absent means there is no successor course to point \
                 the student at."
                    .to_string(),
            );
            if policies.closed_additional_message.is_some() {
                notes.push(
                    "closed_additional_message is the teacher's own text; quote it rather than \
                     paraphrasing."
                        .to_string(),
                );
            }
            if policies.ai_policy == CourseAiPolicy::NotSet {
                notes.push(
                    "ai_policy: NotSet is meaningfully different from NoAi — it means no policy \
                     was chosen, not that AI is disallowed."
                        .to_string(),
                );
            }
            if policies.course_material_ai_instructions.is_some() {
                notes.push(
                    "course_material_ai_instructions is serialized as a bool even though the \
                     underlying column is text; its presence only tells you instructions exist, \
                     not what they say."
                        .to_string(),
                );
            }
            notes.push(format!(
                "closed_at, closed_additional_message, closed_course_successor_id, is_draft, \
                 is_test_mode, is_unlisted, is_joinable_by_code_only and ai_policy can be \
                 checked in the Edit dialog at {base_url}/manage/courses/{course_id}/overview; \
                 cheater_detection_enabled instead shows up as per-module thresholds at \
                 {base_url}/manage/courses/{course_id}/other/cheaters.",
                base_url = self.state.base_url,
                course_id = self.state.course_id
            ));
        }

        if let Some(CourseConfigurationFacetValue::Staff(staff)) = facets.get("staff") {
            notes.push(
                "When the admin needs a human to contact, prefer role_based_staff over \
                 static_instance_contacts and say which source a contact came from. \
                 role_based_staff.scope (\"course\" / \"course_instance\" / \"organization\") is \
                 the only way to tell someone who teaches this course from someone who just \
                 runs its organization — the role list intentionally includes org-scoped roles."
                    .to_string(),
            );
            if staff.sisu_fallback.is_some() {
                notes.push(
                    "sisu_fallback is present only when both other contact lists are empty; its \
                     Error variant is a note to look the code up by hand, not a failed tool call."
                        .to_string(),
                );
            }
            if staff
                .role_based_staff
                .iter()
                .any(|r| r.scope == "course" || r.scope == "course_instance")
            {
                notes.push(format!(
                    "role_based_staff rows scoped to \"course\" or \"course_instance\" can be \
                     checked at {base_url}/manage/courses/{course_id}/permissions; the \
                     organization-scoped rows here aren't on that page, and this facet carries \
                     no organization id to link to those.",
                    base_url = self.state.base_url,
                    course_id = self.state.course_id
                ));
            }
        }

        if facets.contains_key("modules")
            || facets.contains_key("schedule")
            || facets.contains_key("policies")
        {
            notes.push(
                "Quote deadline and completion-policy values exactly as configured rather than \
                 paraphrasing them."
                    .to_string(),
            );
        }

        (!notes.is_empty()).then(|| notes.join(" "))
    }
}

async fn course_modules_for(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ChatbotResult<Vec<headless_lms_models::course_modules::CourseModule>> {
    Ok(headless_lms_models::course_modules::get_by_course_id(conn, course_id).await?)
}

fn module_to_info(module: &headless_lms_models::course_modules::CourseModule) -> ModuleInfo {
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
    ModuleInfo {
        course_module_id: module.id,
        name: module.name.clone(),
        order_number: module.order_number,
        completion_policy,
        automatic_completion_number_of_exercises_attempted_treshold: exercises_attempted_treshold,
        automatic_completion_number_of_points_treshold: points_treshold,
        automatic_completion_requires_exam: requires_exam,
        ects_credits: module.ects_credits,
        uh_course_code: module.uh_course_code.clone(),
        certification_enabled: module.certification_enabled,
        enable_registering_completion_to_uh_open_university: module
            .enable_registering_completion_to_uh_open_university,
        enable_credit_registration_via_suotar: module.enable_credit_registration_via_suotar,
    }
}

/// Staff contacts in freshness order: static instance fields, then role-based assignments, then
/// (only when both are empty and a Sisu code exists) a best-effort Sisu lookup.
async fn staff_facet(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    modules: &[headless_lms_models::course_modules::CourseModule],
) -> ChatbotResult<StaffInfo> {
    let instances = course_instances::get_course_instances_for_course(conn, course_id).await?;
    let static_instance_contacts = instances
        .iter()
        .map(|i| StaticInstanceContactInfo {
            instance_name: i.name.clone(),
            support_email: i.support_email.clone(),
            teacher_in_charge_name: i.teacher_in_charge_name.clone(),
            teacher_in_charge_email: i.teacher_in_charge_email.clone(),
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
            role_based.push(RoleBasedStaffContactInfo {
                name: detail.and_then(|d| combined_name(d)),
                email: detail.map(|d| d.email.clone()),
                role: role.role,
                scope,
            });
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

    Ok(StaffInfo {
        static_instance_contacts,
        role_based_staff: role_based,
        sisu_fallback,
    })
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
) -> SisuFallbackResult {
    let client = match SisuClient::new(app_config.base_url.clone()) {
        Ok(client) => client,
        Err(e) => {
            return SisuFallbackResult::Error {
                error: format!("Sisu lookup failed, look up code {uh_course_code} manually: {e}"),
            };
        }
    };

    match tokio::time::timeout(
        SISU_LOOKUP_TIMEOUT,
        client.get_course_contacts(uh_course_code),
    )
    .await
    {
        Ok(Ok(contacts)) if !contacts.is_empty() => SisuFallbackResult::Contacts {
            course_code: uh_course_code.to_string(),
            contacts,
        },
        Ok(Ok(_)) => SisuFallbackResult::Error {
            error: format!(
                "Sisu has no responsible-teacher contact for code {uh_course_code}, look it up manually."
            ),
        },
        Ok(Err(e)) => SisuFallbackResult::Error {
            error: format!("Sisu lookup failed, look up code {uh_course_code} manually: {e}"),
        },
        Err(_) => SisuFallbackResult::Error {
            error: format!("Sisu lookup timed out, look up code {uh_course_code} manually."),
        },
    }
}
