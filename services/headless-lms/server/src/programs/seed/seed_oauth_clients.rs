use std::str::FromStr;

use headless_lms_models::{
    library::oauth::{Digest, GrantTypeName, pkce},
    oauth_client,
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

pub struct SeedOAuthClientsResult {
    pub client_db_id: Uuid,
}

const TEST_CLIENT_IDS: &[&str] = &["test-client-id", "test-client-id-2", "test-client-id-3"];

pub async fn seed_oauth_clients(db_pool: Pool<Postgres>) -> anyhow::Result<SeedOAuthClientsResult> {
    info!("Inserting OAuth Clients");
    let secret =
        Digest::from_str("396b544a35b29f7d613452a165dcaebf4d71b80e981e687e91ce6d9ba9679cb2")
            .unwrap(); // "very-secret"
    let mut conn = db_pool.acquire().await?;
    // One redirect URI per Playwright worker (ports 8765..8784) so each worker has its own callback server.
    // Must match system-tests getRedirectUri(): http://127.0.0.1:{port}/callback
    let mut redirect_uris: Vec<String> = (8765..=8784)
        .map(|p| format!("http://127.0.0.1:{p}/callback"))
        .collect();
    redirect_uris.push("https://localhost.emobix.co.uk:8443/test/a/testing/callback".to_string());

    // Update redirect_uris for existing test clients so re-running seed fixes "redirect_uri does not match client".
    for client_id in TEST_CLIENT_IDS {
        let updated = sqlx::query(
            "UPDATE oauth_clients SET redirect_uris = $1, updated_at = now() WHERE client_id = $2 AND deleted_at IS NULL",
        )
        .bind(&redirect_uris)
        .bind(*client_id)
        .execute(&mut *conn)
        .await?;
        if updated.rows_affected() > 0 {
            info!(
                "Updated redirect_uris for existing OAuth client {}",
                client_id
            );
        }
    }

    let scopes = vec![
        "openid".to_string(),
        "profile".to_string(),
        "email".to_string(),
        "offline_access".to_string(),
    ];
    let allowed_grant_types = vec![
        GrantTypeName::AuthorizationCode,
        GrantTypeName::RefreshToken,
    ];
    let pkce_methods_allowed = vec![pkce::PkceMethod::S256];

    let new_client_parms = oauth_client::NewClientParams {
        client_name: "Test Client",
        application_type: oauth_client::ApplicationType::Web,
        client_id: "test-client-id",
        client_secret: Some(&secret), // "very-secret"
        client_secret_expires_at: None,
        redirect_uris: redirect_uris.as_slice(),
        allowed_grant_types: &allowed_grant_types,
        scopes: scopes.as_slice(),
        origin: "http://localhost",
        bearer_allowed: true,
        pkce_methods_allowed: &pkce_methods_allowed,
        post_logout_redirect_uris: None,
        require_pkce: true,
        token_endpoint_auth_method: oauth_client::TokenEndpointAuthMethod::ClientSecretPost,
    };

    let client = if let Some(existing) =
        oauth_client::OAuthClient::find_by_client_id_optional(&mut conn, "test-client-id").await?
    {
        existing
    } else {
        oauth_client::OAuthClient::insert(&mut conn, new_client_parms).await?
    };

    let new_client_parms_2 = oauth_client::NewClientParams {
        client_name: "Test Client 2",
        application_type: oauth_client::ApplicationType::Web,
        client_id: "test-client-id-2",
        client_secret: Some(&secret), // "very-secret"
        client_secret_expires_at: None,
        redirect_uris: redirect_uris.as_slice(),
        allowed_grant_types: &allowed_grant_types,
        scopes: scopes.as_slice(),
        origin: "http://localhost",
        bearer_allowed: true,
        pkce_methods_allowed: &pkce_methods_allowed,
        post_logout_redirect_uris: None,
        require_pkce: false,
        token_endpoint_auth_method: oauth_client::TokenEndpointAuthMethod::ClientSecretPost,
    };
    if oauth_client::OAuthClient::find_by_client_id_optional(&mut conn, "test-client-id-2")
        .await?
        .is_none()
    {
        let _client_2 = oauth_client::OAuthClient::insert(&mut conn, new_client_parms_2).await?;
    }

    let new_client_parms_3 = oauth_client::NewClientParams {
        client_name: "Test Client 3",
        application_type: oauth_client::ApplicationType::Web,
        client_id: "test-client-id-3",
        client_secret: Some(&secret), // "very-secret"
        client_secret_expires_at: None,
        redirect_uris: redirect_uris.as_slice(),
        allowed_grant_types: &allowed_grant_types,
        scopes: scopes.as_slice(),
        origin: "http://localhost",
        bearer_allowed: true,
        pkce_methods_allowed: &pkce_methods_allowed,
        post_logout_redirect_uris: None,
        require_pkce: false,
        token_endpoint_auth_method: oauth_client::TokenEndpointAuthMethod::ClientSecretPost,
    };
    if oauth_client::OAuthClient::find_by_client_id_optional(&mut conn, "test-client-id-3")
        .await?
        .is_none()
    {
        let _client_3 = oauth_client::OAuthClient::insert(&mut conn, new_client_parms_3).await?;
    }

    Ok(SeedOAuthClientsResult {
        client_db_id: client.id,
    })
}
