//! Client for mooc.fi's organization API, which delegated credit registration reads a student's
//! completions from and reports our registrations to.

use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use headless_lms_base::config::MoocfiDelegationConfiguration;
use reqwest::header::AUTHORIZATION;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use url::Url;
use uuid::Uuid;

use crate::prelude::*;
use crate::secret_string::serialize_exposed;

/// Must stay well under report-back's lease (`external_completions.report_claimed_until`), which
/// has to outlast a lookup and a post.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// Error bodies are kept for operators, but only this much of them.
const MAX_ERROR_BODY_CHARS: usize = 300;

/// One completion as mooc.fi's delegated-completions lookup returns it. mooc.fi applies no
/// eligibility filter there, so ineligible completions come back too.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DelegatedCompletion {
    pub id: Uuid,
    /// The handler course the completion is stored on.
    pub course_id: Uuid,
    /// `None` for some manually added completions; see [`Self::effective_date`].
    pub completion_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
    /// In mooc.fi's form, such as `fi_FI`.
    pub completion_language: Option<String>,
    /// A free string on mooc.fi; parse it with the target's grading before use.
    pub grade: Option<String>,
    pub tier: Option<i32>,
    pub eligible_for_ects: Option<bool>,
    #[serde(default)]
    pub registrations: Vec<DelegatedCompletionRegistration>,
}

impl DelegatedCompletion {
    /// The date both platforms split the completion by at the cutoff.
    pub fn effective_date(&self) -> DateTime<Utc> {
        self.completion_date.unwrap_or(self.created_at)
    }
}

/// A registration of a completion that some mooc.fi organization has reported.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DelegatedCompletionRegistration {
    /// `None` if the reporting organization is gone, which still counts as someone else's.
    pub organization_slug: Option<String>,
    pub registration_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// The body of mooc.fi's `POST /api/register-completions`.
#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterCompletionsRequest {
    pub completions: Vec<CompletionRegistrationReport>,
}

/// Tells mooc.fi that we registered one completion in the study registry.
#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionRegistrationReport {
    /// mooc.fi's completion id.
    pub completion_id: Uuid,
    #[serde(serialize_with = "serialize_exposed")]
    pub student_number: SecretString,
    pub registration_date: DateTime<Utc>,
}

/// Why a mooc.fi call got no usable answer.
#[derive(Debug, thiserror::Error)]
pub enum MoocfiError {
    /// No response at all: connection failure or [`REQUEST_TIMEOUT`].
    #[error("mooc.fi could not be reached: {0}")]
    Unreachable(#[source] reqwest::Error),
    #[error("mooc.fi answered {status}: {body}")]
    Status { status: u16, body: String },
    #[error("mooc.fi's answer did not parse: {0}")]
    InvalidResponse(#[source] reqwest::Error),
    #[error("invalid mooc.fi url: {0}")]
    Url(#[from] url::ParseError),
}

impl From<MoocfiError> for UtilError {
    fn from(error: MoocfiError) -> Self {
        let error_type = match error {
            MoocfiError::Unreachable(_) | MoocfiError::Status { .. } => UtilErrorType::Unavailable,
            MoocfiError::InvalidResponse(_) => UtilErrorType::DeserializationError,
            MoocfiError::Url(_) => UtilErrorType::UrlParse,
        };
        UtilError::new(error_type, error.to_string(), Some(error.into()))
    }
}

/// Calls mooc.fi as our credit-registering organization. Cheap to build; build one per use from
/// the configuration.
#[derive(Clone)]
pub struct MoocfiClient {
    api_base_url: Url,
    authorization: SecretString,
}

impl MoocfiClient {
    /// A client authenticating as our organization.
    pub fn new(config: &MoocfiDelegationConfiguration) -> Self {
        Self {
            api_base_url: config.api_base_url.clone(),
            authorization: SecretString::new(
                format!("Basic {}", config.organization_secret.expose_secret()).into(),
            ),
        }
    }

    /// Every completion, eligible or not, of the TMC user `upstream_id` on the mooc.fi course
    /// `moocfi_course_id`, which must be the handler course. Empty is a valid answer.
    #[instrument(skip(self))]
    pub async fn get_user_completions(
        &self,
        moocfi_course_id: Uuid,
        upstream_id: i32,
    ) -> Result<Vec<DelegatedCompletion>, MoocfiError> {
        let url = self.api_base_url.join(&format!(
            "api/delegated-completions/{moocfi_course_id}/users/{upstream_id}"
        ))?;
        let started = Instant::now();
        let result = self.send(REQWEST_CLIENT.get(url)).await;
        let response = match result {
            Ok(response) => response,
            Err(error) => {
                warn!(elapsed_ms = started.elapsed().as_millis() as u64, %error, "mooc.fi completion lookup failed");
                return Err(error);
            }
        };
        let completions = response
            .json::<Vec<DelegatedCompletion>>()
            .await
            .map_err(MoocfiError::InvalidResponse)?;
        info!(
            elapsed_ms = started.elapsed().as_millis() as u64,
            completions = completions.len(),
            "mooc.fi completion lookup succeeded"
        );
        Ok(completions)
    }

    /// Reports our registrations to mooc.fi. mooc.fi records one registration per completion and
    /// organization, but callers must still post each completion only once.
    #[instrument(skip_all, fields(completions = request.completions.len()))]
    pub async fn register_completions(
        &self,
        request: &RegisterCompletionsRequest,
    ) -> Result<(), MoocfiError> {
        let url = self.api_base_url.join("api/register-completions")?;
        let started = Instant::now();
        let result = self.send(REQWEST_CLIENT.post(url).json(request)).await;
        match &result {
            Ok(_) => info!(
                elapsed_ms = started.elapsed().as_millis() as u64,
                "mooc.fi registration report succeeded"
            ),
            Err(error) => warn!(
                elapsed_ms = started.elapsed().as_millis() as u64,
                %error,
                "mooc.fi registration report failed"
            ),
        }
        result.map(|_| ())
    }

    async fn send(
        &self,
        request: reqwest::RequestBuilder,
    ) -> Result<reqwest::Response, MoocfiError> {
        let response = request
            .header(AUTHORIZATION, self.authorization.expose_secret())
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(MoocfiError::Unreachable)?;
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }
        let body = response
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(MAX_ERROR_BODY_CHARS)
            .collect();
        Err(MoocfiError::Status {
            status: status.as_u16(),
            body,
        })
    }
}
