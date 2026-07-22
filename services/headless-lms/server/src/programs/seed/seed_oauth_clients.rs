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
    let allowed_origins = vec!["http://localhost".to_string()];

    let new_client_parms = oauth_client::NewClientParams {
        client_name: "Test Client",
        application_type: oauth_client::ApplicationType::Web,
        client_id: "test-client-id",
        client_secret: Some(&secret), // "very-secret"
        client_secret_expires_at: None,
        redirect_uris: redirect_uris.as_slice(),
        allowed_grant_types: &allowed_grant_types,
        scopes: scopes.as_slice(),
        allowed_origins: Some(allowed_origins.as_slice()),
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
        allowed_origins: Some(allowed_origins.as_slice()),
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
        allowed_origins: Some(allowed_origins.as_slice()),
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

    // Dev/test mirrors of the two clients provisioned in prod by
    // 20260722140000_provision_device_flow_oauth_clients. Kept here (not only in the
    // migration) so the seeded local/CI database has them with deterministic secrets.

    // 4) tmc-cli-vscode: public native client for the RFC 8628 device-flow login. Same
    //    id and shape as prod (public clients have no secret to seed).
    let device_grant_types = vec![GrantTypeName::DeviceCode, GrantTypeName::RefreshToken];
    let device_redirect_uris = vec!["urn:ietf:wg:oauth:2.0:oob".to_string()];
    let exercise_services_scopes = vec!["exercise-services".to_string()];
    let tmc_cli_vscode_params = oauth_client::NewClientParams {
        client_id: "tmc-cli-vscode",
        client_name: "TMC CLI / VSCode extension",
        application_type: oauth_client::ApplicationType::Native,
        token_endpoint_auth_method: oauth_client::TokenEndpointAuthMethod::None,
        client_secret: None,
        client_secret_expires_at: None,
        redirect_uris: device_redirect_uris.as_slice(),
        post_logout_redirect_uris: None,
        allowed_grant_types: &device_grant_types,
        scopes: exercise_services_scopes.as_slice(),
        require_pkce: true,
        pkce_methods_allowed: &pkce_methods_allowed,
        allowed_origins: None,
        bearer_allowed: true,
    };
    if oauth_client::OAuthClient::find_by_client_id_optional(&mut conn, "tmc-cli-vscode")
        .await?
        .is_none()
    {
        oauth_client::OAuthClient::insert(&mut conn, tmc_cli_vscode_params).await?;
    }

    // 5) tmc-server-introspection-dev: confidential client tmc-server uses to introspect our
    //    tokens locally. The dev client_id/secret intentionally differ from prod and match
    //    tmc-server's config/secrets.yml dev defaults: id `tmc-server-introspection-dev`,
    //    secret `for local development only, intentionally public`. The stored digest below is
    //    HMAC-SHA-256(oauth_token_hmac_key="pippuri", <that secret>) — the dev/CI HMAC key
    //    (OAUTH_TOKEN_HMAC_KEY=cGlwcHVyaQ== in kubernetes/{dev,test}/headless-lms/env.yml).
    let introspection_secret =
        Digest::from_str("aca61813af4f1b77f72cc2db856aa9ff4ea4080c188359b1edc51393c824abd5")
            .unwrap(); // "for local development only, intentionally public"
    let no_grants: Vec<GrantTypeName> = vec![];
    let no_scopes: Vec<String> = vec![];
    let introspection_params = oauth_client::NewClientParams {
        client_id: "tmc-server-introspection-dev",
        client_name: "tmc-server token introspection (dev)",
        application_type: oauth_client::ApplicationType::Service,
        token_endpoint_auth_method: oauth_client::TokenEndpointAuthMethod::ClientSecretPost,
        client_secret: Some(&introspection_secret),
        client_secret_expires_at: None,
        redirect_uris: device_redirect_uris.as_slice(),
        post_logout_redirect_uris: None,
        allowed_grant_types: &no_grants,
        scopes: no_scopes.as_slice(),
        require_pkce: false,
        pkce_methods_allowed: &pkce_methods_allowed,
        allowed_origins: None,
        bearer_allowed: false,
    };
    if oauth_client::OAuthClient::find_by_client_id_optional(
        &mut conn,
        "tmc-server-introspection-dev",
    )
    .await?
    .is_none()
    {
        oauth_client::OAuthClient::insert(&mut conn, introspection_params).await?;
    }

    // 6) tmc-cli-vscode-noscope-test: TEST/DEV ONLY. A device-flow client that carries a
    //    scope other than exercise-services, so a token minted through it lets tests exercise
    //    the exercise-services scope gate (403) without borrowing the shared test-client-id or
    //    another spec's user. Not provisioned in prod.
    let noscope_grant_types = vec![GrantTypeName::DeviceCode];
    let openid_scopes = vec!["openid".to_string()];
    let noscope_params = oauth_client::NewClientParams {
        client_id: "tmc-cli-vscode-noscope-test",
        client_name: "TMC CLI device client without exercise-services (test)",
        application_type: oauth_client::ApplicationType::Native,
        token_endpoint_auth_method: oauth_client::TokenEndpointAuthMethod::None,
        client_secret: None,
        client_secret_expires_at: None,
        redirect_uris: device_redirect_uris.as_slice(),
        post_logout_redirect_uris: None,
        allowed_grant_types: &noscope_grant_types,
        scopes: openid_scopes.as_slice(),
        require_pkce: true,
        pkce_methods_allowed: &pkce_methods_allowed,
        allowed_origins: None,
        bearer_allowed: true,
    };
    if oauth_client::OAuthClient::find_by_client_id_optional(
        &mut conn,
        "tmc-cli-vscode-noscope-test",
    )
    .await?
    .is_none()
    {
        oauth_client::OAuthClient::insert(&mut conn, noscope_params).await?;
    }

    Ok(SeedOAuthClientsResult {
        client_db_id: client.id,
    })
}
