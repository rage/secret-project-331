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
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
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

// ----- Main verifier: returns JWK thumbprint (jkt) -----

pub async fn verify_dpop_and_get_jkt(
    conn: &mut PgConnection,
    req: &actix_web::HttpRequest,
    expected_method: &str,
    require_ath_for: Option<&str>, // Some(access_token_plain) for resource calls; None for /token
) -> Result<String, ControllerError> {
    let proof = req
        .headers()
        .get("DPoP")
        .ok_or_else(|| anyhow::anyhow!("missing DPoP header"))?
        .to_str()
        .map_err(|_| anyhow::anyhow!("invalid DPoP header encoding"))?;

    // We need the raw header to fetch "jwk"
    let header = decode_header(proof)?;
    let header_segment = proof
        .split('.')
        .next()
        .ok_or_else(|| anyhow::anyhow!("bad JWT"))?;
    let header_json = String::from_utf8(URL_SAFE_NO_PAD.decode(header_segment)?)?;
    let raw: RawHeader = serde_json::from_str(&header_json)?;

    let alg = header.alg;

    // Build DecodingKey from JWK and compute jkt
    let jwk = raw.jwk.ok_or_else(|| anyhow::anyhow!("DPoP jwk missing"))?;
    let (key, jkt) = match jwk.get("kty").and_then(Value::as_str) {
        Some("EC") => {
            // Only P-256/ES256 here
            let crv = jwk
                .get("crv")
                .and_then(Value::as_str)
                .ok_or_else(|| anyhow::anyhow!("missing crv"))?;
            if crv != "P-256" || alg != Algorithm::ES256 {
                return Err(anyhow::anyhow!("unsupported EC curve/alg").into());
            }
            let x = jwk
                .get("x")
                .and_then(Value::as_str)
                .ok_or_else(|| anyhow::anyhow!("missing x"))?;
            let y = jwk
                .get("y")
                .and_then(Value::as_str)
                .ok_or_else(|| anyhow::anyhow!("missing y"))?;
            let key = ec_decoding_key_from_xy_b64url(x, y)?;
            let jkt = jwk_thumbprint_ec_p256(x, y)?;
            (key, jkt)
        }
        Some("RSA") => {
            // Accept RS256/384/512
            if !matches!(alg, Algorithm::RS256 | Algorithm::RS384 | Algorithm::RS512) {
                return Err(anyhow::anyhow!("unsupported RSA alg").into());
            }
            let n = jwk
                .get("n")
                .and_then(Value::as_str)
                .ok_or_else(|| anyhow::anyhow!("missing n"))?;
            let e = jwk
                .get("e")
                .and_then(Value::as_str)
                .ok_or_else(|| anyhow::anyhow!("missing e"))?;
            let key = DecodingKey::from_rsa_components(n, e)?;
            let jkt = jwk_thumbprint_rsa(n, e)?;
            (key, jkt)
        }
        _ => return Err(anyhow::anyhow!("unsupported DPoP kty").into()),
    };

    let mut validation = Validation::new(alg);
    validation.required_spec_claims.clear(); // we enforce our own checks
    let jwt = decode::<DpopClaims>(proof, &key, &validation)?;
    let c = jwt.claims;

    // htm/htu
    if !c.htm.eq_ignore_ascii_case(expected_method) {
        return Err(anyhow::anyhow!("DPoP htm mismatch").into());
    }
    let expected_htu = expected_request_uri(req);
    if c.htu != expected_htu {
        return Err(anyhow::anyhow!("DPoP htu mismatch").into());
    }

    // iat freshness (+-5 minutes)
    let now = Utc::now().timestamp();
    if (now - c.iat).abs() > 300 {
        return Err(anyhow::anyhow!("DPoP iat out of range").into());
    }

    // Replay prevention (store/reject duplicate jti)
    dpop_replay_check_and_store(conn, &c.jti, c.iat, None, None, None, None).await?;

    // If protecting resources, enforce ath
    if let Some(access_token) = require_ath_for {
        let mut h = Sha256::new();
        h.update(access_token.as_bytes());
        let ath_expected = URL_SAFE_NO_PAD.encode(h.finalize());
        match c.ath {
            Some(ref ath) if *ath == ath_expected => {}
            _ => return Err(anyhow::anyhow!("DPoP ath missing/mismatch").into()),
        }
    }

    Ok(jkt)
}
