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
/// `kubernetes/{dev,test}/headless-lms/env.yml` are `kind: Secret` manifests, so Kubernetes
/// base64-decodes each `data:` value before injecting it: `OAUTH_TOKEN_HMAC_KEY: cGlwcHVyaQ==`
/// reaches the process as `pippuri`. Seeded digests must be
/// `HMAC-SHA-256(key = "pippuri", <secret>)` or client-secret validation can never match.
#[cfg_attr(not(test), allow(dead_code))]
const DEV_OAUTH_TOKEN_HMAC_KEY: &str = "pippuri";

/// Digest of the shared "Test Client" family secret (plaintext `very-secret`),
/// derived under [`DEV_OAUTH_TOKEN_HMAC_KEY`].
const TEST_CLIENT_SECRET_DIGEST_HEX: &str =
    "396b544a35b29f7d613452a165dcaebf4d71b80e981e687e91ce6d9ba9679cb2";

/// Digest of the `tmc-server-introspection-dev` client secret (plaintext
/// `for local development only, intentionally public`), derived under
/// [`DEV_OAUTH_TOKEN_HMAC_KEY`].
const INTROSPECTION_SECRET_DIGEST_HEX: &str =
    "aca61813af4f1b77f72cc2db856aa9ff4ea4080c188359b1edc51393c824abd5";

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

    // Device-flow clients, dev/CI only; prod clients are provisioned by an operator.

    // tmc-vscode: public native client for the RFC 8628 device-flow login. Same id and shape
    // as prod (public clients have no secret to seed).
    let device_grant_types = vec![GrantTypeName::DeviceCode, GrantTypeName::RefreshToken];
    let device_redirect_uris = vec!["urn:ietf:wg:oauth:2.0:oob".to_string()];
    let exercise_services_scopes = vec!["exercise-services".to_string()];
    let tmc_vscode_params = oauth_client::NewClientParams {
        client_id: "tmc-vscode",
        client_name: "TMC VSCode extension",
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
    if oauth_client::OAuthClient::find_by_client_id_optional(&mut conn, "tmc-vscode")
        .await?
        .is_none()
    {
        oauth_client::OAuthClient::insert(&mut conn, tmc_vscode_params).await?;
    }

    // tmc-server-introspection-dev: confidential client tmc-server uses to introspect our
    // tokens locally. Id and secret must match tmc-server's config/secrets.yml dev defaults,
    // and intentionally differ from prod.
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

    // tmc-vscode-noscope-test: a device-flow client whose scopes exclude exercise-services, so
    // tests can drive the scope gate (403) without borrowing the shared test client or another
    // spec's user. Not provisioned in prod.
    let noscope_grant_types = vec![GrantTypeName::DeviceCode];
    let openid_scopes = vec!["openid".to_string()];
    let noscope_params = oauth_client::NewClientParams {
        client_id: "tmc-vscode-noscope-test",
        client_name: "TMC VSCode device client without exercise-services (test)",
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
    if oauth_client::OAuthClient::find_by_client_id_optional(&mut conn, "tmc-vscode-noscope-test")
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
    use std::{fs, path::Path, str::FromStr};

    use base64::{Engine, prelude::BASE64_STANDARD};
    use headless_lms_models::library::oauth::{Digest, token_digest_sha256};
    use secrecy::SecretString;

    use super::{
        DEV_OAUTH_TOKEN_HMAC_KEY, INTROSPECTION_SECRET_DIGEST_HEX, TEST_CLIENT_SECRET_DIGEST_HEX,
    };

    /// The dev/CI env manifests whose `OAUTH_TOKEN_HMAC_KEY` the seeded digests must agree with,
    /// relative to this crate's manifest directory.
    const DEV_ENV_MANIFESTS: [&str; 2] = [
        "../../../kubernetes/dev/headless-lms/env.yml",
        "../../../kubernetes/test/headless-lms/env.yml",
    ];

    /// Reads `OAUTH_TOKEN_HMAC_KEY` out of a `kind: Secret` manifest the way Kubernetes does:
    /// the `data:` values are base64, and the *decoded* bytes are what lands in the environment.
    ///
    /// Deliberately not a generic YAML parse; the point is to mimic that one decoding step.
    fn hmac_key_from_manifest(relative_path: &str) -> String {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(relative_path);
        let manifest = fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("failed to read {}: {e}", path.display()));

        assert!(
            manifest.contains("kind: Secret"),
            "{} is expected to be a kind: Secret manifest; if it became a ConfigMap the values are \
             no longer base64-decoded and this test (and the seeded digests) must change",
            path.display()
        );
        assert!(
            manifest.contains("\ndata:"),
            "{} is expected to use a base64 `data:` block, not `stringData:`; if that changed the \
             seeded digests must be recomputed under the raw value",
            path.display()
        );

        let encoded = manifest
            .lines()
            .find_map(|line| line.trim().strip_prefix("OAUTH_TOKEN_HMAC_KEY:"))
            .unwrap_or_else(|| panic!("OAUTH_TOKEN_HMAC_KEY not found in {}", path.display()))
            .trim()
            .trim_matches('"')
            .to_string();

        let decoded = BASE64_STANDARD
            .decode(encoded.as_bytes())
            .unwrap_or_else(|e| {
                panic!(
                    "OAUTH_TOKEN_HMAC_KEY in {} is not valid base64, but a `data:` value must \
                     be: {e}",
                    path.display()
                )
            });
        String::from_utf8(decoded).expect("OAUTH_TOKEN_HMAC_KEY must decode to UTF-8")
    }

    /// Pin [`DEV_OAUTH_TOKEN_HMAC_KEY`] to the value the deployed dev/CI process actually
    /// receives. Without this, a key mismatch shows up only as `invalid_client` from every
    /// confidential-client authentication in CI, while the offline-HMAC unit test stays green.
    #[test]
    fn dev_hmac_key_matches_kubernetes_env_manifests() {
        for manifest in DEV_ENV_MANIFESTS {
            assert_eq!(
                hmac_key_from_manifest(manifest),
                DEV_OAUTH_TOKEN_HMAC_KEY,
                "DEV_OAUTH_TOKEN_HMAC_KEY must equal the base64-decoded OAUTH_TOKEN_HMAC_KEY from \
                 {manifest}, since that decoded value is what Kubernetes puts in the environment \
                 and what config.rs then reads"
            );
        }
    }

    /// Pin the seeded digests to the derivation used at runtime,
    /// `token_digest_sha256(secret, key = DEV_OAUTH_TOKEN_HMAC_KEY)`, recomputed through the real
    /// code path rather than an offline HMAC. Digests derived under any other key can never
    /// validate, and the token endpoint then rejects the client with `invalid_client`.
    #[test]
    fn seeded_secret_digests_match_dev_hmac_key() {
        let key = SecretString::new(DEV_OAUTH_TOKEN_HMAC_KEY.to_string().into());

        let test_client = token_digest_sha256("very-secret", &key);
        assert_eq!(
            test_client.as_slice(),
            Digest::from_str(TEST_CLIENT_SECRET_DIGEST_HEX)
                .unwrap()
                .as_slice(),
            "Test Client secret digest must be HMAC-SHA-256(DEV_OAUTH_TOKEN_HMAC_KEY, \
             \"very-secret\")"
        );

        let introspection =
            token_digest_sha256("for local development only, intentionally public", &key);
        assert_eq!(
            introspection.as_slice(),
            Digest::from_str(INTROSPECTION_SECRET_DIGEST_HEX)
                .unwrap()
                .as_slice(),
            "introspection secret digest must be HMAC-SHA-256(DEV_OAUTH_TOKEN_HMAC_KEY, \
             <dev secret>)"
        );
    }
}
