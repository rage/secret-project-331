//! What the tool handlers share: the database, configuration and the services writes depend on.

use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::future::BoxFuture;
use headless_lms_base::{config::ApplicationConfiguration, jwt::JwtKey};
use headless_lms_models::{
    ModelResult, SpecFetcher, exercise_service_info::ExerciseServiceInfoApi,
};
use headless_lms_utils::file_store::FileStore;
use sqlx::PgPool;
use tokio::sync::Mutex;
use url::Url;
use uuid::Uuid;

use crate::validator::{BlockSchemas, BlockValidator, ValidatorError};

const SCHEMA_CACHE_TTL: Duration = Duration::from_secs(300);

/// Fetches an exercise service's info while publishing saves a page.
pub type ServiceInfoFetcher =
    Arc<dyn Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> + Send + Sync>;

/// The exercise-service calls publishing makes. The server owns their HTTP clients.
#[derive(Clone)]
pub struct ExerciseServiceClients {
    /// A spec fetcher for one publish, under a request id of its own.
    pub spec_fetcher: Arc<dyn Fn() -> Box<dyn SpecFetcher + Send + Sync> + Send + Sync>,
    pub fetch_service_info: ServiceInfoFetcher,
}

/// Everything a tool handler needs besides its request.
pub struct McpState {
    pub pool: PgPool,
    pub app_conf: ApplicationConfiguration,
    pub jwt_key: Arc<JwtKey>,
    pub file_store: Arc<dyn FileStore + Send + Sync>,
    pub validator: Arc<dyn BlockValidator>,
    pub exercise_services: ExerciseServiceClients,
    /// Held while fetching, so calls that find the cache stale meanwhile wait for that one fetch.
    block_schemas: Mutex<Option<(Instant, Arc<BlockSchemas>)>>,
}

impl McpState {
    /// The state with an empty block schema cache.
    pub fn new(
        pool: PgPool,
        app_conf: ApplicationConfiguration,
        jwt_key: Arc<JwtKey>,
        file_store: Arc<dyn FileStore + Send + Sync>,
        validator: Arc<dyn BlockValidator>,
        exercise_services: ExerciseServiceClients,
    ) -> Self {
        Self {
            pool,
            app_conf,
            jwt_key,
            file_store,
            validator,
            exercise_services,
            block_schemas: Mutex::new(None),
        }
    }

    /// The page where the teacher reviews, publishes or discards a changeset.
    pub fn review_url(&self, changeset_id: Uuid) -> String {
        self.app_conf
            .public_url(&format!("/manage/agent-changesets/{changeset_id}"))
    }

    /// The CMS block schemas, cached briefly.
    pub async fn block_schemas(&self) -> Result<Arc<BlockSchemas>, ValidatorError> {
        let mut cache = self.block_schemas.lock().await;
        if let Some((fetched_at, schemas)) = &*cache
            && fetched_at.elapsed() < SCHEMA_CACHE_TTL
        {
            return Ok(schemas.clone());
        }
        let schemas = Arc::new(self.validator.block_schemas().await?);
        *cache = Some((Instant::now(), schemas.clone()));
        Ok(schemas)
    }
}
