use chrono::Duration;
use headless_lms_base::jwt::{JwtKey, sign_hs256_claim, validate_hs256_claim};
use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::{self, AgentChangesetEntityType},
    agent_changesets,
    library::entity_snapshots::{self, EntitySnapshot, PageSnapshot},
    prelude::*,
};

/// How long a preview link works. It may end up in agent transcripts, so it is short.
pub const PREVIEW_TOKEN_LIFETIME_MINUTES: i64 = 15;

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

/// Mints a preview token for the page as staged in the changeset, valid for
/// [`PREVIEW_TOKEN_LIFETIME_MINUTES`]. `key` is the server's JWT key.
pub fn mint_preview_token(
    key: &JwtKey,
    changeset_id: Uuid,
    page_id: Uuid,
    user_id: Uuid,
) -> ModelResult<String> {
    let now = Utc::now();
    let claim = PreviewClaim {
        kind: PREVIEW_TOKEN_KIND.to_string(),
        changeset_id,
        page_id,
        user_id,
        exp: (now + Duration::minutes(PREVIEW_TOKEN_LIFETIME_MINUTES)).timestamp(),
        iat: now.timestamp(),
    };
    sign_hs256_claim(&claim, key)
        .map_err(|err| model_err!(Generic, format!("Signing a preview token failed: {err}")))
}

/// Checks the token's signature and expiry. Errors with `PreconditionFailed` for an invalid,
/// expired or foreign token.
pub fn validate_preview_token(token: &str, key: &JwtKey) -> ModelResult<PreviewClaim> {
    let claim: PreviewClaim = validate_hs256_claim(token, key).map_err(|_| {
        model_err!(
            PreconditionFailed,
            "The preview link is invalid or has expired".to_string()
        )
    })?;
    if claim.kind != PREVIEW_TOKEN_KIND {
        return Err(model_err!(
            PreconditionFailed,
            "The preview link is invalid or has expired".to_string()
        ));
    }
    Ok(claim)
}

/// What the preview of a staged page renders.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PagePreview {
    pub changeset_id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_slug: String,
    pub language_code: String,
    /// The page as staged, or as live if the changeset does not change it.
    pub page: PageSnapshot,
    /// Whether the changeset changes this page.
    pub is_staged: bool,
}

/// The page a valid preview claim points at. Errors with `NotFound` if the changeset is not the
/// claim's user's or no longer open, or if the page does not exist in it or live.
pub async fn resolve_preview(
    conn: &mut PgConnection,
    claim: &PreviewClaim,
) -> ModelResult<PagePreview> {
    let changeset = agent_changesets::get_by_id(conn, claim.changeset_id).await?;
    if changeset.user_id != claim.user_id || !changeset.is_open() {
        return Err(model_err!(
            NotFound,
            "The changeset of this preview is no longer open".to_string()
        ));
    }
    let staged = agent_changeset_entities::get_one(
        conn,
        changeset.id,
        AgentChangesetEntityType::Page,
        claim.page_id,
    )
    .await?;
    let (page, is_staged) = match staged {
        Some(entity) => {
            let snapshot = entity
                .after_snapshot
                .as_ref()
                .map(|value| EntitySnapshot::from_value(AgentChangesetEntityType::Page, value))
                .transpose()?;
            match snapshot {
                Some(EntitySnapshot::Page(page)) => (page, true),
                _ => {
                    return Err(model_err!(
                        NotFound,
                        "The changeset deletes this page".to_string()
                    ));
                }
            }
        }
        None => (
            entity_snapshots::load_page(conn, claim.page_id)
                .await?
                .ok_or_else(|| model_err!(NotFound, "Page not found".to_string()))?,
            false,
        ),
    };
    if page.course_id != changeset.course_id {
        return Err(model_err!(NotFound, "Page not found".to_string()));
    }
    let course = crate::courses::get_course(conn, changeset.course_id).await?;
    Ok(PagePreview {
        changeset_id: changeset.id,
        course_id: course.id,
        course_name: course.name,
        course_slug: course.slug,
        language_code: course.language_code,
        page,
        is_staged,
    })
}
