use url::form_urlencoded;

use crate::domain::oauth::authorize_query::AuthorizeParams;

pub fn build_authorize_qs(q: &AuthorizeParams) -> String {
    let mut s = form_urlencoded::Serializer::new(String::new());
    s.append_pair("client_id", &q.client_id);
    s.append_pair("scope", &q.scope);
    s.append_pair("redirect_uri", &q.redirect_uri);
    s.append_pair("response_type", &q.response_type);
    if let Some(state) = q.state.as_deref() {
        s.append_pair("state", state);
    }
    if let Some(nonce) = q.nonce.as_deref() {
        s.append_pair("nonce", nonce);
    }
    if let Some(code_challenge) = q.code_challenge.as_deref() {
        s.append_pair("code_challenge", code_challenge);
    }
    if let Some(code_challenge_method) = q.code_challenge_method.as_deref() {
        s.append_pair("code_challenge_method", code_challenge_method);
    }
    s.finish()
}

pub fn pct_encode(s: &str) -> String {
    form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

pub fn build_login_redirect(q: &AuthorizeParams) -> String {
    let return_to = format!(
        "/api/v0/main-frontend/oauth/authorize?{}",
        build_authorize_qs(q)
    );
    format!("/login?return_to={}", pct_encode(&return_to))
}

pub fn build_consent_redirect(q: &AuthorizeParams, return_to: &str) -> String {
    format!(
        "/oauth_authorize_scopes?{}&return_to={}",
        build_authorize_qs(q),
        pct_encode(return_to)
    )
}

pub fn redirect_with_code(redirect_uri: &str, code: &str, state: Option<&str>) -> String {
    let mut qs = form_urlencoded::Serializer::new(String::new());
    qs.append_pair("code", code);
    if let Some(s) = state {
        qs.append_pair("state", s);
    }
    let qs = qs.finish();
    if redirect_uri.contains('?') {
        format!("{redirect_uri}&{qs}")
    } else {
        format!("{redirect_uri}?{qs}")
    }
}
