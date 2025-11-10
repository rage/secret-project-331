use std::str::FromStr;

use headless_lms_models::{library::oauth::pkce, oauth_client, oauth_shared_types::Digest};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

pub struct SeedOAuthClientsResult {
    pub client_db_id: Uuid,
}

pub async fn seed_oauth_clients(db_pool: Pool<Postgres>) -> anyhow::Result<SeedOAuthClientsResult> {
    info!("Inserting OAuth Clients");
    let secret =
        Digest::from_str("b644133604bf99632137be3e9230c4056bd32eb2f404020d70adcde88353c760")
            .unwrap(); // "very-secret"
    let mut conn = db_pool.acquire().await?;
    let new_client_parms = oauth_client::NewClientParams {
        client_name: "Test Client",
        application_type: oauth_client::ApplicationType::Web,
        client_id: "test-client-id",
        client_secret: Some(&secret), // "very-secret"
        client_secret_expires_at: None,
        redirect_uris: &["http://127.0.0.1:8765/callback".to_string()],
        allowed_grant_types: &[oauth_client::GrantType::AuthorizationCode],
        scopes: &[
            "openid".to_string(),
            "profile".to_string(),
            "email".to_string(),
        ],
        origin: "http://localhost",
        bearer_allowed: true,
        pkce_methods_allowed: &[pkce::PkceMethod::S256],
        post_logout_redirect_uris: None,
        require_pkce: true,
        token_endpoint_auth_method: oauth_client::TokenEndpointAuthMethod::ClientSecretPost,
    };

    let client = oauth_client::OAuthClient::insert(&mut conn, new_client_parms).await?;

    Ok(SeedOAuthClientsResult {
        client_db_id: client.id,
    })
}
