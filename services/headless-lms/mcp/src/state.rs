//! What the tool handlers share: the database, configuration and the services writes depend on.

use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::future::BoxFuture;
use headless_lms_base::{config::ApplicationConfiguration, jwt::JwtKey};
use headless_lms_models::{ModelResult, exercise_service_info::ExerciseServiceInfoApi};
use headless_lms_utils::file_store::FileStore;
use serde_json::Value;
use sqlx::PgPool;
use tokio::sync::RwLock;
use url::Url;
use uuid::Uuid;

use crate::engine::glossary_references::BibtexParser;
use crate::validator::{BlockSchemas, BlockValidator};

const SCHEMA_CACHE_TTL: Duration = Duration::from_secs(300);

/// Fetches an exercise service's public and model specs while publishing saves a page.
pub type SpecFetcher = Box<
    dyn for<'a> Fn(Url, &'a str, Option<&'a Value>) -> BoxFuture<'a, ModelResult<Value>>
        + Send
        + Sync,
>;

/// Fetches an exercise service's info while publishing saves a page.
pub type ServiceInfoFetcher =
    Arc<dyn Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> + Send + Sync>;

/// The exercise-service calls publishing makes. The server owns their HTTP clients.
#[derive(Clone)]
pub struct ExerciseServiceClients {
    /// Builds a spec fetcher for one request id.
    pub spec_fetcher: Arc<dyn Fn(Uuid) -> SpecFetcher + Send + Sync>,
    pub fetch_service_info: ServiceInfoFetcher,
}

/// Everything a tool handler needs besides its request.
pub struct McpState {
    pub pool: PgPool,
    pub app_conf: ApplicationConfiguration,
    pub jwt_key: Arc<JwtKey>,
    pub file_store: Arc<dyn FileStore + Send + Sync>,
    pub validator: Arc<dyn BlockValidator>,
    pub bibtex: Arc<dyn BibtexParser>,
    pub exercise_services: ExerciseServiceClients,
    block_schemas: RwLock<Option<(Instant, Arc<BlockSchemas>)>>,
}

impl McpState {
    pub fn new(
        pool: PgPool,
        app_conf: ApplicationConfiguration,
        jwt_key: Arc<JwtKey>,
        file_store: Arc<dyn FileStore + Send + Sync>,
        validator: Arc<dyn BlockValidator>,
        bibtex: Arc<dyn BibtexParser>,
        exercise_services: ExerciseServiceClients,
    ) -> Self {
        Self {
            pool,
            app_conf,
            jwt_key,
            file_store,
            validator,
            bibtex,
            exercise_services,
            block_schemas: RwLock::new(None),
        }
    }

    /// `path` (starting with `/`) on the public site.
    pub fn public_url(&self, path: &str) -> String {
        format!("{}{path}", self.app_conf.base_url.trim_end_matches('/'))
    }

    /// The page where the teacher reviews, publishes or discards a changeset.
    pub fn review_url(&self, course_id: Uuid, changeset_id: Uuid) -> String {
        self.public_url(&format!(
            "/manage/courses/{course_id}/agent-changesets/{changeset_id}"
        ))
    }

    /// The CMS block schemas, cached briefly; `None` when the CMS can't be reached, since callers
    /// only use them for format tips.
    pub async fn block_schemas(&self) -> Option<Arc<BlockSchemas>> {
        if let Some((fetched_at, schemas)) = self.block_schemas.read().await.as_ref()
            && fetched_at.elapsed() < SCHEMA_CACHE_TTL
        {
            return Some(schemas.clone());
        }
        let schemas = Arc::new(self.validator.block_schemas().await.ok()?);
        *self.block_schemas.write().await = Some((Instant::now(), schemas.clone()));
        Some(schemas)
    }
}
