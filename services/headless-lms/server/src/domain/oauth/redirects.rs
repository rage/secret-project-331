use headless_lms_models::oauth_client::OAuthClient;
use url::{Url, form_urlencoded};

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
    if let Some(resource) = &q.resource {
        s.append_pair("resource", resource.as_str());
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

/// Adds the issuer as `iss` to a redirect back to the client, so it can detect mix-up attacks
/// (RFC 9207).
fn append_iss<T: form_urlencoded::Target>(
    pairs: &mut form_urlencoded::Serializer<'_, T>,
    issuer: &str,
) {
    pairs.append_pair("iss", issuer);
}

/// The client redirect carrying the authorization code and `iss`.
pub fn redirect_with_code(
    redirect_uri: &str,
    code: &str,
    state: Option<&str>,
    issuer: &str,
) -> String {
    let mut qs = form_urlencoded::Serializer::new(String::new());
    qs.append_pair("code", code);
    if let Some(s) = state {
        qs.append_pair("state", s);
    }
    append_iss(&mut qs, issuer);
    let qs = qs.finish();
    if redirect_uri.contains('?') {
        format!("{redirect_uri}&{qs}")
    } else {
        format!("{redirect_uri}?{qs}")
    }
}

/// The client redirect carrying an authorization error (RFC 6749 §4.1.2.1), and `iss` when
/// `issuer` is given. `None` if `redirect_uri` is not a URL.
pub fn error_redirect_url(
    redirect_uri: &str,
    error: &str,
    description: Option<&str>,
    state: Option<&str>,
    issuer: Option<&str>,
) -> Option<String> {
    let mut url = Url::parse(redirect_uri).ok()?;
    {
        let mut pairs = url.query_pairs_mut();
        pairs.append_pair("error", error);
        if let Some(description) = description {
            pairs.append_pair("error_description", description);
        }
        if let Some(state) = state {
            pairs.append_pair("state", state);
        }
        if let Some(issuer) = issuer {
            append_iss(&mut pairs, issuer);
        }
    }
    Some(url.to_string())
}

/// Whether `requested` is one of the client's registered redirect URIs. A public client's loopback
/// redirect URI matches on any port, because native apps listen on whatever port is free
/// (RFC 8252 §7.3), but never with a fragment or credentials; a confidential client's matches
/// only exactly.
pub fn redirect_uri_matches(client: &OAuthClient, requested: &str) -> bool {
    let registered = &client.redirect_uris;
    if registered.iter().any(|r| r == requested) {
        return true;
    }
    if !client.is_public() {
        return false;
    }
    let Ok(requested_url) = Url::parse(requested) else {
        return false;
    };
    if requested_url.scheme() != "http"
        || !is_loopback_host(&requested_url)
        || requested_url.fragment().is_some()
        || !requested_url.username().is_empty()
        || requested_url.password().is_some()
    {
        return false;
    }
    registered.iter().any(|r| {
        Url::parse(r).is_ok_and(|registered_url| {
            registered_url.scheme() == "http"
                && registered_url.host() == requested_url.host()
                && registered_url.path() == requested_url.path()
                && registered_url.query() == requested_url.query()
        })
    })
}

/// Whether the URL's host is a loopback address or `localhost`.
pub fn is_loopback_host(url: &Url) -> bool {
    match url.host() {
        Some(url::Host::Domain(domain)) => domain.eq_ignore_ascii_case("localhost"),
        Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
        Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
        None => false,
    }
}
