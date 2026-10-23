//! Builds the MCP endpoint at `/api/v0/mcp` from the server's configuration.

use std::{env, sync::Arc};

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_mcp::{
    engine::glossary_references::BasicBibtexParser,
    hints::{CURRENT_SKILL_VERSION, MINIMUM_SKILL_VERSION},
    http::{EndpointConfig, McpEndpoint, auth::protected_resource_metadata_url},
    state::{ExerciseServiceClients, McpState, SpecFetcher},
    validator::{BlockValidator, CmsValidatorClient, UnconfiguredValidator},
};
use headless_lms_utils::file_store::FileStore;
use secrecy::ExposeSecret;
use sqlx::PgPool;

use crate::domain::models_requests::{self, JwtKey};

/// The endpoint with its tools. Without `CMS_INTERNAL_URL` and `AGENT_VALIDATOR_SECRET`, agent
/// writes fail closed and reads keep working. `MCP_SKILL_CURRENT_VERSION` and
/// `MCP_SKILL_MINIMUM_VERSION` override the skill versions the server expects.
pub fn build_mcp_endpoint(
    db_pool: PgPool,
    app_conf: &ApplicationConfiguration,
    jwt_key: Arc<JwtKey>,
    file_store: Arc<dyn FileStore + Send + Sync>,
) -> McpEndpoint {
    let validator: Arc<dyn BlockValidator> = match CmsValidatorClient::from_env() {
        Ok(client) => Arc::new(client),
        Err(err) => {
            warn!("Agent writes through MCP are disabled: {err}");
            Arc::new(UnconfiguredValidator {
                reason: err.to_string(),
            })
        }
    };
    let base_url = app_conf.base_url.clone();
    let spec_jwt_key = jwt_key.clone();
    let exercise_services = ExerciseServiceClients {
        spec_fetcher: Arc::new(move |request_id| {
            Box::new(models_requests::make_spec_fetcher(
                base_url.clone(),
                request_id,
                spec_jwt_key.clone(),
            )) as SpecFetcher
        }),
        fetch_service_info: Arc::new(models_requests::fetch_service_info),
    };
    let state = McpState::new(
        db_pool,
        app_conf.clone(),
        jwt_key,
        file_store,
        validator,
        Arc::new(BasicBibtexParser),
        exercise_services,
    );
    McpEndpoint::new(
        state,
        EndpointConfig {
            server_version: env!("CARGO_PKG_VERSION").to_string(),
            resource_metadata_url: protected_resource_metadata_url(app_conf),
            request_state_secret: app_conf.jwt_password.expose_secret().to_string(),
            current_skill_version: env::var("MCP_SKILL_CURRENT_VERSION")
                .unwrap_or_else(|_| CURRENT_SKILL_VERSION.to_string()),
            minimum_skill_version: env::var("MCP_SKILL_MINIMUM_VERSION")
                .unwrap_or_else(|_| MINIMUM_SKILL_VERSION.to_string()),
        },
    )
}
