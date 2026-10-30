use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::Duration;
use rand::Rng;
use sha2::{Digest, Sha256};

use crate::{error::missing_model_error, prelude::*};

/// How long a preview link works. It may end up in agent transcripts, so it is bounded, but long
/// enough to review a changeset's pages in one session. Publishing or discarding the changeset
/// ends the link earlier.
const PREVIEW_TOKEN_LIFETIME_MINUTES: i64 = 120;

const PREVIEW_TOKEN_BYTES: usize = 16;

/// What a valid preview token lets its holder read without logging in: one page of a course, or
/// all of its pages, as `changeset_id` stages them or as published.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewClaim {
    pub course_id: Uuid,
    /// `None` for the published state of the course.
    pub changeset_id: Option<Uuid>,
    /// `None` for a token of all the changeset's changed pages, or all the course's pages when
    /// published.
    pub page_id: Option<Uuid>,
    pub user_id: Uuid,
}

/// A preview link's token and when it stops working.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewToken {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

fn hash_token(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

/// Mints a short-lived preview token for the page `page_id` of the course, or for all its pages
/// with `None`, as `changeset_id` stages them or published without one. Also deletes expired
/// tokens.
pub async fn mint_preview_token(
    conn: &mut PgConnection,
    course_id: Uuid,
    changeset_id: Option<Uuid>,
    page_id: Option<Uuid>,
    user_id: Uuid,
) -> ModelResult<PreviewToken> {
    let mut bytes = [0u8; PREVIEW_TOKEN_BYTES];
    rand::rng().fill_bytes(&mut bytes);
    let token = URL_SAFE_NO_PAD.encode(bytes);
    let expires_at = Utc::now() + Duration::minutes(PREVIEW_TOKEN_LIFETIME_MINUTES);

    sqlx::query!("DELETE FROM agent_changeset_preview_links WHERE expires_at < now()")
        .execute(&mut *conn)
        .await?;
    sqlx::query!(
        "
INSERT INTO agent_changeset_preview_links (token_hash, course_id, changeset_id, page_id, user_id, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
",
        hash_token(&token),
        course_id,
        changeset_id,
        page_id,
        user_id,
        expires_at,
    )
    .execute(conn)
    .await?;
    Ok(PreviewToken { token, expires_at })
}

/// Path of the main frontend page that previews the staged changeset, for a token from
/// [`mint_preview_token`].
pub fn preview_path(token: &str) -> String {
    format!("/agent-preview/{token}")
}

/// Looks up an unexpired token. Errors with `PreconditionFailed` for an unknown or expired one.
pub async fn validate_preview_token(
    conn: &mut PgConnection,
    token: &str,
) -> ModelResult<PreviewClaim> {
    sqlx::query_as!(
        PreviewClaim,
        "
SELECT course_id, changeset_id, page_id, user_id
FROM agent_changeset_preview_links
WHERE token_hash = $1
  AND expires_at > now()
",
        hash_token(token),
    )
    .fetch_optional(conn)
    .await?
    .ok_or_else(missing_model_error(
        ModelErrorType::PreconditionFailed,
        "The preview link is invalid or has expired",
    ))
}
