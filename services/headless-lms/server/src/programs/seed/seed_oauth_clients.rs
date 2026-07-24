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

/// The dev/CI HMAC key used to derive every stored client-secret digest below.
///
/// `base/src/config.rs` loads `OAUTH_TOKEN_HMAC_KEY` **raw** (it is NOT
/// base64-decoded), and `kubernetes/{dev,test}/headless-lms/env.yml` set
/// `OAUTH_TOKEN_HMAC_KEY: cGlwcHVyaQ==`, so the runtime key is the literal
/// string `cGlwcHVyaQ==`. The seeded digests must therefore be
/// `HMAC-SHA-256(key = "cGlwcHVyaQ==", <secret>)` or client-secret validation
/// (`token_digest_sha256` in the token/introspection endpoints) can never match.
/// The `seeded_secret_digests_match_dev_hmac_key` test pins these to that exact
/// derivation via the real `token_digest_sha256`.
// Consumed by the pinning test below; documents the runtime key for the digests.
#[cfg_attr(not(test), allow(dead_code))]
const DEV_OAUTH_TOKEN_HMAC_KEY: &str = "cGlwcHVyaQ==";

/// Digest of the shared "Test Client" family secret (plaintext `very-secret`),
/// derived under [`DEV_OAUTH_TOKEN_HMAC_KEY`].
const TEST_CLIENT_SECRET_DIGEST_HEX: &str =
    "4b23ad6c1a2e9d91a4b9ab75bebb3619659cd2ee1f9c49dfaee548106ac74622";

/// Digest of the `tmc-server-introspection-dev` client secret (plaintext
/// `for local development only, intentionally public`), derived under
/// [`DEV_OAUTH_TOKEN_HMAC_KEY`].
const INTROSPECTION_SECRET_DIGEST_HEX: &str =
    "30d29726ab19c31e346bddebe2f8f7a102b5a6ce72a1a6f7850d0b432343b770";

pub async fn seed_oauth_clients(db_pool: Pool<Postgres>) -> anyhow::Result<SeedOAuthClientsResult> {
    info!("Inserting OAuth Clients");
    let secret = Digest::from_str(TEST_CLIENT_SECRET_DIGEST_HEX).unwrap(); // "very-secret"
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
    //    secret `for local development only, intentionally public`. The stored digest is
    //    HMAC-SHA-256(key = "cGlwcHVyaQ==", <that secret>): the runtime HMAC key is the RAW
    //    value of OAUTH_TOKEN_HMAC_KEY (config.rs does not base64-decode it), and dev/CI set
    //    OAUTH_TOKEN_HMAC_KEY=cGlwcHVyaQ== in kubernetes/{dev,test}/headless-lms/env.yml.
    let introspection_secret = Digest::from_str(INTROSPECTION_SECRET_DIGEST_HEX).unwrap(); // "for local development only, intentionally public"
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

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use headless_lms_models::library::oauth::{Digest, token_digest_sha256};
    use secrecy::SecretString;

    use super::{
        DEV_OAUTH_TOKEN_HMAC_KEY, INTROSPECTION_SECRET_DIGEST_HEX, TEST_CLIENT_SECRET_DIGEST_HEX,
    };

    /// Pin the seeded client-secret digests to the real derivation used at
    /// runtime: `token_digest_sha256(secret, key = "cGlwcHVyaQ==")`. This guards
    /// against the regression where the digests were computed with the wrong key
    /// (`pippuri`, the base64-*decoded* value) and could never validate, since
    /// config.rs loads OAUTH_TOKEN_HMAC_KEY raw. Recompute through the real code
    /// path rather than trust an offline HMAC.
    #[test]
    fn seeded_secret_digests_match_dev_hmac_key() {
        let key = SecretString::new(DEV_OAUTH_TOKEN_HMAC_KEY.to_string().into());

        let test_client = token_digest_sha256("very-secret", &key);
        assert_eq!(
            test_client.as_slice(),
            Digest::from_str(TEST_CLIENT_SECRET_DIGEST_HEX)
                .unwrap()
                .as_slice(),
            "Test Client secret digest must be HMAC-SHA-256(cGlwcHVyaQ==, \"very-secret\")"
        );

        let introspection =
            token_digest_sha256("for local development only, intentionally public", &key);
        assert_eq!(
            introspection.as_slice(),
            Digest::from_str(INTROSPECTION_SECRET_DIGEST_HEX)
                .unwrap()
                .as_slice(),
            "introspection secret digest must be HMAC-SHA-256(cGlwcHVyaQ==, <dev secret>)"
        );
    }
}
