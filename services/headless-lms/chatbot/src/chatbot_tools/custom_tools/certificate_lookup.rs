use headless_lms_authorization::Action;

use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{
    generated_certificates, generated_certificates::UserCertificate, user_details,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, argument_parsing::parse_required_uuid,
        certificate_validation_url, search_url, tool_authorization::ToolRequirement,
    },
    prelude::*,
    user_context::ChatbotTurnContext,
};

/// Resolves issued certificates for support, either from the verification id on a certificate link
/// or from the holder's user_id. Unlike `user_course_state`'s certificates facet this needs no
/// course, and it says nothing about eligibility: it only reports certificates that exist.
pub type CertificateLookupTool = ToolProperties<CertificateLookupState>;

pub struct CertificateLookupState {
    output: CertificateLookupOutput,
    base_url: String,
    lookup: CertificateLookup,
    /// The holder's email, for the admin-page links. Every certificate in one result belongs to
    /// the same user, and it is `None` when the lookup found none or the account has no details.
    holder_email: Option<String>,
}

/// What the call looked the certificates up by, which decides what an empty result means.
enum CertificateLookup {
    VerificationId(String),
    UserId(Uuid),
}

pub struct CertificateLookupArguments {
    lookup: CertificateLookup,
}

#[derive(Deserialize)]
struct RawArguments {
    verification_id: String,
    user_id: String,
}

#[derive(Serialize)]
struct CertificateLookupOutput {
    certificates: Vec<CertificateRow>,
}

#[derive(Serialize)]
struct CertificateRow {
    certificate_id: Uuid,
    user_id: Uuid,
    verification_id: String,
    name_on_certificate: String,
    issued_at: DateTime<Utc>,
    course_id: Uuid,
    course_name: String,
    course_module_name: Option<String>,
    validation_url: String,
}

impl CertificateRow {
    fn from_certificate(certificate: UserCertificate, base_url: &str) -> Self {
        Self {
            certificate_id: certificate.id,
            user_id: certificate.user_id,
            validation_url: certificate_validation_url(base_url, &certificate.verification_id),
            verification_id: certificate.verification_id,
            name_on_certificate: certificate.name_on_certificate,
            issued_at: certificate.created_at,
            course_id: certificate.course_id,
            course_name: certificate.course_name,
            course_module_name: certificate.course_module_name,
        }
    }
}

/// Manual, not derived: exactly one of the two arguments has to be given, which
/// `#[derive(Deserialize)]` can't express, and this is what [ChatbotTool::Arguments]'s
/// `DeserializeOwned` bound is satisfied by (`parse_arguments` below is overridden and never
/// calls it, but the bound still has to hold).
impl<'de> serde::Deserialize<'de> for CertificateLookupArguments {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let raw = RawArguments::deserialize(deserializer)?;
        build_arguments(raw).map_err(serde::de::Error::custom)
    }
}

fn build_arguments(raw: RawArguments) -> ChatbotResult<CertificateLookupArguments> {
    let verification_id = raw.verification_id.trim();
    let user_id = raw.user_id.trim();

    let lookup = match (verification_id.is_empty(), user_id.is_empty()) {
        (true, true) => {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "Give either verification_id or user_id; both are empty.".to_string()
            ));
        }
        (false, false) => {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "Give either verification_id or user_id, not both: they would answer different questions.".to_string()
            ));
        }
        (false, true) => CertificateLookup::VerificationId(verification_id.to_string()),
        (true, false) => CertificateLookup::UserId(parse_required_uuid("user_id", user_id)?),
    };

    Ok(CertificateLookupArguments { lookup })
}

impl ChatbotToolDeclaration for CertificateLookupTool {
    const NAME: &'static str = "certificate_lookup";

    fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        vec![ToolRequirement::global(Action::ViewUserProgressOrDetails)]
    }

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportLearningProgress;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Look up certificates that have been issued, by the verification id from a certificate link or by the holder's user_id. Returns the ids and the validation URL needed to talk about or correct a certificate. Requires global admin.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "verification_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The verification id of a single certificate, as it appears at the end of a /certificates/validate/... link, or an empty string to look up by user_id instead.".to_string()),
                        }),
                    ),
                    (
                        "user_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The holder's user_id, as returned by find_user, to list every certificate they hold across all courses. Empty string when looking up by verification_id.".to_string()),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ChatbotTool for CertificateLookupTool {
    type Arguments = CertificateLookupArguments;

    fn call_requirements(
        _arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        vec![ToolRequirement::global(Action::ViewUserProgressOrDetails)]
    }

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = serde_json::from_str(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
                e
            )
        })?;
        build_arguments(raw)
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let base_url = app_config.base_url.trim_end_matches('/').to_string();

        let certificates = match &arguments.lookup {
            CertificateLookup::VerificationId(verification_id) => {
                generated_certificates::get_by_verification_id(conn, verification_id)
                    .await?
                    .into_iter()
                    .collect()
            }
            CertificateLookup::UserId(user_id) => {
                generated_certificates::get_all_by_user_id(conn, *user_id).await?
            }
        };

        let holder_email = match certificates.first() {
            Some(certificate) => {
                user_details::get_user_details_by_user_id(conn, certificate.user_id)
                    .await
                    .optional()?
                    .map(|detail| detail.email)
            }
            None => None,
        };

        let certificates = certificates
            .into_iter()
            .map(|certificate| CertificateRow::from_certificate(certificate, &base_url))
            .collect();

        Ok(CertificateLookupTool {
            state: CertificateLookupState {
                output: CertificateLookupOutput { certificates },
                base_url,
                lookup: arguments.lookup,
                holder_email,
            },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string_pretty(&self.state.output).unwrap_or_else(|_| "{}".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        let mut notes = vec![
            "Whenever you mention a certificate, link it: render its validation_url as a markdown link on the \
            certificate itself instead of pasting the URL as text. That page both proves the certificate is \
            genuine and shows its image, so the verification id in it grants access to the image - share it only \
            with the certificate's owner or an admin acting for them."
                .to_string(),
            "issued_at is the date printed on the certificate, and certificate_id plus course_id are what \
            update_certificate needs to correct it."
                .to_string(),
        ];

        if self.state.output.certificates.is_empty() {
            notes.push(match &self.state.lookup {
                CertificateLookup::VerificationId(_) => {
                    "No certificate has that verification id. It is a short string that gets copied by hand, so check it \
                    character by character before concluding the certificate was revoked or never existed."
                        .to_string()
                }
                CertificateLookup::UserId(_) => {
                    "This user holds no certificates. That is not a failure: a certificate only exists once the \
                    student clicks generate, so an eligible student who never did has none. Use \
                    user_course_state's certificates facet to see whether they are eligible on a given course."
                        .to_string()
                }
            });
        } else if let Some(email) = &self.state.holder_email {
            let mut course_ids: Vec<Uuid> = self
                .state
                .output
                .certificates
                .iter()
                .map(|certificate| certificate.course_id)
                .collect();
            course_ids.sort_unstable();
            course_ids.dedup();
            let certificates_pages: Vec<String> = course_ids
                .iter()
                .map(|course_id| {
                    search_url(
                        &self.state.base_url,
                        &format!("/manage/courses/{course_id}/students/certificates"),
                        email,
                    )
                })
                .collect();
            notes.push(format!(
                "{} lists the same certificates from the course side (issued date, verification URL, image) for \
                cross-checking.",
                certificates_pages.join(" and ")
            ));
        }

        Some(notes.join(" "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(verification_id: &str, user_id: &str) -> RawArguments {
        RawArguments {
            verification_id: verification_id.to_string(),
            user_id: user_id.to_string(),
        }
    }

    /// The schema forces both properties to be present, so "absent" is an empty string and
    /// exactly one of the two has to carry a value for the call to mean anything.
    #[test]
    fn exactly_one_of_the_two_arguments_is_required() {
        assert!(build_arguments(raw("", "  ")).is_err());
        assert!(build_arguments(raw("abc123", "00000000-0000-0000-0000-000000000001")).is_err());
        assert!(matches!(
            build_arguments(raw(" abc123 ", "")),
            Ok(CertificateLookupArguments {
                lookup: CertificateLookup::VerificationId(verification_id)
            }) if verification_id == "abc123"
        ));
        assert!(matches!(
            build_arguments(raw("", "00000000-0000-0000-0000-000000000001")),
            Ok(CertificateLookupArguments {
                lookup: CertificateLookup::UserId(_)
            })
        ));
    }
}
