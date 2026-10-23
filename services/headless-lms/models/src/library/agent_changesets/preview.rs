use std::collections::HashMap;
use std::sync::Arc;

use chrono::Duration;
use headless_lms_base::jwt::{JwtKey, sign_hs256_claim, validate_hs256_claim};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use utoipa::ToSchema;

use crate::{
    agent_changeset_entities,
    agent_changesets::AgentChangeset,
    library::{
        agent_changesets::course_state::ExerciseReviewConfig,
        entity_snapshots::{self, ContentEntityType, EntitySnapshot, PageSnapshot},
    },
    prelude::*,
};

/// How long a preview link works. It may end up in agent transcripts, so it is short.
const PREVIEW_TOKEN_LIFETIME_MINUTES: i64 = 15;

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
    let token = sign_hs256_claim(&claim, key)
        .map_err(|err| model_err!(Generic, format!("Signing a preview token failed: {err}")))?;
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
        .ok_or_else(|| {
            model_err!(
                PreconditionFailed,
                "The preview link is invalid or has expired".to_string()
            )
        })
}

/// What the preview of a staged page renders.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PagePreview {
    pub course_name: String,
    pub language_code: String,
    /// The page as staged, or as live if the changeset does not change it.
    pub page: PreviewPage,
}

/// A page as students see it before answering anything. The preview needs no login, so exercise
/// specs, model solutions and review settings other than the instructions are left out.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PreviewPage {
    pub id: Uuid,
    pub course_id: Uuid,
    pub chapter_id: Option<Uuid>,
    pub url_path: String,
    pub title: String,
    pub hidden: bool,
    pub order_number: i32,
    pub content: Vec<GutenbergBlock>,
    pub exercises: Vec<PreviewExercise>,
}

/// An exercise of a previewed page.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PreviewExercise {
    pub id: Uuid,
    pub name: String,
    /// The assignment blocks of its tasks, in slide and task order.
    pub assignment: Vec<serde_json::Value>,
    /// Whether students review answers to it, themselves or each other.
    pub has_reviews: bool,
    pub uses_course_default_review_config: bool,
    /// The review instructions blocks students see while reviewing. For an exercise that uses the
    /// course default, only a preview link fills them in.
    pub review_instructions: Option<serde_json::Value>,
}

impl From<PageSnapshot> for PreviewPage {
    fn from(page: PageSnapshot) -> Self {
        let PageSnapshot {
            id,
            course_id,
            chapter_id,
            url_path,
            title,
            hidden,
            order_number,
            content,
            exercises,
            mut exercise_slides,
            mut exercise_tasks,
            joins_page_language_group_id: _,
        } = page;
        exercise_slides.sort_by_key(|slide| (slide.order_number, slide.id));
        exercise_tasks.sort_by_key(|task| (task.order_number, task.id));
        let mut assignments_by_slide: HashMap<Uuid, Vec<serde_json::Value>> = HashMap::new();
        for task in exercise_tasks {
            if let serde_json::Value::Array(blocks) = task.assignment {
                assignments_by_slide
                    .entry(task.exercise_slide_id)
                    .or_default()
                    .extend(blocks);
            }
        }
        let exercises = exercises
            .into_iter()
            .map(|exercise| PreviewExercise {
                assignment: exercise_slides
                    .iter()
                    .filter(|slide| slide.exercise_id == exercise.id)
                    .flat_map(|slide| assignments_by_slide.remove(&slide.id).unwrap_or_default())
                    .collect(),
                id: exercise.id,
                has_reviews: exercise.needs_peer_review || exercise.needs_self_review,
                uses_course_default_review_config: exercise
                    .use_course_default_peer_or_self_review_config,
                review_instructions: ExerciseReviewConfig::of_exercise(&exercise)
                    .own_review_instructions()
                    .cloned(),
                name: exercise.name,
            })
            .collect();
        Self {
            id,
            course_id,
            chapter_id,
            url_path,
            title,
            hidden,
            order_number,
            content: Arc::unwrap_or_clone(content),
            exercises,
        }
    }
}

/// What a preview link of `page_id` in `changeset` renders. The caller checks that the changeset
/// is the link's user's and that they may still edit its course. Errors with `NotFound` if the
/// changeset is no longer open or if the page does not exist in it or live.
pub async fn resolve_preview(
    conn: &mut PgConnection,
    changeset: &AgentChangeset,
    page_id: Uuid,
) -> ModelResult<PagePreview> {
    if !changeset.is_open() {
        return Err(model_err!(
            NotFound,
            "The changeset of this preview is no longer open".to_string()
        ));
    }
    let staged =
        agent_changeset_entities::get_one(conn, changeset.id, (ContentEntityType::Page, page_id))
            .await?;
    let page = match staged {
        Some(entity) => match entity.after_snapshot {
            Some(EntitySnapshot::Page(page)) => page,
            _ => {
                return Err(model_err!(
                    NotFound,
                    "The changeset deletes this page".to_string()
                ));
            }
        },
        None => entity_snapshots::load_page(conn, page_id)
            .await?
            .ok_or_else(|| model_err!(NotFound, "Page not found".to_string()))?,
    };
    if page.course_id != changeset.course_id {
        return Err(model_err!(NotFound, "Page not found".to_string()));
    }
    let mut page = PreviewPage::from(page);
    if page
        .exercises
        .iter()
        .any(|exercise| exercise.uses_course_default_review_config)
        && let Some(live_default) =
            entity_snapshots::load_course_default_review_config(conn, changeset.course_id).await?
    {
        let staged_default = agent_changeset_entities::get_one(
            conn,
            changeset.id,
            (
                ContentEntityType::CourseDefaultReviewConfig,
                live_default.id,
            ),
        )
        .await?
        .and_then(|row| match row.after_snapshot {
            Some(EntitySnapshot::CourseDefaultReviewConfig(config)) => Some(config),
            _ => None,
        })
        .unwrap_or(live_default);
        for exercise in page.exercises.iter_mut() {
            if exercise.uses_course_default_review_config {
                exercise.review_instructions = staged_default.review_instructions.clone();
            }
        }
    }
    let course = crate::courses::get_course(conn, changeset.course_id).await?;
    Ok(PagePreview {
        course_name: course.name,
        language_code: course.language_code,
        page,
    })
}
