//! Startup check of the OAuth client the TestMyCode editor extension logs in with. Production
//! provisions it by hand (see `docs/exercise-services-client.md`), so nothing else catches drift.

use headless_lms_models::{
    library::oauth::GrantTypeName,
    oauth_client::{ApplicationType, OAuthClient, TokenEndpointAuthMethod},
};
use sqlx::PgConnection;

/// The client id the extension and tmc-langs hard-code.
pub const NATIVE_EDITOR_CLIENT_ID: &str = "tmc-vscode";

/// How the stored client differs from the shape device-flow login needs; empty when it matches.
pub fn native_editor_client_problems(client: Option<&OAuthClient>) -> Vec<String> {
    let Some(client) = client else {
        return vec![format!(
            "OAuth client {NATIVE_EDITOR_CLIENT_ID} does not exist, so the editor extension cannot log in"
        )];
    };
    let mut problems = Vec::new();
    if client.application_type != ApplicationType::Native {
        problems.push("application_type is not native".to_string());
    }
    if client.token_endpoint_auth_method != TokenEndpointAuthMethod::None
        || client.client_secret.is_some()
    {
        problems.push(
            "it is not a public client (token_endpoint_auth_method none, no secret)".to_string(),
        );
    }
    for grant in [GrantTypeName::DeviceCode, GrantTypeName::RefreshToken] {
        if !client.allowed_grant_types.contains(&grant) {
            problems.push(format!("allowed_grant_types lacks {grant:?}"));
        }
    }
    if !client
        .scopes
        .iter()
        .any(|scope| scope == "exercise-services")
    {
        problems.push("scopes lack exercise-services".to_string());
    }
    if !client.require_pkce {
        problems.push("require_pkce is off".to_string());
    }
    if !client.bearer_allowed {
        problems.push("bearer_allowed is off, so its tokens are refused as bearers".to_string());
    }
    problems
        .into_iter()
        .map(|problem| format!("OAuth client {NATIVE_EDITOR_CLIENT_ID}: {problem}"))
        .collect()
}

/// Logs a warning for each way the editor extension's OAuth client is missing or misconfigured.
pub async fn warn_about_native_editor_client(conn: &mut PgConnection) {
    match OAuthClient::find_by_client_id_optional(conn, NATIVE_EDITOR_CLIENT_ID).await {
        Ok(client) => {
            for problem in native_editor_client_problems(client.as_ref()) {
                tracing::warn!("{problem}");
            }
        }
        Err(err) => tracing::warn!("Could not check OAuth client {NATIVE_EDITOR_CLIENT_ID}: {err}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;
    use headless_lms_models::library::oauth::pkce::PkceMethod;
    use headless_lms_models::oauth_client::NewClientParams;

    #[test]
    fn a_missing_client_is_reported() {
        assert_eq!(native_editor_client_problems(None).len(), 1);
    }

    #[actix_web::test]
    async fn a_client_of_the_documented_shape_has_no_problems() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let client_id = format!("native-check-{}", uuid::Uuid::new_v4());
        let grants = [GrantTypeName::DeviceCode, GrantTypeName::RefreshToken];
        let scopes = ["exercise-services".to_string()];
        let redirect_uris = ["urn:ietf:wg:oauth:2.0:oob".to_string()];
        let client = OAuthClient::insert(
            tx.as_mut(),
            NewClientParams {
                client_id: &client_id,
                client_name: "native check",
                application_type: ApplicationType::Native,
                token_endpoint_auth_method: TokenEndpointAuthMethod::None,
                client_secret: None,
                client_secret_expires_at: None,
                redirect_uris: &redirect_uris,
                post_logout_redirect_uris: None,
                allowed_grant_types: &grants,
                scopes: &scopes,
                require_pkce: true,
                pkce_methods_allowed: &[PkceMethod::S256],
                allowed_origins: None,
                bearer_allowed: true,
            },
        )
        .await
        .unwrap();
        assert!(native_editor_client_problems(Some(&client)).is_empty());
        tx.rollback().await;
    }
}
