use crate::domain::error::{OAuthErrorCode, OAuthErrorData};
use crate::prelude::*;

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

pub fn oauth_invalid_grant(desc: &'static str) -> ControllerError {
    oauth_error(OAuthErrorCode::InvalidGrant.as_str(), desc, None, None)
}

pub fn scope_has_openid(scope: &[String]) -> bool {
    scope.iter().any(|s| s == "openid")
}

pub fn ok_json_no_cache<T: Serialize>(value: T) -> HttpResponse {
    let mut resp = HttpResponse::Ok();
    resp.insert_header(("Cache-Control", "no-store"));
    resp.insert_header(("Pragma", "no-cache"));
    resp.json(value)
}
