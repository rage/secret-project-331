//! What the tool handlers share: the database, configuration and the services writes depend on.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use futures::future::BoxFuture;
use headless_lms_base::{config::ApplicationConfiguration, jwt::JwtKey};
use headless_lms_models::{
    ModelResult, SpecFetcher,
    error::TryToOptional,
    exercise_service_info::{self, ExerciseServiceInfoApi},
    exercise_services,
};
use headless_lms_utils::file_store::FileStore;
use secrecy::SecretString;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgConnection;
use sqlx::PgPool;
use tokio::sync::Mutex;
use url::Url;
use uuid::Uuid;

use crate::access::connection;
use crate::tools::ToolError;
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
    /// What a service serves at its private spec schema path; `None` when it answers 404.
    pub fetch_private_spec_schema:
        Arc<dyn Fn(Url) -> BoxFuture<'static, ModelResult<Option<Value>>> + Send + Sync>,
}

/// The exercise repository rules the server's routes apply, shared with the repository tools.
#[async_trait(?Send)]
pub trait ExerciseRepositoryRules: Send + Sync {
    /// The branch to store, blank as none, or why the clone URL or branch is refused.
    async fn check_url_and_branch(
        &self,
        url: &str,
        branch: Option<&str>,
    ) -> Result<Option<String>, String>;

    /// A new deploy key pair: the OpenSSH public key and the private key.
    fn generate_deploy_key(&self) -> Result<(String, SecretString), String>;

    /// Deletes the repository with its exercises and the archives nothing else uses.
    async fn delete(&self, conn: &mut PgConnection, repository_id: Uuid) -> Result<(), String>;
}

/// When a private spec schema was fetched, and the schema; `None` for a service serving none.
type CachedSchema = (Instant, Option<Arc<PrivateSpecSchema>>);

/// The JSON Schema of an exercise service's private specs, as the service serves it.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PrivateSpecSchema {
    pub schema: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub examples: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/// Everything a tool handler needs besides its request.
pub struct McpState {
    pub pool: PgPool,
    pub app_conf: ApplicationConfiguration,
    pub jwt_key: Arc<JwtKey>,
    pub file_store: Arc<dyn FileStore + Send + Sync>,
    pub validator: Arc<dyn BlockValidator>,
    pub exercise_services: ExerciseServiceClients,
    pub repository_rules: Arc<dyn ExerciseRepositoryRules>,
    /// By exercise type. Each type's own lock is held while fetching, so a slow service only
    /// delays calls for its type.
    private_spec_schemas: Mutex<HashMap<String, Arc<Mutex<Option<CachedSchema>>>>>,
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
        repository_rules: Arc<dyn ExerciseRepositoryRules>,
    ) -> Self {
        Self {
            pool,
            app_conf,
            jwt_key,
            file_store,
            validator,
            exercise_services,
            repository_rules,
            private_spec_schemas: Mutex::new(HashMap::new()),
            block_schemas: Mutex::new(None),
        }
    }

    /// The page where the teacher reviews, publishes or discards a changeset.
    pub fn review_url(&self, changeset_id: Uuid) -> String {
        self.app_conf
            .public_url(&format!("/manage/agent-changesets/{changeset_id}"))
    }

    /// The private spec schema the exercise service of `exercise_type` serves, cached briefly;
    /// `None` when it serves none.
    pub async fn private_spec_schema(
        &self,
        exercise_type: &str,
    ) -> Result<Option<Arc<PrivateSpecSchema>>, ToolError> {
        let entry = self
            .private_spec_schemas
            .lock()
            .await
            .entry(exercise_type.to_string())
            .or_default()
            .clone();
        let mut cached = entry.lock().await;
        if let Some((fetched_at, schema)) = &*cached
            && fetched_at.elapsed() < SCHEMA_CACHE_TTL
        {
            return Ok(schema.clone());
        }
        let mut conn = connection(self).await?;
        let service =
            exercise_services::get_exercise_service_by_exercise_type(&mut conn, exercise_type)
                .await
                .optional()?
                .ok_or_else(|| ToolError::InvalidArguments {
                    message: format!("there is no exercise service {exercise_type:?}"),
                })?;
        let info = exercise_service_info::get_upsert_service_info_by_exercise_service(
            &mut conn,
            &service,
            &*self.exercise_services.fetch_service_info,
        )
        .await?;
        drop(conn);
        let schema = match exercise_services::get_internal_private_spec_schema_url(&service, &info)? {
            Some(url) => (self.exercise_services.fetch_private_spec_schema)(url)
                .await?
                .map(|body| {
                    serde_json::from_value::<PrivateSpecSchema>(body).map_err(|e| {
                        ToolError::Internal(format!(
                            "the {exercise_type} service's private spec schema isn't {{schema, examples?, notes?}}: {e}"
                        ))
                    })
                })
                .transpose()?
                .map(Arc::new),
            None => None,
        };
        *cached = Some((Instant::now(), schema.clone()));
        Ok(schema)
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
