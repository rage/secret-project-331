//! Builds the MCP endpoint at `/api/v0/mcp` from the server's configuration.

use std::sync::Arc;

use headless_lms_base::config::{ApplicationConfiguration, McpConfiguration};
use headless_lms_mcp::{
    http::McpEndpoint,
    state::{ExerciseRepositoryRules, ExerciseServiceClients, McpState},
    validator::{BlockValidator, CmsValidatorClient, UnconfiguredValidator},
};
use headless_lms_utils::file_store::FileStore;
use secrecy::SecretString;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::domain::{
    exercise_repositories,
    models_requests::{self, JwtKey},
};

/// The endpoint with its tools. Without a configured block validator, agent writes fail closed and
/// reads keep working.
pub fn build_mcp_endpoint(
    db_pool: PgPool,
    app_conf: &ApplicationConfiguration,
    jwt_key: Arc<JwtKey>,
    file_store: Arc<dyn FileStore + Send + Sync>,
) -> McpEndpoint {
    let validator = block_validator(app_conf.mcp_configuration.as_ref());
    let base_url = app_conf.base_url.clone();
    let spec_jwt_key = jwt_key.clone();
    let exercise_services = ExerciseServiceClients {
        spec_fetcher: Arc::new(move || {
            Box::new(models_requests::make_spec_fetcher(
                base_url.clone(),
                Uuid::new_v4(),
                spec_jwt_key.clone(),
            ))
        }),
        fetch_service_info: Arc::new(models_requests::fetch_service_info),
        fetch_private_spec_schema: Arc::new(models_requests::fetch_private_spec_schema),
    };
    let repository_rules = Arc::new(ServerRepositoryRules {
        file_store: file_store.clone(),
    });
    let state = McpState::new(
        db_pool,
        app_conf.clone(),
        jwt_key,
        file_store,
        validator,
        exercise_services,
        repository_rules,
    );
    McpEndpoint::new(state)
}

fn block_validator(mcp_configuration: Option<&McpConfiguration>) -> Arc<dyn BlockValidator> {
    let Some(mcp_configuration) = mcp_configuration else {
        return unconfigured("CMS_INTERNAL_URL and AGENT_VALIDATOR_SECRET must both be set".into());
    };
    match CmsValidatorClient::new(
        mcp_configuration.cms_internal_url.clone(),
        mcp_configuration.agent_validator_secret.clone(),
    ) {
        Ok(client) => Arc::new(client),
        Err(err) => unconfigured(format!("couldn't build the validator's HTTP client: {err}")),
    }
}

fn unconfigured(reason: String) -> Arc<dyn BlockValidator> {
    warn!("Agent writes through MCP are disabled: {reason}");
    Arc::new(UnconfiguredValidator { reason })
}

/// The rules of the exercise repository routes, for the MCP repository tools.
struct ServerRepositoryRules {
    file_store: Arc<dyn FileStore + Send + Sync>,
}

#[async_trait::async_trait(?Send)]
impl ExerciseRepositoryRules for ServerRepositoryRules {
    async fn check_url_and_branch(
        &self,
        url: &str,
        branch: Option<&str>,
    ) -> Result<Option<String>, String> {
        exercise_repositories::check_url_and_branch(url, branch)
            .await
            .map(|branch| branch.map(str::to_string))
            .map_err(|err| err.to_string())
    }

    fn generate_deploy_key(&self) -> Result<(String, SecretString), String> {
        exercise_repositories::generate_deploy_key().map_err(|err| format!("{err:#}"))
    }

    async fn delete(&self, conn: &mut PgConnection, repository_id: Uuid) -> Result<(), String> {
        exercise_repositories::delete(conn, repository_id, self.file_store.as_ref())
            .await
            .map_err(|err| format!("{err:#}"))
    }
}
