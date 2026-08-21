use crate::domain::error::{OAuthErrorCode, OAuthErrorData};
use crate::prelude::*;
use models::{library::oauth::token_digest_sha256, oauth_client::OAuthClient};
use secrecy::{ExposeSecret, SecretString};

pub fn oauth_error(
    error: &'static str,
    desc: &'static str,
    redirect: Option<&str>,
    state: Option<&str>,
) -> ControllerError {
    ControllerError::new(
        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
            error: error.into(),
            error_description: desc.into(),
            redirect_uri: redirect.map(str::to_string),
            state: state.map(str::to_string),
            nonce: None,
        })),
        desc,
        None::<anyhow::Error>,
    )
}

pub fn oauth_invalid_request(
    desc: &'static str,
    redirect: Option<&str>,
    state: Option<&str>,
) -> ControllerError {
    oauth_error(
        OAuthErrorCode::InvalidRequest.as_str(),
        desc,
        redirect,
        state,
    )
}

pub fn oauth_invalid_client(desc: &'static str) -> ControllerError {
    oauth_error(OAuthErrorCode::InvalidClient.as_str(), desc, None, None)
}

pub fn oauth_invalid_scope(desc: &'static str) -> ControllerError {
    oauth_error(OAuthErrorCode::InvalidScope.as_str(), desc, None, None)
}

pub fn oauth_unauthorized_client(desc: &'static str) -> ControllerError {
    oauth_error(
        OAuthErrorCode::UnauthorizedClient.as_str(),
        desc,
        None,
        None,
    )
}

pub fn oauth_invalid_grant(desc: &'static str) -> ControllerError {
    oauth_error(OAuthErrorCode::InvalidGrant.as_str(), desc, None, None)
}

pub fn scope_has_openid(scope: &[String]) -> bool {
    scope.iter().any(|s| s == "openid")
}

/// Splits a space-delimited `scope` string and checks every element against `allowed`.
///
/// Returns the parsed scopes, or the first requested scope not present in `allowed`.
/// Callers decide how to map an absent/empty request and how to report a rejection.
pub fn split_and_validate_scopes(
    requested: &str,
    allowed: &[String],
) -> Result<Vec<String>, String> {
    let scopes: Vec<String> = requested
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();
    for scope in &scopes {
        if !allowed.contains(scope) {
            return Err(scope.clone());
        }
    }
    Ok(scopes)
}

pub fn ok_json_no_cache<T: Serialize>(value: T) -> HttpResponse {
    let mut resp = HttpResponse::Ok();
    resp.insert_header(("Cache-Control", "no-store"));
    resp.insert_header(("Pragma", "no-cache"));
    resp.json(value)
}

/// Why a client failed to authenticate against its `client_id`/`client_secret`.
pub enum ClientAuthError {
    UnknownClient,
    ClientSecretMissing,
    ClientSecretMismatch,
}

/// Looks up a client by `client_id` and, if it is confidential, verifies `provided_secret`
/// against its stored digest with a constant-time comparison.
///
/// A public client is returned without any secret check: callers that must reject public
/// clients outright (e.g. introspection) do so themselves once this returns.
pub async fn authenticate_oauth_client(
    conn: &mut PgConnection,
    client_id: &str,
    provided_secret: Option<&SecretString>,
    token_hmac_key: &SecretString,
) -> Result<OAuthClient, ClientAuthError> {
    let client = OAuthClient::find_by_client_id(conn, client_id)
        .await
        .map_err(|e| {
            tracing::error!(err = %e, "OAuth: unknown client_id");
            ClientAuthError::UnknownClient
        })?;

    if !client.is_confidential() {
        return Ok(client);
    }

    let Some(secret) = &client.client_secret else {
        return Err(ClientAuthError::ClientSecretMissing);
    };
    let provided = token_digest_sha256(
        provided_secret
            .map(|s| s.expose_secret())
            .unwrap_or_default(),
        token_hmac_key,
    );
    if !secret.constant_eq(&provided) {
        return Err(ClientAuthError::ClientSecretMismatch);
    }

    Ok(client)
}
