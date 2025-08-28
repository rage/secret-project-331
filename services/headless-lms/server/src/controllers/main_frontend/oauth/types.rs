use crate::prelude::*;
use actix_web::{FromRequest, HttpRequest, dev::Payload, web};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::Utc;
use domain::error::{OAuthErrorCode, OAuthErrorData};
use futures_util::future::LocalBoxFuture;
use headless_lms_models::oauth_dpop_proofs::OAuthDpopProof;
use headless_lms_models::oauth_shared_types::Digest as TokenDigest;
use hmac::Hmac;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use p256::PublicKey;
use p256::pkcs8::EncodePublicKey;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::Digest as ShaDigest;
use sha2::Sha256;
use sqlx::PgConnection;
use std::collections::BTreeMap;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use url::Url;
use uuid::Uuid;
pub trait ExtractFallback: Default + for<'de> Deserialize<'de> {}
impl<T> ExtractFallback for T where T: Default + for<'de> Deserialize<'de> {}

type AsyncPin<'a, O> = Pin<Box<dyn Future<Output = O> + 'a>>;

#[derive(Debug)]
pub struct SafeExtractor<T>(pub T);

impl<T> SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    pub fn from_form<'a>(req: &'a HttpRequest, payload: &'a mut Payload) -> AsyncPin<'a, Self> {
        Box::pin(async move {
            match web::Form::<T>::from_request(req, payload).await {
                Ok(form) => SafeExtractor(form.into_inner()),
                Err(_) => SafeExtractor(T::default()),
            }
        })
    }
}

impl<T> FromRequest for SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    type Error = actix_web::Error;
    type Future = LocalBoxFuture<'static, Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, payload: &mut Payload) -> Self::Future {
        let mut payload = payload.take(); // take ownership of payload
        let req = req.clone();

        Box::pin(async move {
            match *req.method() {
                actix_web::http::Method::GET | actix_web::http::Method::DELETE => {
                    match actix_web::web::Query::<T>::from_query(req.query_string()) {
                        Ok(q) => Ok(SafeExtractor(q.into_inner())),
                        Err(_) => Ok(SafeExtractor(T::default())),
                    }
                }
                _ => match actix_web::web::Form::<T>::from_request(&req, &mut payload).await {
                    Ok(f) => Ok(SafeExtractor(f.into_inner())),
                    Err(_) => Ok(SafeExtractor(T::default())),
                },
            }
        })
    }
}

impl<T> SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    pub fn extract<'a>(req: &'a HttpRequest, payload: &'a mut Payload) -> AsyncPin<'a, Self> {
        Box::pin(async move {
            match *req.method() {
                actix_web::http::Method::GET | actix_web::http::Method::DELETE => {
                    match web::Query::<T>::from_query(req.query_string()) {
                        Ok(query) => SafeExtractor(query.into_inner()),
                        Err(_) => SafeExtractor(T::default()),
                    }
                }
                _ => match web::Form::<T>::from_request(req, payload).await {
                    Ok(form) => SafeExtractor(form.into_inner()),
                    Err(_) => SafeExtractor(T::default()),
                },
            }
        })
    }
}

pub trait OAuthValidate {
    fn validate(&self) -> Result<(), ControllerError>;
}
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default)]
pub struct AuthorizeQuery {
    pub response_type: Option<String>,
    pub client_id: Option<String>,
    pub redirect_uri: Option<String>,
    pub scope: Option<String>,
    pub state: Option<String>,
    pub nonce: Option<String>,

    // OAuth2.0 spec requires that auth does not fail when there are unknown parameters present,
    // see RFC 6749 3.1
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

// We need to make sure we don't return errors directly, instead we need to return
// error as success request with error parameters to comply with OAuth.
impl OAuthValidate for AuthorizeQuery {
    fn validate(&self) -> Result<(), ControllerError> {
        let rt = self.response_type.as_deref().unwrap_or_default();
        let client_id = self.client_id.as_deref().unwrap_or_default();
        let redirect_uri = self.redirect_uri.as_deref().unwrap_or_default();
        let scope = self.scope.as_deref().unwrap_or_default();
        let state = self.state.as_deref().unwrap_or_default();

        if client_id.is_empty() || redirect_uri.is_empty() || scope.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidRequest.as_str().into(),
                    error_description: "client_id, redirect_uri, and scope are required".into(),
                    redirect_uri: None,
                    state: Some(state.to_string()),
                })),
                "Missing required OAuth parameters",
                None::<anyhow::Error>,
            ));
        }
        info!("rt={}", rt);
        if rt != "code" {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::UnsupportedResponseType.as_str().into(),
                    error_description: "unsupported response_type".into(),
                    redirect_uri: None, // include later only after client+URI validation
                    state: Some(state.to_string()),
                })),
                "Unsupported response_type",
                None::<anyhow::Error>,
            ));
        }

        Ok(())
    }
}

impl OAuthValidate for TokenQuery {
    fn validate(&self) -> Result<(), ControllerError> {
        let client_id = self.client_id.as_deref().unwrap_or_default();
        let client_secret = self.client_secret.as_deref().unwrap_or_default();

        if client_id.is_empty() || client_secret.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidClient.as_str().into(),
                    error_description: "client_id and client_secret are required".into(),
                    redirect_uri: None,
                    state: None,
                })),
                "Missing client credentials",
                None::<anyhow::Error>,
            ));
        }

        match &self.grant {
            Some(GrantType::AuthorizationCode { code, redirect_uri }) => {
                if code.is_empty() || redirect_uri.is_empty() {
                    return Err(ControllerError::new(
                        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                            error: OAuthErrorCode::InvalidRequest.as_str().into(),
                            error_description:
                                "code and redirect_uri are required for authorization_code grant"
                                    .into(),
                            redirect_uri: None,
                            state: None,
                        })),
                        "Missing authorization code parameters",
                        None::<anyhow::Error>,
                    ));
                }
            }
            Some(GrantType::RefreshToken { refresh_token }) => {
                if refresh_token.is_empty() {
                    return Err(ControllerError::new(
                        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                            error: OAuthErrorCode::InvalidRequest.as_str().into(),
                            error_description: "refresh_token is required".into(),
                            redirect_uri: None,
                            state: None,
                        })),
                        "Missing refresh token",
                        None::<anyhow::Error>,
                    ));
                }
            }
            None => {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::UnsupportedGrantType.as_str().into(),
                        error_description: "grant_type is required".into(),
                        redirect_uri: None,
                        state: None,
                    })),
                    "Missing grant type",
                    None::<anyhow::Error>,
                ));
            }
        }

        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default)]
pub struct TokenQuery {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    #[serde(flatten)]
    pub grant: Option<GrantType>,
    // OAuth2.0 spec requires that token does not fail when there are unknown parameters present,
    // see RFC 6749 3.2
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(tag = "grant_type")]
pub enum GrantType {
    #[serde(rename = "authorization_code")]
    AuthorizationCode { code: String, redirect_uri: String },
    #[serde(rename = "refresh_token")]
    RefreshToken { refresh_token: String },
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_in: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Claims {
    pub sub: String,
    pub aud: String,
    pub iss: String,
    pub iat: usize,
    pub exp: usize,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentQuery {
    pub client_id: String,
    pub redirect_uri: String,
    pub response_type: String,
    pub scopes: String,
    pub state: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentDenyQuery {
    pub redirect_uri: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct UserInfoResponse {
    pub sub: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

#[derive(serde::Serialize)]
pub struct Jwk {
    pub kty: String,
    #[serde(rename = "use")]
    pub use_: String,
    pub alg: String,
    pub kid: String,
    pub n: String,
    pub e: String,
}

#[derive(serde::Serialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::error::{ControllerError, ControllerErrorType, OAuthErrorCode};
    use serde_json::{Value, json};

    fn assert_oauth_error(
        result: Result<(), ControllerError>,
        expected_error: OAuthErrorCode,
        expected_description: &str,
    ) {
        match result {
            Err(err) => match err.error_type() {
                ControllerErrorType::OAuthError(data) => {
                    assert_eq!(data.error, expected_error.as_str());
                    assert_eq!(data.error_description, expected_description);
                }
                other => panic!("Expected OAuthError, got {:?}", other),
            },
            Ok(()) => panic!("Expected Err, got Ok(())"),
        }
    }

    // ---------------- AuthorizeQuery ----------------

    #[test]
    fn authorize_missing_fields() {
        let q = AuthorizeQuery {
            response_type: Some("code".into()),
            client_id: None,
            redirect_uri: None,
            scope: None,
            state: Some("xyz".into()),
            nonce: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "client_id, redirect_uri, and scope are required",
        );
    }

    #[test]
    fn authorize_unsupported_response_type() {
        let q = AuthorizeQuery {
            response_type: Some("token".into()),
            client_id: Some("cid".into()),
            redirect_uri: Some("http://localhost".into()),
            scope: Some("openid".into()),
            state: None,
            nonce: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::UnsupportedResponseType,
            "unsupported response_type",
        );
    }

    #[test]
    fn authorize_valid_code_flow_openid_without_nonce_is_ok() {
        // For pure code flow, nonce is not required by OIDC core.
        let q = AuthorizeQuery {
            response_type: Some("code".into()),
            client_id: Some("cid".into()),
            redirect_uri: Some("http://localhost".into()),
            scope: Some("openid profile".into()),
            state: Some("s".into()),
            nonce: None,
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn authorize_unknown_params_are_captured_in_extra() {
        let v: Value = json!({
            "response_type": "code",
            "client_id": "cid",
            "redirect_uri": "http://localhost",
            "scope": "openid",
            "state": "s",
            "foo": "bar",
            "x": "y"
        });
        let q: AuthorizeQuery = serde_json::from_value(v).unwrap();
        assert_eq!(q._extra.get("foo").map(String::as_str), Some("bar"));
        assert_eq!(q._extra.get("x").map(String::as_str), Some("y"));
        assert!(q.validate().is_ok());
    }

    // ---------------- TokenQuery ----------------

    #[test]
    fn token_missing_client_credentials() {
        let q = TokenQuery {
            client_id: None,
            client_secret: None,
            grant: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidClient,
            "client_id and client_secret are required",
        );
    }

    #[test]
    fn token_missing_grant_type() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::UnsupportedGrantType,
            "grant_type is required",
        );
    }

    #[test]
    fn token_auth_code_missing_fields() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(GrantType::AuthorizationCode {
                code: "".into(),
                redirect_uri: "".into(),
            }),
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "code and redirect_uri are required for authorization_code grant",
        );
    }

    #[test]
    fn token_refresh_missing_field() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(GrantType::RefreshToken {
                refresh_token: "".into(),
            }),
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "refresh_token is required",
        );
    }

    #[test]
    fn token_valid_auth_code() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(GrantType::AuthorizationCode {
                code: "abc".into(),
                redirect_uri: "http://localhost".into(),
            }),
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_valid_refresh_token() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(GrantType::RefreshToken {
                refresh_token: "r1".into(),
            }),
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_unknown_params_are_captured_in_extra() {
        let v: Value = json!({
            "client_id": "cid",
            "client_secret": "sec",
            "grant_type": "refresh_token",
            "refresh_token": "rt",
            "extra_param": "zzz"
        });
        let q: TokenQuery = serde_json::from_value(v).unwrap();
        assert_eq!(q._extra.get("extra_param").map(String::as_str), Some("zzz"));
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_grant_tagging_deserializes_properly() {
        // authorization_code branch
        let ac: TokenQuery = serde_json::from_value(json!({
            "client_id": "cid",
            "client_secret": "sec",
            "grant_type": "authorization_code",
            "code": "C",
            "redirect_uri": "http://localhost"
        }))
        .unwrap();
        match ac.grant {
            Some(GrantType::AuthorizationCode { code, redirect_uri }) => {
                assert_eq!(code, "C");
                assert_eq!(redirect_uri, "http://localhost");
            }
            _ => panic!("expected AuthorizationCode"),
        }

        // refresh_token branch
        let rt: TokenQuery = serde_json::from_value(json!({
            "client_id": "cid",
            "client_secret": "sec",
            "grant_type": "refresh_token",
            "refresh_token": "R"
        }))
        .unwrap();
        match rt.grant {
            Some(GrantType::RefreshToken { refresh_token }) => {
                assert_eq!(refresh_token, "R");
            }
            _ => panic!("expected RefreshToken"),
        }
    }
}

// ---------- Token hashing / pepper helpers ----------

pub type HmacSha256 = Hmac<Sha256>;

// TODO move to own file

// ----- Claims and header bits we need -----

#[derive(Deserialize)]
pub struct DpopClaims {
    htm: String,         // HTTP method
    htu: String,         // absolute URI
    iat: i64,            // issued-at (seconds)
    jti: String,         // nonce (replay protection)
    ath: Option<String>, // access token hash (required at resource endpoints)
}

#[derive(Deserialize)]
pub struct RawHeader {
    jwk: Option<Value>,
}

#[derive(serde::Deserialize)]
struct DpopHeader {
    typ: String,
    alg: String,
    jwk: DpopJwk,
}

#[derive(serde::Deserialize)]
struct DpopJwk {
    kty: String,
    crv: String,
    x: String,
    y: String,
}

// ----- EC JWK {x,y} -> DecodingKey (SPKI DER) -----

fn ec_decoding_key_from_xy_b64url(
    x_b64: &str,
    y_b64: &str,
) -> Result<DecodingKey, ControllerError> {
    // Decode base64url x and y
    let x = URL_SAFE_NO_PAD.decode(x_b64)?;
    let y = URL_SAFE_NO_PAD.decode(y_b64)?;
    if x.len() != 32 || y.len() != 32 {
        return Err(anyhow::anyhow!("invalid P-256 point size").into());
    }

    // Build uncompressed SEC1: 0x04 || X(32) || Y(32)
    let mut sec1 = [0u8; 65];
    sec1[0] = 0x04;
    sec1[1..33].copy_from_slice(&x);
    sec1[33..65].copy_from_slice(&y);

    // Parse and convert to SPKI DER
    let pk = PublicKey::from_sec1_bytes(&sec1)
        .map_err(|e| anyhow::anyhow!("invalid P-256 public key: {e}"))?;
    let spki_der = pk.to_public_key_der()?; // SubjectPublicKeyInfo (DER)

    // JSON Web Token verifier key
    Ok(DecodingKey::from_ec_der(spki_der.as_bytes()))
}

// ----- RFC 7638 thumbprints -----

pub fn jwk_thumbprint_ec_p256(x_b64: &str, y_b64: &str) -> Result<String, ControllerError> {
    let mut m = BTreeMap::new();
    m.insert("crv", "P-256");
    m.insert("kty", "EC");
    m.insert("x", x_b64);
    m.insert("y", y_b64);
    let canonical = serde_json::to_string(&m)?;
    Ok(URL_SAFE_NO_PAD.encode(Sha256::digest(canonical.as_bytes())))
}

pub fn jwk_thumbprint_rsa(n_b64: &str, e_b64: &str) -> Result<String, ControllerError> {
    let mut m = BTreeMap::new();
    m.insert("e", e_b64);
    m.insert("kty", "RSA");
    m.insert("n", n_b64);
    let canonical = serde_json::to_string(&m)?;
    Ok(URL_SAFE_NO_PAD.encode(Sha256::digest(canonical.as_bytes())))
}

// ----- Absolute URI builder for htu -----

pub fn expected_request_uri(req: &actix_web::HttpRequest) -> String {
    let ci = req.connection_info();
    let scheme = ci.scheme();
    let host = ci.host();
    let path_q = req.uri().to_string(); // path + query
    format!("{scheme}://{host}{path_q}")
}

// ----- Replay prevention -----

pub async fn dpop_replay_check_and_store(
    conn: &mut PgConnection,
    jti: &str,
    iat: i64,
    client_id: Option<Uuid>,
    jkt: Option<&str>,
    htm: Option<&str>,
    htu: Option<&str>,
) -> Result<(), ControllerError> {
    // 1) Basic staleness check (recommended)
    let now = Utc::now().timestamp();
    const ALLOWED_SKEW: i64 = 300; // 5 minutes
    if iat < now - ALLOWED_SKEW || iat > now + ALLOWED_SKEW {
        return Err(ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                error: OAuthErrorCode::InvalidToken.as_str().into(),
                error_description: "DPoP proof 'iat' outside acceptable window".into(),
                redirect_uri: None,
                state: None,
            })),
            "stale or future DPoP iat",
            None::<anyhow::Error>,
        ));
    }

    // 2) SHA-256(jti) -> Digest([u8;32])
    let mut hasher = Sha256::new();
    hasher.update(jti.as_bytes());
    let hash = hasher.finalize();
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&hash);
    let jti_hash: TokenDigest = TokenDigest::from(arr);

    // 3) Insert once; if already seen => replay
    let first_time =
        OAuthDpopProof::insert_once(conn, jti_hash, client_id, jkt, htm, htu, Some(iat)).await?;

    if !first_time {
        return Err(ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                error: OAuthErrorCode::InvalidToken.as_str().into(),
                error_description: "DPoP proof replay detected".into(),
                redirect_uri: None,
                state: None,
            })),
            "DPoP proof replay",
            None::<anyhow::Error>,
        ));
    }

    Ok(())
}

use p256::ecdsa::{Signature, VerifyingKey, signature::Verifier};
use p256::elliptic_curve::sec1::FromEncodedPoint as _;
use p256::{EncodedPoint, FieldBytes};

/// Verify the DPoP proof in the request and return the JWK thumbprint (jkt).
/// Performs:
///  - Header presence and JWT structure checks
///  - JOSE header checks: typ=dpop+jwt, alg=ES256, jwk=EC P-256 (pub only)
///  - Signature verification with the provided JWK
///  - Claim checks: jti, iat freshness, htm, htu (canonicalized), optional ath
///  - **Replay prevention**: stores hashed jti and rejects re-use
pub async fn verify_dpop_and_get_jkt(
    conn: &mut PgConnection,
    req: &actix_web::HttpRequest,
    expected_method: &str,
    maybe_access_token: Option<&str>,
    maybe_client_id: Option<Uuid>,
) -> Result<String, ControllerError> {
    // 1) Extract header
    let dpop = req
        .headers()
        .get("DPoP")
        .ok_or_else(|| dpop_bad_request("missing DPoP header"))?
        .to_str()
        .map_err(|_| dpop_bad_request("invalid DPoP header"))?;

    // 2) Split JWT
    let mut parts = dpop.split('.');
    let (h_b64, p_b64, s_b64) = match (parts.next(), parts.next(), parts.next()) {
        (Some(h), Some(p), Some(s)) if parts.next().is_none() => (h, p, s),
        _ => return Err(dpop_bad_request("malformed DPoP JWT")),
    };

    // 3) Parse JOSE header
    let hdr_bytes = URL_SAFE_NO_PAD
        .decode(h_b64)
        .map_err(|_| dpop_bad_request("bad DPoP header b64"))?;
    let hdr: DpopHeader =
        serde_json::from_slice(&hdr_bytes).map_err(|_| dpop_bad_request("bad DPoP header JSON"))?;

    if hdr.typ != "dpop+jwt" {
        return Err(dpop_bad_request("typ must be dpop+jwt"));
    }
    if hdr.alg.as_str() != "ES256" {
        return Err(dpop_bad_request(
            "unsupported DPoP alg (only ES256 enabled)",
        ));
    }
    if hdr.jwk.kty != "EC" || hdr.jwk.crv != "P-256" {
        return Err(dpop_bad_request("DPoP jwk must be EC P-256"));
    }

    // 4) Build verifying key from JWK x,y
    let x = URL_SAFE_NO_PAD
        .decode(hdr.jwk.x.as_bytes())
        .map_err(|_| dpop_bad_request("bad jwk.x"))?;
    let y = URL_SAFE_NO_PAD
        .decode(hdr.jwk.y.as_bytes())
        .map_err(|_| dpop_bad_request("bad jwk.y"))?;
    if x.len() != 32 || y.len() != 32 {
        return Err(dpop_bad_request("jwk x/y must be 32 bytes for P-256"));
    }
    let point = EncodedPoint::from_affine_coordinates(
        FieldBytes::from_slice(&x),
        FieldBytes::from_slice(&y),
        /* compress = */ false,
    );
    let vk = VerifyingKey::from_encoded_point(&point)
        .map_err(|_| dpop_bad_request("invalid EC point"))?;

    // 5) Verify ECDSA signature over "<header>.<payload>"
    let signing_input = {
        let mut s = String::with_capacity(h_b64.len() + 1 + p_b64.len());
        s.push_str(h_b64);
        s.push('.');
        s.push_str(p_b64);
        s
    };
    let sig_bytes = URL_SAFE_NO_PAD
        .decode(s_b64.as_bytes())
        .map_err(|_| dpop_bad_request("bad signature b64"))?;

    let sig = if sig_bytes.len() == 64 {
        let der = ecdsa_raw_rs_to_der(&sig_bytes)
            .ok_or_else(|| dpop_bad_request("invalid DPoP signature"))?;
        Signature::from_der(&der).map_err(|_| dpop_bad_request("invalid DPoP signature"))?
    } else {
        Signature::from_der(&sig_bytes).map_err(|_| dpop_bad_request("invalid DPoP signature"))?
    };

    vk.verify(signing_input.as_bytes(), &sig)
        .map_err(|_| dpop_bad_request("invalid DPoP signature"))?;
    // 6) Parse payload claims
    let claims_bytes = URL_SAFE_NO_PAD
        .decode(p_b64.as_bytes())
        .map_err(|_| dpop_bad_request("bad payload b64"))?;
    let claims: serde_json::Value =
        serde_json::from_slice(&claims_bytes).map_err(|_| dpop_bad_request("bad payload JSON"))?;

    let jti = claims
        .get("jti")
        .and_then(|v| v.as_str())
        .ok_or_else(|| dpop_bad_request("missing jti"))?;
    let iat = claims
        .get("iat")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| dpop_bad_request("missing iat"))?;
    let htm = claims
        .get("htm")
        .and_then(|v| v.as_str())
        .ok_or_else(|| dpop_bad_request("missing htm"))?;
    let htu = claims
        .get("htu")
        .and_then(|v| v.as_str())
        .ok_or_else(|| dpop_bad_request("missing htu"))?;

    if !htm.eq_ignore_ascii_case(expected_method) {
        return Err(dpop_bad_request("htm mismatch"));
    }

    // 7) htu equality with canonicalized request URL (no query/fragment)
    let expected_htu = canonicalize_request_url(req);
    if !equal_uris_per_rfc3986(&expected_htu, htu) {
        return Err(dpop_bad_request("htu mismatch"));
    }

    // 8) If access token present (resource call), require+verify ath
    if let Some(at) = maybe_access_token {
        let want_ath = URL_SAFE_NO_PAD.encode(Sha256::digest(at.as_bytes()));
        let got_ath = claims
            .get("ath")
            .and_then(|v| v.as_str())
            .ok_or_else(|| dpop_bad_request("missing ath"))?;
        if got_ath != want_ath {
            return Err(dpop_bad_request("ath mismatch"));
        }
    }

    // 9) Freshness + DB replay check
    enforce_iat_fresh(iat)?;
    let jkt = jwk_thumbprint_ec_p256(&hdr.jwk.x, &hdr.jwk.y)?;
    dpop_replay_check_and_store(
        conn,
        jti,
        iat,
        maybe_client_id,
        Some(&jkt),
        Some(htm),
        Some(htu),
    )
    .await?;

    Ok(jkt)
}

fn ecdsa_raw_rs_to_der(raw: &[u8]) -> Option<Vec<u8>> {
    if raw.len() != 64 {
        return None;
    }
    let (r, s) = raw.split_at(32);

    fn trim_int(mut v: &[u8]) -> Vec<u8> {
        // strip leading zeros
        while v.len() > 1 && v[0] == 0 {
            v = &v[1..];
        }
        let mut out = v.to_vec();
        // add leading 0x00 if high bit is set (to keep INTEGER positive)
        if !out.is_empty() && (out[0] & 0x80) != 0 {
            let mut z = Vec::with_capacity(out.len() + 1);
            z.push(0);
            z.extend_from_slice(&out);
            out = z;
        }
        out
    }

    let r_enc = trim_int(r);
    let s_enc = trim_int(s);

    // SEQUENCE(0x30) len, INTEGER(0x02) len r, r, INTEGER(0x02) len s, s
    let len = 2 + r_enc.len() + 2 + s_enc.len();
    let mut der = Vec::with_capacity(2 + len);
    der.push(0x30);
    if len < 128 {
        der.push(len as u8);
    } else {
        // (won't happen here, but be correct)
        let len_bytes = (len as u16).to_be_bytes();
        der.push(0x81);
        der.push(len_bytes[1]);
    }
    der.push(0x02);
    der.push(r_enc.len() as u8);
    der.extend_from_slice(&r_enc);
    der.push(0x02);
    der.push(s_enc.len() as u8);
    der.extend_from_slice(&s_enc);
    Some(der)
}

/// Build canonical `htu` for this request (no query/fragment).
/// Honors common proxy headers, lowercases scheme/host, drops default ports.
pub fn canonicalize_request_url(req: &HttpRequest) -> String {
    let scheme = req
        .headers()
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_else(|| req.connection_info().scheme().to_ascii_lowercase());

    // prefer first value of X-Forwarded-Host if present
    let host = req
        .headers()
        .get("x-forwarded-host")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| req.connection_info().host().to_string());

    // optional: explicit forwarded port overrides host:port
    let port_override = req
        .headers()
        .get("x-forwarded-port")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u16>().ok());

    // split host[:port]
    let (mut host_only, mut port_opt) = {
        let s = host.trim();
        if let Some(close) = s.rfind(']') {
            if s.starts_with('[') && close > 0 {
                let h = &s[..=close];
                let rest = &s[close + 1..];
                let p = rest.strip_prefix(':').and_then(|t| t.parse::<u16>().ok());
                (h.to_string(), p)
            } else {
                (s.to_string(), None)
            }
        } else if let Some((h, p)) = s.rsplit_once(':') {
            if let Ok(pn) = p.parse::<u16>() {
                (h.to_string(), Some(pn))
            } else {
                (s.to_string(), None)
            }
        } else {
            (s.to_string(), None)
        }
    };

    if let Some(p) = port_override {
        port_opt = Some(p);
    }

    host_only = host_only.to_ascii_lowercase();

    // drop default ports
    if let Some(p) = port_opt {
        let is_default = (scheme == "http" && p == 80) || (scheme == "https" && p == 443);
        if is_default {
            port_opt = None;
        }
    }

    // path only, no query/fragment
    let mut path = req.uri().path();
    if path.is_empty() {
        path = "/";
    }

    match port_opt {
        Some(p) => format!("{scheme}://{host_only}:{p}{path}"),
        None => format!("{scheme}://{host_only}{path}"),
    }
}

/// Normalize an absolute URI string to the same canonical form we use for `htu`.
fn normalize_uri_no_query(s: &str) -> Option<String> {
    let url = Url::parse(s).ok()?;
    let scheme = url.scheme().to_ascii_lowercase();
    let mut host = url.host_str()?.to_ascii_lowercase();
    // keep IPv6 bracket form if present
    if s.contains('[') && s.contains(']') && !host.starts_with('[') {
        host = format!("[{host}]");
    }
    let port_opt = url.port();
    let is_default = matches!(
        (scheme.as_str(), port_opt),
        ("http", Some(80)) | ("https", Some(443))
    );
    let path = if url.path().is_empty() {
        "/"
    } else {
        url.path()
    };
    Some(match (port_opt, is_default) {
        (Some(p), false) => format!("{scheme}://{host}:{p}{path}"),
        _ => format!("{scheme}://{host}{path}"),
    })
}

fn equal_uris_per_rfc3986(a: &str, b: &str) -> bool {
    match (normalize_uri_no_query(a), normalize_uri_no_query(b)) {
        (Some(aa), Some(bb)) => aa == bb,
        _ => a == b, // fallback
    }
}

pub fn enforce_iat_fresh(iat: i64) -> Result<(), ControllerError> {
    const FUTURE_SKEW_SECS: i64 = 120; // allow small positive skew
    const MAX_AGE_SECS: i64 = 300; // accept up to 5 minutes old
    let now = Utc::now().timestamp();
    if iat > now + FUTURE_SKEW_SECS {
        return Err(dpop_bad_request("DPoP iat too far in the future"));
    }
    if now - iat > MAX_AGE_SECS {
        return Err(dpop_bad_request("DPoP proof too old"));
    }
    Ok(())
}

fn dpop_bad_request(msg: &str) -> ControllerError {
    ControllerError::new(
        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
            // If you have `InvalidDpopProof`, use it; otherwise `InvalidToken` is fine.
            error: OAuthErrorCode::InvalidDopopProof.as_str().into(),
            error_description: msg.to_string(),
            redirect_uri: None,
            state: None,
        })),
        msg,
        None::<anyhow::Error>,
    )
}
