use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{DateTime, Utc};
use jsonwebtoken::{EncodingKey, Header, encode};
use rsa::RsaPublicKey;
use rsa::pkcs1::DecodeRsaPublicKey;
use rsa::pkcs8::{DecodePublicKey, EncodePublicKey};
use rsa::traits::PublicKeyParts;
use sha2::{Digest as ShaDigest, Sha256};

use crate::domain::error::{ControllerError, ControllerErrorType, OAuthErrorCode, OAuthErrorData};
use crate::domain::oauth::claims::Claims;
use crate::prelude::{ApplicationConfiguration, BackendError};

pub fn rsa_n_e_and_kid_from_pem(public_pem: &str) -> anyhow::Result<(String, String, String)> {
    let pubkey = match RsaPublicKey::from_pkcs1_pem(public_pem) {
        Ok(k) => k,
        Err(_) => RsaPublicKey::from_public_key_pem(public_pem)?,
    };

    let n_b64 = URL_SAFE_NO_PAD.encode(pubkey.n().to_bytes_be());
    let e_b64 = URL_SAFE_NO_PAD.encode(pubkey.e().to_bytes_be());

    let spki_der = pubkey.to_public_key_der()?;
    let kid = URL_SAFE_NO_PAD.encode(Sha256::digest(spki_der.as_bytes()));

    Ok((n_b64, e_b64, kid))
}

pub fn generate_id_token(
    user_id: uuid::Uuid,
    client_id: &str,
    nonce: &str,
    expires_at: DateTime<Utc>,
    issuer: &str,
    cfg: &ApplicationConfiguration,
) -> Result<String, ControllerError> {
    let now = Utc::now().timestamp();
    let exp = expires_at.timestamp();

    let (_, _, kid) = rsa_n_e_and_kid_from_pem(&cfg.oauth_server_configuration.rsa_public_key)
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::ServerError.as_str().into(),
                    error_description: "Failed to derive key id (kid) from public key".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "Failed to derive kid from public key",
                Some(e),
            )
        })?;

    let claims = Claims {
        sub: user_id.to_string(),
        aud: client_id.to_string(),
        iss: issuer.to_string(),
        iat: now,
        exp,
        nonce: nonce.to_string(),
    };

    let mut header = Header::new(jsonwebtoken::Algorithm::RS256);
    header.kid = Some(kid);

    let enc_key =
        EncodingKey::from_rsa_pem(cfg.oauth_server_configuration.rsa_private_key.as_bytes())
            .map_err(|e| {
                ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::ServerError.as_str().into(),
                        error_description: "Failed to generate ID token".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "Failed to generate ID token (invalid private key)",
                    Some(e.into()),
                )
            })?;

    encode(&header, &claims, &enc_key).map_err(|e| {
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
