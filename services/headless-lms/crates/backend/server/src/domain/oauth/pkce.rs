use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Digest, Sha256};

use crate::domain::error::{ControllerError, PkceFlowError};
use crate::domain::oauth::helpers::oauth_invalid_request;
use headless_lms_models::oauth_client::OAuthClient;

/// Re-export PkceMethod from models (it's used in SQL queries, so must stay in models crate)
pub use headless_lms_models::library::oauth::pkce::PkceMethod;

/// RFC 7636: code_verifier length MUST be between 43 and 128 characters.
pub const VERIFIER_MIN_LEN: usize = 43;
pub const VERIFIER_MAX_LEN: usize = 128;

/// Errors constructing/validating PKCE values.
#[derive(Debug, thiserror::Error)]
pub enum PkceError {
    #[error("code_verifier length out of bounds")]
    BadLength,
    #[error("code_verifier contains invalid characters")]
    BadCharset,
    #[error("Disallowed PKCE method")]
    BadMethod,
}

/// Validated PKCE code_verifier (RFC 7636).
#[derive(Debug, Clone)]
pub struct CodeVerifier(String);

impl CodeVerifier {
    /// Construct after validating length and allowed charset.
    pub fn new(s: &str) -> Result<Self, PkceError> {
        validate_verifier(s)?;
        Ok(Self(s.to_owned()))
    }

    /// Construct without allocation if you already own a String; still validates.
    pub fn try_from_string(s: String) -> Result<Self, PkceError> {
        validate_verifier(&s)?;
        Ok(Self(s))
    }

    /// Borrow the inner str.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Compute the PKCE `code_challenge` for this verifier using `method`.
    pub fn to_challenge(&self, method: PkceMethod) -> CodeChallenge {
        match method {
            PkceMethod::Plain => CodeChallenge(self.0.clone()),
            PkceMethod::S256 => {
                let digest = Sha256::digest(self.0.as_bytes());
                CodeChallenge(URL_SAFE_NO_PAD.encode(digest))
            }
        }
    }
}

/// Stored PKCE code_challenge.
#[derive(Debug, Clone)]
pub struct CodeChallenge(String);

impl CodeChallenge {
    /// Wrap a stored challenge (e.g., from DB). No extra validation needed at this layer.
    pub fn from_stored<S: Into<String>>(s: S) -> Self {
        Self(s.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Verify that `verifier` corresponds to this challenge under `method`.
    pub fn verify(&self, verifier: &CodeVerifier, method: PkceMethod) -> bool {
        let computed = verifier.to_challenge(method);
        constant_time_eq(self.as_str(), computed.as_str())
    }
}

/// Strict RFC 7636 validator: length 43–128 and only unreserved characters.
///
/// Unreserved: ALPHA / DIGIT / "-" / "." / "_" / "~"
fn validate_verifier(v: &str) -> Result<(), PkceError> {
    let len = v.len();
    if !(VERIFIER_MIN_LEN..=VERIFIER_MAX_LEN).contains(&len) {
        return Err(PkceError::BadLength);
    }
    if !v.bytes().all(|b| {
        matches!(
            b,
            b'A'..=b'Z' |
            b'a'..=b'z' |
            b'0'..=b'9' |
            b'-' | b'.' | b'_' | b'~'
        )
    }) {
        return Err(PkceError::BadCharset);
    }
    Ok(())
}

/// Constant-time equality on ASCII strings (safe for our base64url/plain outputs).
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Validate PKCE parameters during `/authorize`.
pub fn parse_authorize_pkce(
    client: &OAuthClient,
    code_challenge: Option<&str>,
    code_challenge_method: Option<&str>,
    redirect_uri: &str,
    state: Option<&str>,
) -> Result<Option<PkceMethod>, ControllerError> {
    let pkce_required = client.requires_pkce();
    let parsed = match (code_challenge, code_challenge_method) {
        (Some(ch), Some(method_str)) => {
            let method = PkceMethod::parse(method_str).ok_or_else(|| {
                oauth_invalid_request(
                    "unsupported code_challenge_method",
                    Some(redirect_uri),
                    state,
                )
            })?;

            if !client.allows_pkce_method(method) {
                return Err(oauth_invalid_request(
                    "code_challenge_method not allowed for this client",
                    Some(redirect_uri),
                    state,
                ));
            }

            match method {
                PkceMethod::S256 => {
                    let bytes = URL_SAFE_NO_PAD.decode(ch).map_err(|_| {
                        oauth_invalid_request(
                            "invalid code_challenge for S256 (not base64url/no-pad)",
                            Some(redirect_uri),
                            state,
                        )
                    })?;
                    if bytes.len() != 32 {
                        return Err(oauth_invalid_request(
                            "invalid code_challenge for S256 (must decode to 32 bytes)",
                            Some(redirect_uri),
                            state,
                        ));
                    }
                }
                PkceMethod::Plain => {
                    CodeVerifier::new(ch).map_err(|_| {
                        oauth_invalid_request(
                            "invalid code_challenge for plain",
                            Some(redirect_uri),
                            state,
                        )
                    })?;
                }
            }

            Some(method)
        }
        (None, None) => None,
        _ => {
            return Err(oauth_invalid_request(
                "code_challenge and code_challenge_method must be used together",
                Some(redirect_uri),
                state,
            ));
        }
    };

    if pkce_required && parsed.is_none() {
        return Err(oauth_invalid_request(
            "PKCE required for this client",
            Some(redirect_uri),
            state,
        ));
    }

    Ok(parsed)
}

/// Verify PKCE bindings during `/token`.
pub fn verify_token_pkce(
    client: &OAuthClient,
    stored_challenge: Option<&str>,
    stored_method: Option<PkceMethod>,
    provided_verifier: Option<&str>,
) -> Result<(), ControllerError> {
    match (stored_challenge, stored_method) {
        (Some(stored_chal), Some(method)) => {
            if !client.allows_pkce_method(method) {
                return Err(PkceFlowError::InvalidRequest(
                    "pkce method not allowed for this client",
                )
                .into());
            }

            let verifier_str =
                provided_verifier.ok_or(PkceFlowError::InvalidRequest("code_verifier required"))?;
            let verifier = CodeVerifier::new(verifier_str)
                .map_err(|_| PkceFlowError::InvalidRequest("invalid code_verifier"))?;

            let challenge = CodeChallenge::from_stored(stored_chal);
            if !challenge.verify(&verifier, method) {
                return Err(PkceFlowError::InvalidGrant("PKCE verification failed").into());
            }
        }
        (None, None) => {
            if client.requires_pkce() {
                return Err(PkceFlowError::InvalidRequest("PKCE required for this client").into());
            }
        }
        _ => {
            return Err(PkceFlowError::ServerError("inconsistent PKCE state").into());
        }
    }
    Ok(())
}
