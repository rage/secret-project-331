use chrono::Duration;
use headless_lms_base::jwt::{JwtKey, sign_hs256_claim, validate_hs256_claim};

use crate::{
    error::{as_model_error, missing_model_error},
    prelude::*,
};

/// How long a preview link works. It may end up in agent transcripts, so it is bounded, but long
/// enough to review a changeset's pages in one session. Publishing or discarding the changeset
/// ends the link earlier.
const PREVIEW_TOKEN_LIFETIME_MINUTES: i64 = 120;

const PREVIEW_TOKEN_KIND: &str = "agent-changeset-page-preview";

/// Lets anyone holding it read one page of one changeset, as staged, without logging in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreviewClaim {
    /// Keeps other HS256 claims signed with the same key from passing as a preview claim.
    kind: String,
    pub changeset_id: Uuid,
    pub page_id: Uuid,
    pub user_id: Uuid,
    exp: i64,
    iat: i64,
}

/// A preview link's token and when it stops working.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewToken {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

/// Mints a short-lived preview token for the page as staged in the changeset. `key` is the
/// server's JWT key.
pub fn mint_preview_token(
    key: &JwtKey,
    changeset_id: Uuid,
    page_id: Uuid,
    user_id: Uuid,
) -> ModelResult<PreviewToken> {
    let now = Utc::now();
    let expires_at = now + Duration::minutes(PREVIEW_TOKEN_LIFETIME_MINUTES);
    let claim = PreviewClaim {
        kind: PREVIEW_TOKEN_KIND.to_string(),
        changeset_id,
        page_id,
        user_id,
        exp: expires_at.timestamp(),
        iat: now.timestamp(),
    };
    let token = sign_hs256_claim(&claim, key).map_err(as_model_error(
        ModelErrorType::Generic,
        "Signing a preview token failed",
    ))?;
    Ok(PreviewToken { token, expires_at })
}

/// Path of the main frontend page that previews a page as staged, for a token from
/// [`mint_preview_token`].
pub fn preview_path(token: &str) -> String {
    format!("/agent-preview/{token}")
}

/// Checks the token's signature and expiry. Errors with `PreconditionFailed` for an invalid,
/// expired or foreign token.
pub fn validate_preview_token(token: &str, key: &JwtKey) -> ModelResult<PreviewClaim> {
    validate_hs256_claim(token, key)
        .ok()
        .filter(|claim: &PreviewClaim| claim.kind == PREVIEW_TOKEN_KIND)
        .ok_or_else(missing_model_error(
            ModelErrorType::PreconditionFailed,
            "The preview link is invalid or has expired",
        ))
}
