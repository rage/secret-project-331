use std::collections::HashMap;
use std::sync::Arc;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use utoipa::ToSchema;

use crate::{
    agent_changeset_entities,
    agent_changesets::AgentChangeset,
    error::{TryToOptional, missing_model_error},
    library::{
        agent_changesets::course_state::ExerciseReviewConfig,
        entity_snapshots::{
            self, ChapterSnapshot, ContentEntity, ContentEntityType, EntityKey, EntitySnapshot,
            PageSnapshot,
        },
    },
    prelude::*,
};

/// What the preview of a staged page renders.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PagePreview {
    pub course_name: String,
    pub language_code: String,
    /// The page as staged, or as live if the changeset does not change it.
    pub page: PreviewPage,
    /// Whether the page is its chapter's front page, as staged.
    pub is_chapter_front_page: bool,
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
    let staged = agent_changeset_entities::get_one(
        conn,
        changeset.id,
        EntityKey::new(ContentEntityType::Page, page_id),
    )
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
            .ok_or_else(missing_model_error(
                ModelErrorType::NotFound,
                "Page not found",
            ))?,
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
            EntityKey::new(
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
    let is_chapter_front_page = match page.chapter_id {
        Some(chapter_id) => {
            staged_front_page_id(conn, changeset, chapter_id).await? == Some(page.id)
        }
        None => false,
    };
    let course = crate::courses::get_course(conn, changeset.course_id).await?;
    Ok(PagePreview {
        course_name: course.name,
        language_code: course.language_code,
        page,
        is_chapter_front_page,
    })
}

/// The front page of chapter `chapter_id` as `changeset` stages it.
async fn staged_front_page_id(
    conn: &mut PgConnection,
    changeset: &AgentChangeset,
    chapter_id: Uuid,
) -> ModelResult<Option<Uuid>> {
    let staged = agent_changeset_entities::get_one(
        conn,
        changeset.id,
        EntityKey::new(ContentEntityType::Chapter, chapter_id),
    )
    .await?;
    if let Some(row) = staged {
        return Ok(row
            .after_snapshot
            .as_ref()
            .and_then(ChapterSnapshot::narrow)
            .and_then(|chapter| chapter.front_page_id));
    }
    Ok(crate::chapters::get_chapter(conn, chapter_id)
        .await
        .optional()?
        .and_then(|chapter| chapter.front_page_id))
}
