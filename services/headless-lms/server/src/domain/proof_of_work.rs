//! The ALTCHA proof of work that the anonymous account forms require: the browser solves a challenge
//! from [`create_challenge`], and the form handler redeems the solution with [`verify_and_spend`].
//!
//! Each challenge is signed with what it is for, so a solution is accepted only by that form.

use std::collections::BTreeMap;
use std::ops::RangeInclusive;

use altcha::{Challenge, CreateChallengeOptions, Payload, VerifySolutionOptions};
use base64::Engine;
use chrono::Duration;
use headless_lms_models::altcha_spent_challenges;
use secrecy::ExposeSecret;
use utoipa::ToSchema;

use crate::config::server_runtime_config;
use crate::domain::error::{BadRequestReason, bad_request_with_reason};
use crate::prelude::*;

const ALGORITHM: &str = "PBKDF2/SHA-256";
const CHALLENGE_LIFETIME_MINUTES: i64 = 10;
/// The browser derives a key for every counter up to the secret one, so the work is the counter
/// times the cost.
const COUNTER_RANGE: RangeInclusive<u32> = 2_000..=5_000;
const TEST_MODE_COUNTER_RANGE: RangeInclusive<u32> = 1..=10;
const EXPIRED_CLEANUP_PROBABILITY: f64 = 0.01;

/// What a challenge may be redeemed for.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ChallengePurpose {
    Signup,
    PasswordReset,
}

/// What a challenge is issued for.
pub struct ChallengeContext {
    pub purpose: ChallengePurpose,
    /// Multiplies the search space, and so the expected solving time. At least 1.
    pub level: u32,
}

/// A fresh signed challenge for the form widget to solve.
pub async fn create_challenge(context: ChallengeContext) -> anyhow::Result<Challenge> {
    // Deterministic mode derives the key here, which is too slow for the async executor.
    web::block(move || create_challenge_blocking(&context)).await?
}

fn create_challenge_blocking(context: &ChallengeContext) -> anyhow::Result<Challenge> {
    let config = server_runtime_config();
    let range = if config.test_mode {
        TEST_MODE_COUNTER_RANGE
    } else {
        COUNTER_RANGE
    };
    let level = context.level.max(1);
    let counter_range = range.start().saturating_mul(level)..=range.end().saturating_mul(level);
    let mut data = BTreeMap::new();
    data.insert(
        "purpose".to_string(),
        serde_json::to_value(context.purpose)?,
    );
    let secret = config.altcha_hmac_secret.expose_secret().to_string();
    Ok(altcha::create_challenge(CreateChallengeOptions {
        algorithm: ALGORITHM.to_string(),
        cost: config.altcha_cost,
        counter: Some(rand::rng().random_range(counter_range)),
        data: Some(data),
        expires_at: Some((Utc::now() + Duration::minutes(CHALLENGE_LIFETIME_MINUTES)).timestamp()),
        hmac_signature_secret: Some(secret.clone()),
        hmac_key_signature_secret: Some(key_signature_secret(&secret)),
        ..Default::default()
    })?)
}

/// Signs the expected key, so a solution is checked with one HMAC instead of a key derivation.
fn key_signature_secret(secret: &str) -> String {
    format!("{secret}:key")
}

/// Accepts `payload`, the widget's base64 solution, once, for `purpose`. Errors with a generic
/// `BadRequest` when it is malformed, for another purpose, expired, wrongly solved or already
/// redeemed. Accepts the empty solution the plain-HTTP development host sends in test mode.
///
/// Call it before the handler looks at anything else, so a refusal reveals nothing about accounts.
pub async fn verify_and_spend(
    conn: &mut PgConnection,
    payload: &str,
    purpose: ChallengePurpose,
) -> Result<(), ControllerError> {
    if payload.is_empty() && server_runtime_config().test_mode {
        // Browsers refuse to solve on the plain-HTTP development host; the form sends nothing there.
        return Ok(());
    }
    let submitted = decode(payload).ok_or_else(refusal)?;
    let signature = submitted.challenge.signature.clone().ok_or_else(refusal)?;
    let challenge = verified_challenge(submitted).ok_or_else(refusal)?;
    let signed_purpose = challenge
        .parameters
        .data
        .as_ref()
        .and_then(|data| data.get("purpose"))
        .and_then(|value| serde_json::from_value::<ChallengePurpose>(value.clone()).ok());
    if signed_purpose != Some(purpose) {
        return Err(refusal());
    }
    let expires_at = challenge
        .parameters
        .expires_at
        .and_then(|timestamp| DateTime::from_timestamp(timestamp, 0))
        .ok_or_else(refusal)?;
    delete_expired_occasionally(conn).await?;
    if !altcha_spent_challenges::try_spend(conn, &signature, expires_at).await? {
        return Err(refusal());
    }
    Ok(())
}

fn decode(payload: &str) -> Option<Payload> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload)
        .ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// Checks the signature, the expiry and the solution. Cheap: the key is checked against its
/// signature rather than derived again.
fn verified_challenge(payload: Payload) -> Option<Challenge> {
    let secret = server_runtime_config().altcha_hmac_secret.expose_secret();
    let mut options =
        VerifySolutionOptions::new(&payload.challenge, &payload.solution, secret.to_string());
    options.hmac_key_signature_secret = Some(key_signature_secret(secret));
    let result = altcha::verify_solution(options).ok()?;
    result.verified.then_some(payload.challenge)
}

fn refusal() -> ControllerError {
    bad_request_with_reason(
        BadRequestReason::FormVerificationFailed,
        "Form verification failed. Please try again.".to_string(),
    )
}

async fn delete_expired_occasionally(conn: &mut PgConnection) -> ModelResult<()> {
    if !rand::rng().random_bool(EXPIRED_CLEANUP_PROBABILITY) {
        return Ok(());
    }
    let deleted = altcha_spent_challenges::delete_expired(conn).await?;
    info!("Deleted {deleted} expired proof-of-work challenges");
    Ok(())
}
