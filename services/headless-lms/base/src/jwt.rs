//! The HS256 signing key and the claims that live outside the server crate.
//!
//! Download claims live here rather than beside the rest of the claim machinery in
//! `headless_lms_server::domain::models_requests` because the answer readers that mint download
//! URLs sit in `headless-lms-models`, under the server crate.

use std::net::IpAddr;

use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use secrecy::{ExposeSecret, SecretString};
use serde::{Serialize, de::DeserializeOwned};
use uuid::Uuid;

use crate::hmac_sha256::hmac_sha256;

/// Query parameter carrying a [`DownloadClaim`]; the claimed-file route repeats it in a rename.
pub const DOWNLOAD_CLAIM_PARAM: &str = "download-claim";

/// The fixed password development and test builds sign with. Production reads `JWT_PASSWORD`, so
/// nothing signed with this is accepted there.
pub const DEVELOPMENT_JWT_PASSWORD: &str =
    "sMG87WlKnNZoITzvL2+jczriTR7JRsCtGu/bSKaSIvw=asdfjklasd***FSDfsdASDFDS";

#[derive(Clone, Debug)]
pub struct JwtKey(Vec<u8>);

impl JwtKey {
    /// Builds the HS256 signing key from the configured secret.
    ///
    /// Errors on an empty or whitespace-only secret, which would leave every claim the host mints
    /// forgeable.
    pub fn new(key: &SecretString) -> anyhow::Result<Self> {
        if key.expose_secret().trim().is_empty() {
            anyhow::bail!("JWT_PASSWORD cannot be empty");
        }
        Ok(Self(key.expose_secret().as_bytes().to_vec()))
    }

    /// The key [`crate::config::ApplicationConfiguration::mock_conf`] installs, so a test that signs
    /// a claim by hand matches a server built from that configuration.
    pub fn test_key() -> Self {
        Self(DEVELOPMENT_JWT_PASSWORD.as_bytes().to_vec())
    }
}

pub fn sign_hs256_claim<T: Serialize>(
    claim: &T,
    key: &JwtKey,
) -> Result<String, jsonwebtoken::errors::Error> {
    encode(
        &Header::new(Algorithm::HS256),
        claim,
        &EncodingKey::from_secret(&key.0),
    )
}

/// Decodes and verifies an HS256 token into the requested claim type.
pub fn validate_hs256_claim<T: DeserializeOwned>(
    token: &str,
    key: &JwtKey,
) -> Result<T, jsonwebtoken::errors::Error> {
    decode_hs256_claim(token, key, Validation::new(Algorithm::HS256))
}

/// [`validate_hs256_claim`] with no clock leeway, for claims living shorter than the default 60 s
/// leeway, which would otherwise outlive them several times over.
pub fn validate_hs256_claim_without_leeway<T: DeserializeOwned>(
    token: &str,
    key: &JwtKey,
) -> Result<T, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.leeway = 0;
    decode_hs256_claim(token, key, validation)
}

fn decode_hs256_claim<T: DeserializeOwned>(
    token: &str,
    key: &JwtKey,
    validation: Validation,
) -> Result<T, jsonwebtoken::errors::Error> {
    decode::<T>(token, &DecodingKey::from_secret(&key.0), &validation)
        .map(|token_data| token_data.claims)
}

/// Signs a student in on courses when mooc.fi's credit registration page sends them over.
///
/// Not single use: a leaked one is harmless because it lives [`Self::LIFETIME`] and works only from
/// the IP it was minted for. Sign it with [`sign_hs256_claim`].
#[derive(Debug, Serialize, serde::Deserialize)]
pub struct MoocfiHandoffClaim {
    pub user_id: Uuid,
    pub moocfi_course_id: Uuid,
    /// The token is signed, not encrypted, so it carries a keyed hash and never the IP itself. A
    /// plain hash of an IPv4 address is reversed by trying all 2^32 of them.
    client_ip_hash: String,
    iat: i64,
    exp: i64,
}

impl MoocfiHandoffClaim {
    /// How long a minted handoff can be redeemed.
    pub const LIFETIME: Duration = Duration::seconds(10);

    /// A claim for the student at `client_ip` as mooc.fi saw them, expiring after
    /// [`Self::LIFETIME`].
    pub fn new(user_id: Uuid, moocfi_course_id: Uuid, client_ip: IpAddr, key: &JwtKey) -> Self {
        let iat = Utc::now().timestamp();
        Self {
            user_id,
            moocfi_course_id,
            client_ip_hash: client_ip_hash(client_ip, key),
            iat,
            exp: iat + Self::LIFETIME.num_seconds(),
        }
    }

    /// Whether the claim was minted for a request from `client_ip`.
    pub fn is_bound_to(&self, client_ip: IpAddr, key: &JwtKey) -> bool {
        self.client_ip_hash == client_ip_hash(client_ip, key)
    }

    /// Checks the signature and the expiry, with no leeway.
    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, jsonwebtoken::errors::Error> {
        validate_hs256_claim_without_leeway(token, key)
    }

    /// Checks only the signature, so an expired claim still names its course. Never sign anyone in
    /// on what this returns.
    pub fn read_ignoring_expiry(
        token: &str,
        key: &JwtKey,
    ) -> Result<Self, jsonwebtoken::errors::Error> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        decode_hs256_claim(token, key, validation)
    }
}

/// Hex HMAC-SHA256 of the IP as printed after normalising, so textual variants of one IPv6 address
/// and the IPv4-mapped form of an IPv4 address hash the same. Keyed with a key derived from `key`
/// rather than `key` itself, so the MAC can never double as an HS256 signature.
fn client_ip_hash(client_ip: IpAddr, key: &JwtKey) -> String {
    let normalised = match client_ip {
        IpAddr::V6(v6) => v6.to_ipv4_mapped().map_or(IpAddr::V6(v6), IpAddr::V4),
        v4 => v4,
    };
    let derived_key = hmac_sha256(&key.0, b"moocfi-handoff-client-ip");
    hex::encode(hmac_sha256(&derived_key, normalised.to_string().as_bytes()))
}

/// Authorizes the bearer to read one specific host-stored file for a while.
///
/// Minted by the host wherever it hands out a URL for a file-typed answer: to an exercise service's
/// grade endpoint, and to the views that render a submission. The read-side mirror of
/// `UploadClaim`; unlike it, this claim names a single file rather than a namespace, so a holder
/// cannot reach any other file.
#[derive(Debug, Serialize, serde::Deserialize)]
pub struct DownloadClaim {
    file_upload_id: Uuid,
    exp: usize,
    iat: usize,
}

impl DownloadClaim {
    pub fn file_upload_id(&self) -> Uuid {
        self.file_upload_id
    }

    /// A day, not the grading request's 120 s: a service may finish asynchronously through
    /// `grading_update_url` long after the request returns.
    pub fn expiring_in_1_day(file_upload_id: Uuid) -> Self {
        Self::expiring_in(file_upload_id, Duration::days(1))
    }

    /// For a URL a person is about to click: long enough to leave the page open for a while, short
    /// enough that a copied link is not a lasting handle on someone else's answer.
    pub fn expiring_in_1_hour(file_upload_id: Uuid) -> Self {
        Self::expiring_in(file_upload_id, Duration::hours(1))
    }

    fn expiring_in(file_upload_id: Uuid, lifetime: Duration) -> Self {
        let now = Utc::now().timestamp().max(0) as usize;
        let exp = (Utc::now().timestamp() + lifetime.num_seconds()).max(0) as usize;
        Self {
            file_upload_id,
            exp,
            iat: now,
        }
    }

    pub fn sign(self, key: &JwtKey) -> Result<String, jsonwebtoken::errors::Error> {
        sign_hs256_claim(&self, key)
    }

    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, jsonwebtoken::errors::Error> {
        validate_hs256_claim(token, key)
    }
}

/// The URL one host-stored file is read through, carrying a claim minted for it here and now.
///
/// The claim expires, so the result is good for one reader for one sitting: it must not be
/// persisted, and a response carrying it cannot be cached for anyone else.
pub fn claimed_file_url(
    base_url: &str,
    key: &JwtKey,
    claim: DownloadClaim,
) -> Result<String, jsonwebtoken::errors::Error> {
    let file_upload_id = claim.file_upload_id();
    let token = claim.sign(key)?;
    Ok(format!(
        "{base_url}/api/v0/files/claimed/{file_upload_id}?{DOWNLOAD_CLAIM_PARAM}={token}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn other_key() -> JwtKey {
        JwtKey::new(&SecretString::new(
            "a-completely-different-jwt-secret-0123456789"
                .to_string()
                .into(),
        ))
        .expect("test key")
    }

    fn past_timestamp(seconds_ago: i64) -> i64 {
        (Utc::now() - Duration::seconds(seconds_ago)).timestamp()
    }

    #[test]
    fn an_empty_jwt_password_is_rejected() {
        for secret in ["", "   ", "\t\n"] {
            JwtKey::new(&SecretString::new(secret.to_string().into()))
                .expect_err("a blank secret must be rejected");
        }
    }

    #[test]
    fn download_claim_round_trips() {
        let key = JwtKey::test_key();
        let file_upload_id = Uuid::new_v4();
        let token = DownloadClaim::expiring_in_1_day(file_upload_id)
            .sign(&key)
            .expect("signing should succeed");
        let claim = DownloadClaim::validate(&token, &key).expect("the claim should validate");
        assert_eq!(claim.file_upload_id(), file_upload_id);
    }

    /// A grading request's claims outlive the request itself, but not by more than a day.
    #[test]
    fn download_claim_expires_in_a_day() {
        let claim = DownloadClaim::expiring_in_1_day(Uuid::new_v4());
        let lifetime = claim.exp as i64 - claim.iat as i64;
        assert_eq!(lifetime, Duration::days(1).num_seconds());
    }

    /// A URL handed to a person outlives the page load, but not the sitting.
    #[test]
    fn download_claim_expires_in_an_hour() {
        let claim = DownloadClaim::expiring_in_1_hour(Uuid::new_v4());
        let lifetime = claim.exp as i64 - claim.iat as i64;
        assert_eq!(lifetime, Duration::hours(1).num_seconds());
    }

    #[test]
    fn expired_download_claim_is_rejected() {
        let key = JwtKey::test_key();
        let token = sign_hs256_claim(
            &serde_json::json!({
                "file_upload_id": Uuid::new_v4(),
                "exp": past_timestamp(3600),
                "iat": past_timestamp(7200),
            }),
            &key,
        )
        .expect("signing should succeed");
        DownloadClaim::validate(&token, &key).expect_err("an expired claim must be rejected");
    }

    #[test]
    fn download_claim_signed_with_another_key_is_rejected() {
        let token = DownloadClaim::expiring_in_1_day(Uuid::new_v4())
            .sign(&other_key())
            .expect("signing should succeed");
        DownloadClaim::validate(&token, &JwtKey::test_key())
            .expect_err("a claim signed with another key must be rejected");
    }

    #[test]
    fn moocfi_handoff_claim_expires_without_leeway() {
        let key = JwtKey::test_key();
        let token = sign_hs256_claim(
            &serde_json::json!({
                "user_id": Uuid::new_v4(),
                "moocfi_course_id": Uuid::new_v4(),
                "client_ip_hash": "",
                "iat": past_timestamp(12),
                "exp": past_timestamp(2),
            }),
            &key,
        )
        .expect("signing should succeed");
        validate_hs256_claim::<MoocfiHandoffClaim>(&token, &key)
            .expect("the default leeway would still accept it");
        MoocfiHandoffClaim::validate(&token, &key)
            .expect_err("an expired handoff must be rejected");
        MoocfiHandoffClaim::read_ignoring_expiry(&token, &key)
            .expect("an expired handoff still names its course");
    }

    #[test]
    fn the_client_ip_hash_needs_the_key() {
        let ip: IpAddr = "192.0.2.1".parse().expect("an IP");
        let mapped: IpAddr = "::ffff:192.0.2.1".parse().expect("an IP");
        let claim =
            MoocfiHandoffClaim::new(Uuid::new_v4(), Uuid::new_v4(), ip, &JwtKey::test_key());
        assert!(claim.is_bound_to(mapped, &JwtKey::test_key()));
        assert!(!claim.is_bound_to(ip, &other_key()));
    }

    #[test]
    fn a_claimed_file_url_names_the_file_it_authorizes() {
        let key = JwtKey::test_key();
        let file_upload_id = Uuid::new_v4();
        let url = claimed_file_url(
            "http://project-331.local",
            &key,
            DownloadClaim::expiring_in_1_hour(file_upload_id),
        )
        .expect("the url should be built");

        let (path, query) = url
            .strip_prefix("http://project-331.local/api/v0/files/claimed/")
            .expect("a claimed-file url")
            .split_once('?')
            .expect("a claim in the query string");
        assert_eq!(path, file_upload_id.to_string());
        let token = query
            .strip_prefix(&format!("{DOWNLOAD_CLAIM_PARAM}="))
            .expect("the claim parameter");
        let claim = DownloadClaim::validate(token, &key).expect("the claim should validate");
        assert_eq!(claim.file_upload_id(), file_upload_id);
    }
}
