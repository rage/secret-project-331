//! Client for the CMS service's block validator, which runs the real Gutenberg registrations.
//!
//! Agent writes fail closed: if the validator is slow or down, the write is rejected with a
//! retryable error and nothing unvalidated is staged.

use std::collections::{BTreeMap, HashSet};
use std::time::Duration;

use async_trait::async_trait;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

use crate::diff::{ChangeKind, Diff};
use crate::engine::{PageDocument, PageType};

pub const VALIDATOR_TIMEOUT: Duration = Duration::from_secs(10);

/// One page's worth of blocks to validate.
#[derive(Debug, Clone, Serialize)]
pub struct ValidationRequest<'a> {
    pub page_type: PageType,
    /// Full top-level trees: nested blocks are checked in their ancestors' context.
    pub blocks: &'a [GutenbergBlock],
    /// Gates `moocfi/lock-chapter`.
    pub chapter_locking_enabled: bool,
    /// Gates `moocfi/chatbot`.
    pub can_add_chatbot: bool,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ValidationOutcome {
    pub valid: bool,
    /// Normalised blocks in request order; only present when `valid`.
    #[serde(default)]
    pub blocks: Vec<GutenbergBlock>,
    #[serde(default)]
    pub errors: Vec<BlockValidationError>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BlockValidationError {
    #[serde(rename = "clientId")]
    pub client_id: Option<Uuid>,
    /// Attribute path inside the block, e.g. `["attributes", "content"]`.
    #[serde(default)]
    pub path: Vec<Value>,
    pub code: String,
    pub message: String,
    #[serde(default)]
    pub fix: String,
}

/// The CMS's export of block registrations, the single source of block schemas.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BlockSchemas {
    pub version: String,
    pub page_types: BTreeMap<String, Vec<String>>,
    /// Block name to the course setting that enables it.
    #[serde(default)]
    pub course_feature_gated_blocks: BTreeMap<String, String>,
    pub rich_text_formats: Vec<RichTextFormat>,
    pub blocks: BTreeMap<String, BlockSchema>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RichTextFormat {
    pub name: String,
    pub tag: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BlockSchema {
    pub title: String,
    #[serde(default)]
    pub description: String,
    /// JSON Schema per attribute; rich text carries `x-rich-text` and `x-rich-text-formats`.
    pub attributes: Map<String, Value>,
    /// `"root"` means the page's top level; None means anywhere the parent allows.
    pub allowed_parents: Option<Vec<String>>,
    /// None means any block the page allows; empty means no inner blocks.
    pub allowed_children: Option<Vec<String>>,
    pub template: Option<Value>,
    pub template_lock: Option<Value>,
    pub example: Value,
}

#[derive(Debug, thiserror::Error)]
pub enum ValidatorError {
    /// Down, slow, warming up or overloaded. The agent can retry the same call.
    #[error("the content validator is unavailable: {reason}")]
    Unavailable {
        reason: String,
        retry_after: Option<Duration>,
    },
    /// The validator refused the request itself (bad secret, malformed request). Not retryable.
    #[error("the content validator rejected the request ({status}): {message}")]
    Rejected { status: u16, message: String },
}

impl ValidatorError {
    pub fn is_retryable(&self) -> bool {
        matches!(self, ValidatorError::Unavailable { .. })
    }
}

#[async_trait]
pub trait BlockValidator: Send + Sync {
    async fn validate_blocks(
        &self,
        request: &ValidationRequest<'_>,
    ) -> Result<ValidationOutcome, ValidatorError>;
    async fn block_schemas(&self) -> Result<BlockSchemas, ValidatorError>;
}

/// HTTP client for the validator routes under `{CMS_INTERNAL_URL}/api/agent/`.
pub struct CmsValidatorClient {
    http: reqwest::Client,
    base_url: String,
    secret: SecretString,
}

impl CmsValidatorClient {
    /// `cms_internal_url` is the CMS base, e.g. `http://cms:3000/cms`.
    pub fn new(cms_internal_url: &str, secret: SecretString) -> Result<Self, ValidatorError> {
        let http = reqwest::Client::builder()
            .timeout(VALIDATOR_TIMEOUT)
            .build()
            .map_err(|e| ValidatorError::Rejected {
                status: 0,
                message: format!("couldn't build the HTTP client: {e}"),
            })?;
        Ok(Self {
            http,
            base_url: format!("{}/api/agent", cms_internal_url.trim_end_matches('/')),
            secret,
        })
    }

    /// Reads `CMS_INTERNAL_URL` and `AGENT_VALIDATOR_SECRET`.
    pub fn from_env() -> Result<Self, ValidatorError> {
        let missing = |name: &str| ValidatorError::Rejected {
            status: 0,
            message: format!("{name} is not set"),
        };
        let url = std::env::var("CMS_INTERNAL_URL").map_err(|_| missing("CMS_INTERNAL_URL"))?;
        let secret = std::env::var("AGENT_VALIDATOR_SECRET")
            .map_err(|_| missing("AGENT_VALIDATOR_SECRET"))?;
        Self::new(&url, SecretString::from(secret))
    }

    async fn send<T: for<'de> Deserialize<'de>>(
        &self,
        request: reqwest::RequestBuilder,
    ) -> Result<T, ValidatorError> {
        let response = request
            .bearer_auth(self.secret.expose_secret())
            .send()
            .await
            .map_err(|e| ValidatorError::Unavailable {
                reason: if e.is_timeout() {
                    "timed out".to_string()
                } else {
                    e.to_string()
                },
                retry_after: None,
            })?;
        let status = response.status();
        if status == reqwest::StatusCode::SERVICE_UNAVAILABLE || status.is_server_error() {
            let retry_after = response
                .headers()
                .get(reqwest::header::RETRY_AFTER)
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .map(Duration::from_secs);
            return Err(ValidatorError::Unavailable {
                reason: format!("status {status}"),
                retry_after,
            });
        }
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(ValidatorError::Rejected {
                status: status.as_u16(),
                message,
            });
        }
        response
            .json::<T>()
            .await
            .map_err(|e| ValidatorError::Unavailable {
                reason: format!("unreadable response: {e}"),
                retry_after: None,
            })
    }
}

#[async_trait]
impl BlockValidator for CmsValidatorClient {
    async fn validate_blocks(
        &self,
        request: &ValidationRequest<'_>,
    ) -> Result<ValidationOutcome, ValidatorError> {
        self.send(
            self.http
                .post(format!("{}/validate-blocks", self.base_url))
                .json(request),
        )
        .await
    }

    async fn block_schemas(&self) -> Result<BlockSchemas, ValidatorError> {
        self.send(self.http.get(format!("{}/block-schemas", self.base_url)))
            .await
    }
}

/// Stands in when the validator isn't configured: every write fails closed with a retryable
/// error, reads keep working.
pub struct UnconfiguredValidator {
    pub reason: String,
}

#[async_trait]
impl BlockValidator for UnconfiguredValidator {
    async fn validate_blocks(
        &self,
        _: &ValidationRequest<'_>,
    ) -> Result<ValidationOutcome, ValidatorError> {
        Err(ValidatorError::Unavailable {
            reason: self.reason.clone(),
            retry_after: None,
        })
    }

    async fn block_schemas(&self) -> Result<BlockSchemas, ValidatorError> {
        Err(ValidatorError::Unavailable {
            reason: self.reason.clone(),
            retry_after: None,
        })
    }
}

/// The top-level trees of `page` that hold a block the diff added, changed or moved there.
pub fn changed_roots(page: &PageDocument, diff: &Diff) -> Vec<GutenbergBlock> {
    let touched: HashSet<Uuid> = diff
        .blocks
        .iter()
        .filter(|b| b.kind != ChangeKind::Removed && b.page_after == Some(page.page_id))
        .map(|b| b.block_id)
        .collect();
    page.blocks
        .iter()
        .filter(|root| {
            crate::engine::blocks::all_ids(std::slice::from_ref(*root))
                .iter()
                .any(|id| touched.contains(id))
        })
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::*;
    use crate::diff::{Snapshot, diff};
    use crate::test_fixtures::{id, infobox, page, para};

    fn client(server: &mockito::Server) -> CmsValidatorClient {
        CmsValidatorClient::new(&server.url(), SecretString::from("s3cret".to_string())).unwrap()
    }

    #[tokio::test]
    async fn sends_batch_with_bearer_and_parses_outcome() {
        let mut server = mockito::Server::new_async().await;
        let blocks = vec![para("p1", "Hi")];
        let mock = server
            .mock("POST", "/api/agent/validate-blocks")
            .match_header("authorization", "Bearer s3cret")
            .match_body(mockito::Matcher::PartialJson(json!({"page_type": "course-front-page", "chapter_locking_enabled": false})))
            .with_status(200)
            .with_body(json!({"valid": false, "blocks": [], "errors": [{"clientId": null, "path": ["attributes","content"], "code": "disallowed_markup", "message": "m", "fix": "f"}]}).to_string())
            .create_async()
            .await;
        let request = ValidationRequest {
            page_type: PageType::CourseFrontPage,
            blocks: &blocks,
            chapter_locking_enabled: false,
            can_add_chatbot: false,
        };
        let outcome = client(&server).validate_blocks(&request).await.unwrap();
        mock.assert_async().await;
        assert!(!outcome.valid);
        assert_eq!(outcome.errors[0].client_id, None);
        assert_eq!(outcome.errors[0].code, "disallowed_markup");
    }

    #[tokio::test]
    async fn warming_up_is_retryable() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/agent/validate-blocks")
            .with_status(503)
            .with_header("retry-after", "1")
            .with_body(r#"{"retryable":true}"#)
            .create_async()
            .await;
        let blocks = vec![];
        let request = ValidationRequest {
            page_type: PageType::CoursePage,
            blocks: &blocks,
            chapter_locking_enabled: false,
            can_add_chatbot: false,
        };
        let error = client(&server).validate_blocks(&request).await.unwrap_err();
        assert!(error.is_retryable());
        assert!(
            matches!(error, ValidatorError::Unavailable { retry_after: Some(d), .. } if d == Duration::from_secs(1))
        );
    }

    #[tokio::test]
    async fn bad_secret_is_not_retryable_and_down_is() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("GET", "/api/agent/block-schemas")
            .with_status(401)
            .create_async()
            .await;
        assert!(
            !client(&server)
                .block_schemas()
                .await
                .unwrap_err()
                .is_retryable()
        );
        let unreachable =
            CmsValidatorClient::new("http://127.0.0.1:9", SecretString::from("x".to_string()))
                .unwrap();
        assert!(
            unreachable
                .block_schemas()
                .await
                .unwrap_err()
                .is_retryable()
        );
    }

    #[test]
    fn changed_roots_are_top_level_ancestors() {
        let before = page(
            "pg1",
            PageType::CoursePage,
            vec![para("p1", "a"), infobox("box", vec![para("c1", "b")])],
        );
        let mut after = before.clone();
        after.blocks[1].inner_blocks[0]
            .attributes
            .insert("content".into(), json!("B"));
        let changes = diff(
            &Snapshot {
                pages: vec![before],
                ..Default::default()
            },
            &Snapshot {
                pages: vec![after.clone()],
                ..Default::default()
            },
        );
        let roots = changed_roots(&after, &changes);
        assert_eq!(roots.len(), 1);
        assert_eq!(roots[0].client_id, id("box"));
    }
}
