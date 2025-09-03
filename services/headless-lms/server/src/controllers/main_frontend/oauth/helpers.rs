use super::authorize_query::AuthorizeParams;
use super::claims::Claims;
use super::hmac_sha256::HmacSha256;
use crate::domain::error::{OAuthErrorCode, OAuthErrorData};
use crate::prelude::*;
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{DateTime, Utc};
use hmac::Mac;
use jsonwebtoken::{EncodingKey, Header, encode};
use models::oauth_shared_types::Digest as TokenDigest;
use rand::distr::SampleString;
use rand::rng;
use rsa::RsaPublicKey;
use rsa::pkcs1::DecodeRsaPublicKey;
use rsa::traits::PublicKeyParts;
use sha2::{Digest as ShaDigest, Sha256};
use url::form_urlencoded;
use uuid::Uuid;

pub fn generate_access_token() -> String {
    const LENGTH: usize = 64;
    rand::distr::Alphanumeric.sample_string(&mut rng(), LENGTH)
}

// Extract (n, e) in base64url and a stable kid
pub fn rsa_n_e_and_kid_from_pem(public_pem: &str) -> anyhow::Result<(String, String, String)> {
    let pubkey: RsaPublicKey = RsaPublicKey::from_pkcs1_pem(public_pem)?;
    let n_b64 = URL_SAFE_NO_PAD.encode(pubkey.n().to_bytes_be());
    let e_b64 = URL_SAFE_NO_PAD.encode(pubkey.e().to_bytes_be());

    // Simple & stable kid: b64url(SHA-256(public_pem))
    let mut hasher = Sha256::new();
    hasher.update(public_pem.as_bytes());
    let kid = URL_SAFE_NO_PAD.encode(hasher.finalize());

    Ok((n_b64, e_b64, kid))
}

pub fn generate_id_token(
    user_id: Uuid,
    client_id: &str,
    nonce: &str,
    expires_at: DateTime<Utc>,
) -> Result<String, ControllerError> {
    let now = Utc::now().timestamp() as usize;
    let exp = expires_at.timestamp() as usize;
    let private_pem = ApplicationConfiguration::try_from_env()?
        .oauth_server_configuration
        .rsa_private_key;
    let claims = Claims {
        sub: user_id.to_string(),
        aud: client_id.to_string(),
        iss: "mooc.fi".to_string(),
        iat: now,
        exp,
        nonce: nonce.to_string(),
    };
    encode(
        &Header::new(jsonwebtoken::Algorithm::RS256),
        &claims,
        &EncodingKey::from_rsa_pem(private_pem.as_bytes())?,
    )
    .map_err(|e| {
        ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                error: OAuthErrorCode::ServerError.as_str().into(),
                error_description: "Failed to generate ID token".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            })),
            "Failed to generate ID token",
            Some(e.into()),
        )
    })
}

#[inline]
pub fn token_digest_hmac_sha256(token_plaintext: &str, pepper: &[u8]) -> TokenDigest {
    let mut mac = HmacSha256::new_from_slice(pepper).expect("valid HMAC key");
    mac.update(token_plaintext.as_bytes());
    let tag = mac.finalize().into_bytes(); // 32 bytes
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&tag);
    TokenDigest::from(arr)
}

pub fn read_token_pepper() -> Result<(Vec<u8>, i16), ControllerError> {
    let pepper = ApplicationConfiguration::try_from_env()?
        .oauth_server_configuration
        .oauth_token_pepper_1
        .into_bytes();
    let pepper_id: i16 = ApplicationConfiguration::try_from_env()?
        .oauth_server_configuration
        .oauth_token_pepper_id;
    Ok((pepper, pepper_id))
}

pub fn oauth_invalid_request(
    desc: &'static str,
    redirect: Option<&str>,
    state: Option<&str>,
) -> ControllerError {
    ControllerError::new(
        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
            error: OAuthErrorCode::InvalidRequest.as_str().into(),
            error_description: desc.into(),
            redirect_uri: redirect.map(str::to_string),
            state: state.map(str::to_string),
            nonce: None,
        })),
        desc,
        None::<anyhow::Error>,
    )
}

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
    // keep original request params visible on the consent page
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

#[cfg(test)]
pub mod tests {
    use super::*;
    use headless_lms_utils::ApplicationConfiguration;

    #[test]
    fn util_print_token_digest_hmac_sha256() -> Result<(), anyhow::Error> {
        let token_plaintext = "very-secret";
        let pepper = ApplicationConfiguration::try_from_env()?
            .oauth_server_configuration
            .oauth_token_pepper_1;
        let digest = token_digest_hmac_sha256(token_plaintext, pepper.as_bytes());
        println!("{}", digest);
        Ok(())
    }
}
