//! Builds the MCP endpoint at `/api/v0/mcp` from the server's configuration.

use std::sync::Arc;

use headless_lms_base::config::{ApplicationConfiguration, McpConfiguration};
use headless_lms_mcp::{
    http::McpEndpoint,
    state::{ExerciseServiceClients, McpState},
    validator::{BlockValidator, CmsValidatorClient, UnconfiguredValidator},
};
use headless_lms_utils::file_store::FileStore;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::models_requests::{self, JwtKey};

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
    };
    let state = McpState::new(
        db_pool,
        app_conf.clone(),
        jwt_key,
        file_store,
        validator,
        exercise_services,
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
