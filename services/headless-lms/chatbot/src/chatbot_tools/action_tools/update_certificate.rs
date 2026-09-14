use chrono::{NaiveDate, NaiveTime};
use headless_lms_authorization::Action;
use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{
    certificate_configuration_to_requirements, course_modules, generated_certificates,
    generated_certificates::GeneratedCertificate,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{
            ActionAuditFields, ConfirmableActionTool, ExecutedAction, verify_display_field,
        },
        argument_parsing::parse_required_uuid,
        certificate_validation_url,
        tool_authorization::{ToolAuthorization, ToolRequirement},
    },
    prelude::*,
    user_context::ChatbotTurnContext,
};

/// Corrects the name printed on an already-issued certificate, and optionally the date it was
/// issued on, after the admin confirms. The certificate image is rendered from the row on every
/// view, so both corrections take effect on the existing link.
pub struct UpdateCertificateTool;

/// `current_name_on_certificate` is the display/consistency field: re-checked against the row in
/// [UpdateCertificateTool::execute] before anything is changed, so a stale or wrong value refuses
/// rather than mutates.
pub struct UpdateCertificateArguments {
    certificate_id: Uuid,
    course_id: Uuid,
    current_name_on_certificate: String,
    new_name_on_certificate: Option<String>,
    new_date_issued: Option<DateTime<Utc>>,
}

/// What the confirmed call actually changed, which decides what the model is told to explain.
pub struct UpdateCertificateFacts {
    name_changed: bool,
    date_changed: bool,
    verification_id: String,
}

#[derive(Deserialize)]
struct RawArguments {
    certificate_id: String,
    course_id: String,
    current_name_on_certificate: String,
    new_name_on_certificate: String,
    new_date_issued: String,
}

impl ChatbotToolDeclaration for UpdateCertificateTool {
    const NAME: &'static str = "update_certificate";

    fn offer_requirements(user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        vec![ToolRequirement::on_turn(Action::Teach, user_context)]
    }

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportLearningProgress;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Correct the name printed on an issued certificate, and optionally the date it was issued on, after the admin confirms. Use to fix a misspelled or outdated name. Resolve the certificate with certificate_lookup first; this does not issue, revoke or regenerate certificates.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "certificate_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The certificate's id (UUID), as returned by certificate_lookup or user_course_state. Not the verification id.".to_string()),
                        }),
                    ),
                    (
                        "course_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The id of the course the certificate was earned on, as returned alongside the certificate. Checked against the certificate before anything changes.".to_string()),
                        }),
                    ),
                    (
                        "current_name_on_certificate".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The name currently printed on the certificate, exactly as it was returned. Shown to the admin and checked against the certificate before anything changes.".to_string()),
                        }),
                    ),
                    (
                        "new_name_on_certificate".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The corrected name to print, or an empty string to leave the name unchanged.".to_string()),
                        }),
                    ),
                    (
                        "new_date_issued".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The corrected issue date as YYYY-MM-DD (or a full RFC 3339 timestamp), or an empty string to leave the issue date unchanged.".to_string()),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for UpdateCertificateTool {
    type Arguments = UpdateCertificateArguments;
    type Facts = UpdateCertificateFacts;

    fn call_requirements(
        arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        vec![ToolRequirement::on_course(
            Action::Teach,
            arguments.course_id,
        )]
    }

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = serde_json::from_str(arguments).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {arguments}"),
                e
            )
        })?;

        let certificate_id = parse_required_uuid("certificate_id", &raw.certificate_id)?;
        let course_id = parse_required_uuid("course_id", &raw.course_id)?;

        let current_name_on_certificate = raw.current_name_on_certificate.trim().to_string();
        if current_name_on_certificate.is_empty() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "current_name_on_certificate must not be empty.".to_string()
            ));
        }

        let new_name_trimmed = raw.new_name_on_certificate.trim();
        let new_name_on_certificate = (!new_name_trimmed.is_empty())
            .then(|| new_name_trimmed.to_string())
            .filter(|new_name| new_name != &current_name_on_certificate);

        let new_date_issued = parse_date_issued(raw.new_date_issued.trim())?;

        if new_name_on_certificate.is_none() && new_date_issued.is_none() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "Nothing to do: the name is unchanged and new_date_issued is empty.".to_string()
            ));
        }

        Ok(UpdateCertificateArguments {
            certificate_id,
            course_id,
            current_name_on_certificate,
            new_name_on_certificate,
            new_date_issued,
        })
    }

    async fn execute(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: &Self::Arguments,
        _authorization: &ToolAuthorization<Self>,
    ) -> ChatbotResult<(ExecutedAction, Self::Facts)> {
        let certificate = generated_certificates::get_by_id(conn, arguments.certificate_id)
            .await
            .optional()?
            .ok_or_else(|| {
                chatbot_err!(
                    InvalidToolArguments,
                    "The certificate no longer exists. Re-run certificate_lookup.".to_string()
                )
            })?;

        verify_certificate_belongs_to_course(conn, &certificate, arguments.course_id).await?;

        verify_display_field(
            "name on the certificate",
            &certificate.name_on_certificate,
            &arguments.current_name_on_certificate,
            "certificate_lookup",
        )?;

        // parse_arguments can only reject a no-op name, since the current date is not one of the
        // model-supplied display fields; the date it asks for may already be the one on the row.
        let date_issued = arguments.new_date_issued.unwrap_or(certificate.created_at);
        let date_changed = date_issued != certificate.created_at;
        if arguments.new_name_on_certificate.is_none() && !date_changed {
            return Err(chatbot_err!(
                InvalidToolArguments,
                format!(
                    "Nothing to do: the certificate is already dated {} and the name is unchanged.",
                    date_issued.date_naive()
                )
            ));
        }

        let updated = generated_certificates::update_certificate(
            conn,
            arguments.certificate_id,
            date_issued,
            arguments.new_name_on_certificate.clone(),
            Some(certificate.updated_at),
        )
        .await?
        .ok_or_else(|| {
            chatbot_err!(
                ToolUseError,
                "The certificate was changed by someone else while this was waiting for confirmation. Re-run certificate_lookup and ask again.".to_string()
            )
        })?;

        let mut changes = Vec::new();
        if let Some(new_name) = &arguments.new_name_on_certificate {
            changes.push(format!(
                "the name was changed from \"{}\" to \"{new_name}\"",
                arguments.current_name_on_certificate
            ));
        }
        if date_changed {
            changes.push(format!(
                "the issue date was changed to {}",
                date_issued.date_naive()
            ));
        }

        Ok((
            ExecutedAction {
                output: format!(
                    "Certificate {} was updated: {}.",
                    updated.verification_id,
                    changes.join(" and ")
                ),
                client_payload: None,
                audit: ActionAuditFields {
                    target_user_id: Some(certificate.user_id),
                    course_id: Some(arguments.course_id),
                    summary: format!(
                        "Certificate {} updated: {}",
                        updated.verification_id,
                        changes.join(" and ")
                    ),
                },
            },
            UpdateCertificateFacts {
                name_changed: arguments.new_name_on_certificate.is_some(),
                date_changed,
                verification_id: updated.verification_id,
            },
        ))
    }

    fn output_description_instructions(
        arguments: &Self::Arguments,
        facts: Option<&Self::Facts>,
        app_config: &ApplicationConfiguration,
    ) -> Option<String> {
        let base_url = app_config.base_url.trim_end_matches('/');

        let Some(facts) = facts else {
            return Some(format!(
                "Nothing was changed, so the certificate still reads \"{}\". Its page at {}/manage/courses/{}/students/certificates is where the admin can check the current name before asking again.",
                arguments.current_name_on_certificate, base_url, arguments.course_id
            ));
        };

        let validation_url = certificate_validation_url(base_url, &facts.verification_id);
        let mut notes = vec![format!(
            "The certificate image is rendered from the record on every view, so the change is already visible: \
            link the certificate as a markdown link to {validation_url} so the admin can see it. The link itself \
            did not change, and any copy the student saved earlier still shows the old text."
        )];

        if facts.name_changed {
            notes.push(
                "Only the printed name changed. The student's account name is a different field and is untouched, \
                so mention that if the admin expected both to change."
                    .to_string(),
            );
        }

        if facts.date_changed {
            notes.push(format!(
                "The issue date is the certificate's own creation timestamp, so moving it also moves where the \
                certificate sorts in the student's profile and in {base_url}/manage/courses/{}/students/certificates.",
                arguments.course_id
            ));
        }

        Some(notes.join(" "))
    }
}

/// Parses the optional `new_date_issued` argument: a bare `YYYY-MM-DD` is read as midnight UTC,
/// and an empty string means the issue date is left alone.
fn parse_date_issued(raw: &str) -> ChatbotResult<Option<DateTime<Utc>>> {
    if raw.is_empty() {
        return Ok(None);
    }
    if let Ok(date) = NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
        return Ok(Some(date.and_time(NaiveTime::MIN).and_utc()));
    }
    DateTime::parse_from_rfc3339(raw)
        .map(|parsed| Some(parsed.with_timezone(&Utc)))
        .map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!(
                    "'{raw}' is not a date this tool understands. Use YYYY-MM-DD or a full RFC 3339 timestamp."
                ),
                e
            )
        })
}

/// Refuses unless every course the certificate's configuration requires a module from is
/// `course_id`. Authorization is checked against `course_id` alone, so without this a call could
/// pair a certificate with an unrelated course the admin happens to teach.
async fn verify_certificate_belongs_to_course(
    conn: &mut PgConnection,
    certificate: &GeneratedCertificate,
    course_id: Uuid,
) -> ChatbotResult<()> {
    let requirements = certificate_configuration_to_requirements::get_all_requirements_for_certificate_configuration(
        conn,
        certificate.certificate_configuration_id,
    )
    .await?;

    let modules = course_modules::get_by_ids(conn, &requirements.course_module_ids).await?;
    if modules.len() != requirements.course_module_ids.len() {
        return Err(chatbot_err!(
            ToolUseError,
            "The certificate requires a course module that no longer exists, so the course it belongs to cannot be established.".to_string()
        ));
    }

    if modules.is_empty() || modules.iter().any(|module| module.course_id != course_id) {
        return Err(chatbot_err!(
            InvalidToolArguments,
            "This certificate was not earned on that course. Re-run certificate_lookup and use the course_id it returns for this certificate.".to_string()
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The model writes the date as free text, so a plain day is accepted alongside a full
    /// timestamp and anything else has to fail while the LLM can still be told why.
    #[test]
    fn a_plain_day_and_a_full_timestamp_are_both_accepted() {
        assert_eq!(parse_date_issued("").expect("empty is allowed"), None);
        assert_eq!(
            parse_date_issued("2026-02-03")
                .expect("a plain day parses")
                .map(|date| date.to_rfc3339()),
            Some("2026-02-03T00:00:00+00:00".to_string())
        );
        assert_eq!(
            parse_date_issued("2026-02-03T10:00:00Z")
                .expect("an RFC 3339 timestamp parses")
                .map(|date| date.to_rfc3339()),
            Some("2026-02-03T10:00:00+00:00".to_string())
        );
        assert!(parse_date_issued("3rd of February").is_err());
        assert!(parse_date_issued("03/02/2026").is_err());
    }

    fn raw_arguments(new_name: &str, new_date: &str) -> RawArguments {
        RawArguments {
            certificate_id: "00000000-0000-0000-0000-000000000001".to_string(),
            course_id: "00000000-0000-0000-0000-000000000002".to_string(),
            current_name_on_certificate: "Example Learner".to_string(),
            new_name_on_certificate: new_name.to_string(),
            new_date_issued: new_date.to_string(),
        }
    }

    /// A call that would write the values already on the certificate is a wasted confirmation
    /// prompt for the admin, so it is refused where the model can still correct itself.
    #[test]
    fn a_call_that_changes_nothing_is_refused() {
        assert!(build_test_arguments(raw_arguments("", "")).is_err());
        assert!(build_test_arguments(raw_arguments("Example Learner", "")).is_err());
        // A case-only correction is a real change: verify_display_field still matches the row.
        assert!(build_test_arguments(raw_arguments("Example learner ", "")).is_ok());
        assert!(build_test_arguments(raw_arguments("", "2026-02-03")).is_ok());
    }

    fn build_test_arguments(raw: RawArguments) -> ChatbotResult<UpdateCertificateArguments> {
        let json = serde_json::json!({
            "certificate_id": raw.certificate_id,
            "course_id": raw.course_id,
            "current_name_on_certificate": raw.current_name_on_certificate,
            "new_name_on_certificate": raw.new_name_on_certificate,
            "new_date_issued": raw.new_date_issued,
        });
        UpdateCertificateTool::parse_arguments(&json.to_string())
    }
}
