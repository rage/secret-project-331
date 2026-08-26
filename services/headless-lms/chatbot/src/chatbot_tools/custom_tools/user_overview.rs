use std::str::FromStr;

use chrono::{DateTime, Utc};
use indexmap::IndexMap;
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{
    course_instance_enrollments::get_course_enrollments_info_for_user,
    courses,
    email_deliveries::{EmailSendStatus, get_recent_deliveries_for_user},
    email_templates::EmailTemplateType,
    roles::{UserRole, get_roles},
    suspected_cheaters::{SuspectedCheaterStatus, get_suspected_cheater_info_for_user},
    user_details::{self, EmailVerificationMethod},
    users,
};
use headless_lms_utils::json_schema_types::{
    JSONType, JsonItem, Schema, SchemaPropertyType, string_array_property,
};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, tool_permission::ToolPermission,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
    user_context::ChatbotTurnContext,
};

const EMAIL_DELIVERY_LIMIT: i64 = 20;

pub type UserOverviewTool = ToolProperties<UserOverviewState>;

pub struct UserOverviewState {
    facets: IndexMap<String, UserOverviewFacetValue>,
}

#[derive(serde::Serialize)]
#[serde(untagged)]
enum UserOverviewFacetValue {
    Profile(ProfileFacet),
    Roles(Vec<RoleFacet>),
    Enrollments(Vec<EnrollmentFacet>),
    CheatingFlags(Vec<CheatingFlagFacet>),
    EmailDeliveries(Vec<EmailDeliveryFacet>),
}

#[derive(serde::Serialize)]
struct ProfileFacet {
    user_id: Uuid,
    email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email_communication_consent: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email_verified_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email_verified_method: Option<EmailVerificationMethod>,
    #[serde(skip_serializing_if = "Option::is_none")]
    upstream_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email_domain: Option<String>,
    created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    deleted_at: Option<DateTime<Utc>>,
}

#[derive(serde::Serialize)]
struct RoleFacet {
    role: UserRole,
    is_global: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    organization_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    course_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    course_instance_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exam_id: Option<Uuid>,
}

#[derive(serde::Serialize)]
struct EnrollmentFacet {
    course_id: Uuid,
    course_name: String,
    instance_name: String,
    first_enrolled_at: DateTime<Utc>,
    is_current: bool,
    completed_modules_count: usize,
    completions_needing_review_count: i32,
}

#[derive(serde::Serialize)]
struct CheatingFlagFacet {
    course_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    course_name: Option<String>,
    status: SuspectedCheaterStatus,
    total_points: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_duration_seconds: Option<i32>,
    threshold_seconds: i32,
    created_at: DateTime<Utc>,
}

#[derive(serde::Serialize)]
struct EmailDeliveryFacet {
    email_template_type: EmailTemplateType,
    created_at: DateTime<Utc>,
    status: EmailSendStatus,
    retry_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_attempt_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    failure_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    failure_is_transient: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum UserOverviewFacet {
    Profile,
    Roles,
    Enrollments,
    CheatingFlags,
    EmailDeliveries,
}

impl UserOverviewFacet {
    fn wire_name(self) -> &'static str {
        match self {
            Self::Profile => "profile",
            Self::Roles => "roles",
            Self::Enrollments => "enrollments",
            Self::CheatingFlags => "cheating_flags",
            Self::EmailDeliveries => "email_deliveries",
        }
    }

    fn from_wire_name(s: &str) -> Option<Self> {
        match s {
            "profile" => Some(Self::Profile),
            "roles" => Some(Self::Roles),
            "enrollments" => Some(Self::Enrollments),
            "cheating_flags" => Some(Self::CheatingFlags),
            "email_deliveries" => Some(Self::EmailDeliveries),
            _ => None,
        }
    }
}

pub struct UserOverviewArguments {
    user_id: Uuid,
    facets: Vec<UserOverviewFacet>,
}

impl<'de> serde::Deserialize<'de> for UserOverviewArguments {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(serde::Deserialize)]
        struct Raw {
            user_id: String,
            facets: Vec<String>,
        }
        let raw = Raw::deserialize(deserializer)?;
        let user_id = Uuid::from_str(&raw.user_id).map_err(serde::de::Error::custom)?;

        let mut facets = Vec::new();
        for wire_name in &raw.facets {
            let facet = UserOverviewFacet::from_wire_name(wire_name).ok_or_else(|| {
                serde::de::Error::custom(format!(
                    "Unknown facet '{wire_name}'. Valid facets: profile, roles, enrollments, cheating_flags, email_deliveries."
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

        Ok(UserOverviewArguments { user_id, facets })
    }
}

impl ChatbotToolDeclaration for UserOverviewTool {
    const NAME: &'static str = "user_overview";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportAccounts;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Get an overview of a user's account for support purposes: profile details, roles, course enrollments, cheating flags, and recent email deliveries. Requires global admin.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "user_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The id of the user to look up.".to_string()),
                        }),
                    ),
                    (
                        "facets".to_string(),
                        string_array_property(Some(
                            "Which parts of the user's overview to fetch. Valid values: 'profile', 'roles', 'enrollments', 'cheating_flags', 'email_deliveries'. At least one is required.",
                        )),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ChatbotTool for UserOverviewTool {
    type Arguments = UserOverviewArguments;

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let user_id = arguments.user_id;
        let user_detail = user_details::get_user_details_by_user_id(conn, user_id)
            .await
            .map_err(|e| {
                chatbot_err!(ToolUseError, format!("No user found with id {user_id}."), e)
            })?;

        let mut facets = IndexMap::new();
        for facet in &arguments.facets {
            let value = match facet {
                UserOverviewFacet::Profile => {
                    let user = users::get_by_id(conn, user_id).await?;
                    UserOverviewFacetValue::Profile(ProfileFacet {
                        user_id: user_detail.user_id,
                        email: user_detail.email.clone(),
                        first_name: user_detail.first_name.clone(),
                        last_name: user_detail.last_name.clone(),
                        country: user_detail.country.clone(),
                        email_communication_consent: user_detail.email_communication_consent,
                        email_verified_at: user_detail.email_verified_at,
                        email_verified_method: user_detail.email_verified_method,
                        upstream_id: user.upstream_id,
                        email_domain: user.email_domain,
                        created_at: user.created_at,
                        deleted_at: user.deleted_at,
                    })
                }
                UserOverviewFacet::Roles => {
                    let roles = get_roles(conn, user_id).await?;
                    UserOverviewFacetValue::Roles(
                        roles
                            .into_iter()
                            .map(|role| RoleFacet {
                                role: role.role,
                                is_global: role.is_global,
                                organization_id: role.organization_id,
                                course_id: role.course_id,
                                course_instance_id: role.course_instance_id,
                                exam_id: role.exam_id,
                            })
                            .collect(),
                    )
                }
                UserOverviewFacet::Enrollments => {
                    let enrollments = get_course_enrollments_info_for_user(conn, user_id).await?;
                    UserOverviewFacetValue::Enrollments(
                        enrollments
                            .course_enrollments
                            .into_iter()
                            .map(|enrollment| {
                                let instance_name = enrollment
                                    .course_instances
                                    .iter()
                                    .map(|instance| {
                                        instance
                                            .name
                                            .clone()
                                            .unwrap_or_else(|| "Default".to_string())
                                    })
                                    .collect::<Vec<_>>()
                                    .join(", ");
                                EnrollmentFacet {
                                    course_id: enrollment.course_id,
                                    course_name: enrollment.course.name,
                                    instance_name,
                                    first_enrolled_at: enrollment.first_enrolled_at,
                                    is_current: enrollment.is_current,
                                    completed_modules_count: enrollment
                                        .course_module_completions
                                        .len(),
                                    completions_needing_review_count: enrollment
                                        .course_module_completions_needing_review,
                                }
                            })
                            .collect(),
                    )
                }
                UserOverviewFacet::CheatingFlags => {
                    let flags = get_suspected_cheater_info_for_user(conn, user_id).await?;
                    let course_ids: Vec<Uuid> = flags.iter().map(|f| f.course_id).collect();
                    let course_names: std::collections::HashMap<Uuid, String> =
                        courses::get_by_ids(conn, &course_ids)
                            .await?
                            .into_iter()
                            .map(|c| (c.id, c.name))
                            .collect();
                    let mut rows = Vec::with_capacity(flags.len());
                    for flag in flags {
                        let course_name = course_names.get(&flag.course_id).cloned();
                        rows.push(CheatingFlagFacet {
                            course_id: flag.course_id,
                            course_name,
                            status: flag.status,
                            total_points: flag.total_points,
                            total_duration_seconds: flag.total_duration_seconds,
                            threshold_seconds: flag.threshold_seconds,
                            created_at: flag.first_flagged_at,
                        });
                    }
                    UserOverviewFacetValue::CheatingFlags(rows)
                }
                UserOverviewFacet::EmailDeliveries => {
                    let deliveries =
                        get_recent_deliveries_for_user(conn, user_id, EMAIL_DELIVERY_LIMIT).await?;
                    UserOverviewFacetValue::EmailDeliveries(
                        deliveries
                            .into_iter()
                            .map(|delivery| EmailDeliveryFacet {
                                email_template_type: delivery.email_template_type,
                                created_at: delivery.created_at,
                                status: delivery.status,
                                retry_count: delivery.retry_count,
                                last_attempt_at: delivery.last_attempt_at,
                                failure_code: delivery.failure_code,
                                failure_is_transient: delivery.failure_is_transient,
                            })
                            .collect(),
                    )
                }
            };
            facets.insert(facet.wire_name().to_string(), value);
        }

        Ok(UserOverviewTool {
            state: UserOverviewState { facets },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string_pretty(&self.state.facets)
            .unwrap_or_else(|_| "Failed to serialize user overview.".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some(
            "cheating_flags is strictly internal: never quote, imply, or hint at a cheating \
             suspicion in any text meant for the student. When summarizing email_deliveries, \
             distinguish 'delivery keeps failing' (bounce-like failure_code) from 'sent fine, \
             probably in spam'."
                .to_string(),
        )
    }
}
