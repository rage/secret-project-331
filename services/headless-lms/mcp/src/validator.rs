//! Client for the CMS service's block validator, which runs the real Gutenberg registrations.
//!
//! Agent writes fail closed: if the validator is slow or down, the write is rejected with a
//! retryable error and nothing unvalidated is staged.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use async_trait::async_trait;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use serde_json::{Map, Value};
use url::Url;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::diff::{ChangeKind, diff_blocks};
pub use crate::engine::PageType;
use crate::engine::{PageDocument, PageRef};

const VALIDATOR_TIMEOUT: Duration = Duration::from_secs(10);

/// Tells the validator how long this client waits, so that it answers before then.
const CLIENT_TIMEOUT_HEADER: &str = "X-Client-Timeout-Ms";

/// The course settings that make blocks available, named as in the course settings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
pub struct CourseBlockFeatures {
    /// Gates `moocfi/lock-chapter`.
    pub chapter_locking_enabled: bool,
    /// Gates `moocfi/chatbot`.
    pub can_add_chatbot: bool,
}

/// The name of one of the course settings in [`CourseBlockFeatures`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CourseBlockFeature {
    ChapterLockingEnabled,
    CanAddChatbot,
}

/// The pages one write call validates.
#[derive(Debug, Clone)]
pub struct ValidationRequest<'a> {
    pub pages: Vec<PageValidationRequest<'a>>,
    pub course_features: CourseBlockFeatures,
}

/// The exercise block a list of blocks is validated as the children of.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExerciseContext {
    /// The instructions of an exercise task, the children of `moocfi/exercise-task`.
    TaskInstructions,
    /// An exercise's review instructions, the children of `moocfi/exercise-settings`.
    ReviewInstructions,
}

/// Where the validated blocks sit, which decides the blocks they may use.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(untagged)]
pub enum ValidationTarget {
    /// The top level of a page.
    Page { page_type: PageType },
    /// The children of an exercise block; `blocks` are its inner blocks, not a page.
    Exercise { exercise_context: ExerciseContext },
}

/// One list of blocks to validate: a page's, or an exercise's instructions.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PageValidationRequest<'a> {
    #[serde(flatten)]
    pub target: ValidationTarget,
    /// Full top-level trees: nested blocks are checked in their ancestors' context. Untyped in the
    /// schema because checking their shape is the validator's job.
    #[schema(value_type = Vec<Value>)]
    pub blocks: &'a [GutenbergBlock],
    /// Blocks in `blocks` that are as published: the teacher wrote them, so the validator spares
    /// them the rules on what agents may write and reports their other problems as warnings.
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    #[schema(value_type = Vec<Uuid>)]
    pub unchanged_client_ids: &'a [Uuid],
}

/// The body of the CMS's `POST /api/agent/validate-blocks`: one HTTP request's share of the pages
/// a write call validates, its pages already serialized.
#[derive(Serialize, ToSchema)]
pub struct ValidateBlocksRequest<'a> {
    #[schema(value_type = Vec<PageValidationRequest>)]
    pages: &'a [Box<RawValue>],
    course_features: CourseBlockFeatures,
}

/// The answer of the CMS's `POST /api/agent/validate-blocks`, a verdict per page in request order.
#[derive(Deserialize, ToSchema)]
pub struct ValidateBlocksResponse {
    pages: Vec<ValidationOutcome>,
}

/// The validator's verdict on one page: valid when `errors` is empty.
#[derive(Debug, Clone, PartialEq, Deserialize, ToSchema)]
pub struct ValidationOutcome {
    /// The blocks in request order, normalised the way the editor stores them.
    #[schema(value_type = Vec<Value>)]
    pub blocks: Vec<GutenbergBlock>,
    pub errors: Vec<BlockValidationError>,
    /// Problems of unchanged blocks, which never fail a write.
    pub warnings: Vec<BlockValidationError>,
}

/// What kind of rule a block breaks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum BlockValidationErrorCode {
    InvalidBlock,
    DuplicateClientId,
    UnknownBlock,
    NotAllowedHere,
    InvalidNesting,
    InvalidAttribute,
    ForbiddenAttribute,
    DisallowedMarkup,
}

/// A problem the validator found in a block, with how to fix it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct BlockValidationError {
    /// `None` only when the block has no usable client id; `path` then starts at the request.
    #[serde(rename = "clientId")]
    pub client_id: Option<Uuid>,
    /// Attribute path inside the block, e.g. `["attributes", "content"]`.
    pub path: Vec<Value>,
    pub code: BlockValidationErrorCode,
    pub message: String,
    pub fix: String,
}

/// The CMS's export of block registrations, the single source of block schemas, from
/// `GET /api/agent/block-schemas`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct BlockSchemas {
    pub version: String,
    /// The blocks agents may write on each page type.
    pub page_types: BTreeMap<PageType, Vec<String>>,
    /// Block name to the course setting that enables it.
    pub course_feature_gated_blocks: BTreeMap<String, CourseBlockFeature>,
    pub rich_text_formats: Vec<RichTextFormat>,
    pub blocks: BTreeMap<String, BlockSchema>,
    /// The largest `validate-blocks` request body the validator takes.
    pub max_request_bytes: usize,
}

/// An inline format rich text may use, and the tag it is stored as.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct RichTextFormat {
    pub name: String,
    pub tag: String,
    pub description: String,
}

/// One block type's registration: its attributes, where it may be nested and an example.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct BlockSchema {
    pub title: String,
    pub description: String,
    /// JSON Schema per attribute; rich text carries `x-rich-text` and `x-rich-text-formats`.
    #[schema(value_type = Object)]
    pub attributes: Map<String, Value>,
    /// `"root"` means the page's top level; None means anywhere the parent allows.
    pub allowed_parents: Option<Vec<String>>,
    /// None means any block the page allows; empty means no inner blocks.
    pub allowed_children: Option<Vec<String>>,
    pub template: Option<Value>,
    pub template_lock: Option<Value>,
    pub example: Value,
}

/// Why the validator gave no verdict.
#[derive(Debug, Clone, thiserror::Error)]
pub enum ValidatorError {
    /// Down, slow, warming up or overloaded. The agent can retry the same call.
    #[error("the content validator is unavailable: {reason}")]
    Unavailable {
        reason: String,
        retry_after: Option<Duration>,
    },
    /// The request is too slow or too big to validate. Not retryable as it is.
    #[error("the content validator couldn't take this many or this large blocks: {message}")]
    TooLarge { message: String },
    /// The validator failed on this input. Not retryable.
    #[error("the content validator failed on these blocks: {message}")]
    FailedOnInput { message: String },
    /// The validator refused the request itself (bad secret, malformed request). Not retryable.
    #[error("the content validator rejected the request ({status}): {message}")]
    Rejected { status: u16, message: String },
}

/// Checks the blocks agents write against the CMS's block registrations; [`CmsValidatorClient`]
/// in production.
#[async_trait]
pub trait BlockValidator: Send + Sync {
    /// The outcome of each page, in request order.
    async fn validate_blocks(
        &self,
        request: &ValidationRequest<'_>,
    ) -> Result<Vec<ValidationOutcome>, ValidatorError>;
    /// The current block registrations; [`crate::state::McpState::block_schemas`] caches them.
    async fn block_schemas(&self) -> Result<BlockSchemas, ValidatorError>;
}

/// HTTP client for the validator routes under the CMS's `/api/agent/`.
pub struct CmsValidatorClient {
    http: reqwest::Client,
    cms_internal_url: Url,
    secret: SecretString,
    /// [`BlockSchemas::max_request_bytes`] of the latest schemas fetched; 0 before the first.
    max_request_bytes: AtomicUsize,
}

impl CmsValidatorClient {
    /// `cms_internal_url` is the CMS base as a [`Url::join`] base, e.g. `http://cms:3000/cms/`.
    pub fn new(cms_internal_url: Url, secret: SecretString) -> Result<Self, reqwest::Error> {
        Ok(Self {
            http: reqwest::Client::builder()
                .timeout(VALIDATOR_TIMEOUT)
                .build()?,
            cms_internal_url,
            secret,
            max_request_bytes: AtomicUsize::new(0),
        })
    }

    /// The URL of the validator route `name`.
    fn route(&self, name: &str) -> Result<Url, ValidatorError> {
        self.cms_internal_url
            .join(&format!("api/agent/{name}"))
            .map_err(|e| ValidatorError::Unavailable {
                reason: format!("CMS_INTERNAL_URL has no route {name}: {e}"),
                retry_after: None,
            })
    }

    async fn send<T: for<'de> Deserialize<'de>>(
        &self,
        request: reqwest::RequestBuilder,
    ) -> Result<T, ValidatorError> {
        let response = request
            .bearer_auth(self.secret.expose_secret())
            .header(
                CLIENT_TIMEOUT_HEADER,
                VALIDATOR_TIMEOUT.as_millis().to_string(),
            )
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
        if status.is_server_error() {
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
            let body = response.text().await.unwrap_or_default();
            let message = serde_json::from_str::<Value>(&body)
                .ok()
                .and_then(|value| Some(value.get("error")?.as_str()?.to_string()))
                .unwrap_or(body);
            return Err(match status {
                reqwest::StatusCode::PAYLOAD_TOO_LARGE => ValidatorError::TooLarge { message },
                reqwest::StatusCode::UNPROCESSABLE_ENTITY => {
                    ValidatorError::FailedOnInput { message }
                }
                _ => ValidatorError::Rejected {
                    status: status.as_u16(),
                    message,
                },
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
    ) -> Result<Vec<ValidationOutcome>, ValidatorError> {
        let mut max_request_bytes = self.max_request_bytes.load(Ordering::Relaxed);
        if max_request_bytes == 0 {
            max_request_bytes = self.block_schemas().await?.max_request_bytes;
        }
        let url = self.route("validate-blocks")?;
        let mut outcomes = Vec::with_capacity(request.pages.len());
        for chunk in request_chunks(&request.pages, max_request_bytes) {
            let body = ValidateBlocksRequest {
                pages: &chunk,
                course_features: request.course_features,
            };
            let response: ValidateBlocksResponse =
                self.send(self.http.post(url.clone()).json(&body)).await?;
            outcomes.extend(response.pages);
        }
        Ok(outcomes)
    }

    async fn block_schemas(&self) -> Result<BlockSchemas, ValidatorError> {
        let schemas: BlockSchemas = self
            .send(self.http.get(self.route("block-schemas")?))
            .await?;
        self.max_request_bytes
            .store(schemas.max_request_bytes, Ordering::Relaxed);
        Ok(schemas)
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
    ) -> Result<Vec<ValidationOutcome>, ValidatorError> {
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

/// The pages, each serialized once, in consecutive runs that each fit in one request; a page too
/// large alone gets a request of its own, which the validator answers with
/// [`ValidatorError::TooLarge`].
fn request_chunks(
    pages: &[PageValidationRequest<'_>],
    max_request_bytes: usize,
) -> Vec<Vec<Box<RawValue>>> {
    let mut chunks = Vec::new();
    let mut chunk: Vec<Box<RawValue>> = Vec::new();
    let mut bytes = 0;
    for page in pages {
        let page = serde_json::value::to_raw_value(page).expect("blocks serialize to JSON");
        let page_bytes = page.get().len();
        if !chunk.is_empty() && bytes + page_bytes > max_request_bytes {
            chunks.push(std::mem::take(&mut chunk));
            bytes = 0;
        }
        bytes += page_bytes;
        chunk.push(page);
    }
    if !chunk.is_empty() {
        chunks.push(chunk);
    }
    chunks
}

/// The top-level trees of `page` that hold a block added, changed or moved there since `before`,
/// or that lost a child: a container's template can require the child. `before` is the page as it
/// was, if it existed.
pub(crate) fn changed_roots(
    before: Option<&PageDocument>,
    page: &PageDocument,
) -> Vec<GutenbergBlock> {
    let mut parent_before: HashMap<Uuid, Uuid> = HashMap::new();
    if let Some(before) = before {
        crate::engine::blocks::walk(&before.blocks, &mut |block, _| {
            for child in &block.inner_blocks {
                parent_before.insert(child.client_id, block.client_id);
            }
        });
    }
    let mut touched: HashSet<Uuid> = HashSet::new();
    let before_pages: Vec<PageRef> = before.map(PageDocument::as_page_ref).into_iter().collect();
    for change in diff_blocks(&before_pages, &[page.as_page_ref()]) {
        if change.kind != ChangeKind::Removed {
            touched.insert(change.block_id);
        }
        let left_its_parent = change.kind == ChangeKind::Removed || change.is_moved;
        if left_its_parent && let Some(parent) = parent_before.get(&change.block_id) {
            touched.insert(*parent);
        }
    }
    fn holds_touched(block: &GutenbergBlock, touched: &HashSet<Uuid>) -> bool {
        touched.contains(&block.client_id)
            || block
                .inner_blocks
                .iter()
                .any(|child| holds_touched(child, touched))
    }
    page.blocks
        .iter()
        .filter(|root| holds_touched(root, &touched))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::*;
    use crate::test_fixtures::{id, infobox, page, para};

    fn is_retryable(error: &ValidatorError) -> bool {
        matches!(error, ValidatorError::Unavailable { .. })
    }

    fn request(page_type: PageType, blocks: &[GutenbergBlock]) -> ValidationRequest<'_> {
        ValidationRequest {
            pages: vec![PageValidationRequest {
                target: ValidationTarget::Page { page_type },
                blocks,
                unchanged_client_ids: &[],
            }],
            course_features: CourseBlockFeatures {
                chapter_locking_enabled: false,
                can_add_chatbot: false,
            },
        }
    }

    #[test]
    fn large_batches_are_split_between_pages() {
        const MAX_REQUEST_BYTES: usize = 1_000_000;
        let big = vec![para("p1", &"x".repeat(MAX_REQUEST_BYTES / 2))];
        let small = vec![para("p2", "y")];
        let pages: Vec<PageValidationRequest> = [&big, &big, &small, &big]
            .into_iter()
            .map(|blocks| PageValidationRequest {
                target: ValidationTarget::Page {
                    page_type: PageType::CoursePage,
                },
                blocks,
                unchanged_client_ids: &[],
            })
            .collect();
        let sizes: Vec<usize> = request_chunks(&pages, MAX_REQUEST_BYTES)
            .iter()
            .map(|c| c.len())
            .collect();
        assert_eq!(sizes, vec![1, 2, 1]);
    }

    fn client(server: &mockito::Server) -> CmsValidatorClient {
        CmsValidatorClient::new(
            Url::parse(&format!("{}/", server.url())).unwrap(),
            SecretString::from("s3cret".to_string()),
        )
        .unwrap()
    }

    /// Block schemas with nothing in them but the request size limit.
    async fn mock_block_schemas(server: &mut mockito::Server) -> mockito::Mock {
        server
            .mock("GET", "/api/agent/block-schemas")
            .with_status(200)
            .with_body(
                json!({"version": "v", "page_types": {}, "course_feature_gated_blocks": {}, "rich_text_formats": [], "blocks": {}, "max_request_bytes": 1_000_000})
                    .to_string(),
            )
            .create_async()
            .await
    }

    #[test]
    fn targets_serialize_as_page_type_or_exercise_context() {
        let blocks = vec![para("p1", "Hi")];
        let body = |target| {
            serde_json::to_value(PageValidationRequest {
                target,
                blocks: &blocks,
                unchanged_client_ids: &[],
            })
            .unwrap()
        };
        let page = body(ValidationTarget::Page {
            page_type: PageType::TopLevelPage,
        });
        assert_eq!(page["page_type"], json!("top-level-page"));
        assert!(page.get("exercise_context").is_none());
        let task = body(ValidationTarget::Exercise {
            exercise_context: ExerciseContext::TaskInstructions,
        });
        assert_eq!(task["exercise_context"], json!("task_instructions"));
        assert!(task.get("page_type").is_none());
    }

    #[tokio::test]
    async fn sends_batch_with_bearer_and_parses_outcome() {
        let mut server = mockito::Server::new_async().await;
        mock_block_schemas(&mut server).await;
        let blocks = vec![para("p1", "Hi")];
        let mock = server
            .mock("POST", "/api/agent/validate-blocks")
            .match_header("authorization", "Bearer s3cret")
            .match_header("x-client-timeout-ms", "10000")
            .match_body(mockito::Matcher::PartialJson(json!({"pages": [{"page_type": "course-front-page"}], "course_features": {"chapter_locking_enabled": false}})))
            .with_status(200)
            .with_body(json!({"pages": [{"blocks": [], "errors": [{"clientId": null, "path": ["attributes","content"], "code": "disallowed_markup", "message": "m", "fix": "f"}], "warnings": []}]}).to_string())
            .create_async()
            .await;
        let request = request(PageType::CourseFrontPage, &blocks);
        let outcomes = client(&server).validate_blocks(&request).await.unwrap();
        mock.assert_async().await;
        let [outcome] = outcomes.as_slice() else {
            panic!("expected one page, got {outcomes:?}");
        };
        assert_eq!(outcome.errors[0].client_id, None);
        assert_eq!(
            outcome.errors[0].code,
            BlockValidationErrorCode::DisallowedMarkup
        );
    }

    #[tokio::test]
    async fn warming_up_is_retryable() {
        let mut server = mockito::Server::new_async().await;
        mock_block_schemas(&mut server).await;
        server
            .mock("POST", "/api/agent/validate-blocks")
            .with_status(503)
            .with_header("retry-after", "1")
            .with_body(r#"{"error":"The block validator is starting."}"#)
            .create_async()
            .await;
        let blocks = vec![];
        let request = request(PageType::CoursePage, &blocks);
        let error = client(&server).validate_blocks(&request).await.unwrap_err();
        assert!(is_retryable(&error));
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
        assert!(!is_retryable(
            &client(&server).block_schemas().await.unwrap_err()
        ));
        let unreachable = CmsValidatorClient::new(
            Url::parse("http://127.0.0.1:9/").unwrap(),
            SecretString::from("x".to_string()),
        )
        .unwrap();
        assert!(is_retryable(
            &unreachable.block_schemas().await.unwrap_err()
        ));
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
        let roots = changed_roots(Some(&before), &after);
        assert_eq!(roots.len(), 1);
        assert_eq!(roots[0].client_id, id("box"));
    }

    #[test]
    fn a_container_that_lost_a_child_is_a_changed_root() {
        let before = page(
            "pg1",
            PageType::CoursePage,
            vec![
                para("p1", "a"),
                infobox("box", vec![para("c1", "b"), para("c2", "c")]),
            ],
        );
        let mut after = before.clone();
        after.blocks[1].inner_blocks.remove(0);
        let roots = changed_roots(Some(&before), &after);
        assert_eq!(roots.len(), 1);
        assert_eq!(roots[0].client_id, id("box"));

        let mut moved_out = before.clone();
        let child = moved_out.blocks[1].inner_blocks.remove(1);
        moved_out.blocks.insert(0, child);
        let ids: Vec<Uuid> = changed_roots(Some(&before), &moved_out)
            .iter()
            .map(|root| root.client_id)
            .collect();
        assert!(ids.contains(&id("box")), "{ids:?}");
    }

    #[tokio::test]
    async fn too_large_and_failing_inputs_are_not_retryable() {
        let mut server = mockito::Server::new_async().await;
        mock_block_schemas(&mut server).await;
        server
            .mock("POST", "/api/agent/validate-blocks")
            .with_status(413)
            .with_body(r#"{"error":"Too big. Write fewer or smaller blocks per call."}"#)
            .create_async()
            .await;
        let blocks = vec![];
        let request = request(PageType::CoursePage, &blocks);
        let client = client(&server);
        let error = client.validate_blocks(&request).await.unwrap_err();
        assert!(
            matches!(&error, ValidatorError::TooLarge { message } if message.starts_with("Too big")),
            "{error:?}"
        );
        server.reset();
        server
            .mock("POST", "/api/agent/validate-blocks")
            .with_status(422)
            .with_body(r#"{"error":"boom"}"#)
            .create_async()
            .await;
        let error = client.validate_blocks(&request).await.unwrap_err();
        assert!(!is_retryable(&error));
        assert!(
            matches!(error, ValidatorError::FailedOnInput { .. }),
            "{error:?}"
        );
    }
}
