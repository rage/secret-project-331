use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::{self, AgentChangesetEntity},
    agent_changesets::AgentChangeset,
    error::{TryToOptional, missing_model_error},
    library::{
        agent_changesets::course_state::{CourseParts, ExerciseReviewConfig, load_live_course},
        entity_snapshots::{
            self, ChapterSnapshot, ContentEntity, ContentEntityType, EntityKey, EntitySnapshot,
            PageSnapshot,
        },
    },
    prelude::*,
};

/// What the preview of a staged page, or of a published one, renders.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PagePreview {
    pub course_name: String,
    pub language_code: String,
    /// The page as staged, or as live if the changeset does not change it.
    pub page: PreviewPage,
    /// Whether the page is its chapter's front page, as staged.
    pub is_chapter_front_page: bool,
    /// Whether the preview shows the published course rather than a changeset's staged state.
    pub is_published_state: bool,
    /// The course's references, with the changeset's staged changes applied if there is one.
    pub references: Vec<PreviewReference>,
    /// The pages the link switches between: the changeset's added or changed pages, or all pages
    /// of the course for a published preview. Empty unless the link covers more than one page.
    pub changed_pages: Vec<PreviewPageLink>,
    /// The visible pages of the page's chapter after its front page; filled only for a chapter
    /// front page when the link covers more than one page.
    pub chapter_pages: Vec<PreviewPageLink>,
}

/// A page a preview can switch to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct PreviewPageLink {
    pub id: Uuid,
    pub title: String,
    pub url_path: String,
    pub order_number: i32,
}

/// A bibliography entry the page's citations refer to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct PreviewReference {
    pub citation_key: String,
    pub reference: String,
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

fn find_row(rows: &[AgentChangesetEntity], key: EntityKey) -> Option<&AgentChangesetEntity> {
    rows.iter()
        .find(|row| row.entity_type == key.entity_type && row.entity_id == key.entity_id)
}

/// What a preview link of `page_id` in `changeset` renders. The caller checks that the changeset
/// is the link's user's and that they may still edit its course. Errors with `NotFound` if the
/// changeset is no longer open or if the page does not exist in it or live.
pub async fn resolve_preview(
    conn: &mut PgConnection,
    changeset: &AgentChangeset,
    page_id: Uuid,
) -> ModelResult<PagePreview> {
    ensure_open(changeset)?;
    let rows = agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?;
    render_page(conn, changeset.course_id, &rows, page_id).await
}

/// What a preview link of the published `page_id` of `course_id` renders. The caller checks that
/// the link's user may still edit the course. Errors with `NotFound` if the page is not in the
/// course.
pub async fn resolve_published_preview(
    conn: &mut PgConnection,
    course_id: Uuid,
    page_id: Uuid,
) -> ModelResult<PagePreview> {
    let mut preview = render_page(conn, course_id, &[], page_id).await?;
    preview.is_published_state = true;
    Ok(preview)
}

fn ensure_open(changeset: &AgentChangeset) -> ModelResult<()> {
    if !changeset.is_open() {
        return Err(model_err!(
            NotFound,
            "The changeset of this preview is no longer open".to_string()
        ));
    }
    Ok(())
}

/// The page `page_id` as `staged_rows` leave it over the live course.
async fn render_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    staged_rows: &[AgentChangesetEntity],
    page_id: Uuid,
) -> ModelResult<PagePreview> {
    let staged = find_row(
        staged_rows,
        EntityKey::new(ContentEntityType::Page, page_id),
    );
    let page = match staged {
        Some(entity) => match &entity.after_snapshot {
            Some(EntitySnapshot::Page(page)) => page.clone(),
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
    if page.course_id != course_id {
        return Err(model_err!(NotFound, "Page not found".to_string()));
    }
    let mut page = PreviewPage::from(page);
    if page
        .exercises
        .iter()
        .any(|exercise| exercise.uses_course_default_review_config)
        && let Some(live_default) =
            entity_snapshots::load_course_default_review_config(conn, course_id).await?
    {
        let staged_default = find_row(
            staged_rows,
            EntityKey::new(
                ContentEntityType::CourseDefaultReviewConfig,
                live_default.id,
            ),
        )
        .and_then(|row| match &row.after_snapshot {
            Some(EntitySnapshot::CourseDefaultReviewConfig(config)) => Some(config.clone()),
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
            staged_front_page_id(conn, staged_rows, chapter_id).await? == Some(page.id)
        }
        None => false,
    };
    let course = crate::courses::get_course(conn, course_id).await?;
    let live = load_live_course(conn, &course, CourseParts::Glossary).await?;
    let references = live
        .overlay(staged_rows, CourseParts::Glossary)
        .references
        .into_iter()
        .map(|reference| PreviewReference {
            citation_key: reference.citation_key,
            reference: reference.reference,
        })
        .collect();
    Ok(PagePreview {
        course_name: course.name,
        language_code: course.language_code,
        page,
        is_chapter_front_page,
        is_published_state: false,
        references,
        changed_pages: Vec::new(),
        chapter_pages: Vec::new(),
    })
}

/// The pages `changeset` adds or changes, in the order the staged course structure shows them.
pub async fn changed_page_links(
    conn: &mut PgConnection,
    changeset: &AgentChangeset,
) -> ModelResult<Vec<PreviewPageLink>> {
    let rows = agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?;
    page_links(conn, changeset.course_id, &rows, true).await
}

/// The pages of `course_id` as `staged_rows` leave them, in course order: only those the rows add
/// or change with `only_changed`, else all of them.
async fn page_links(
    conn: &mut PgConnection,
    course_id: Uuid,
    staged_rows: &[AgentChangesetEntity],
    only_changed: bool,
) -> ModelResult<Vec<PreviewPageLink>> {
    let changed: HashSet<Uuid> = staged_rows
        .iter()
        .filter(|row| matches!(row.after_snapshot, Some(EntitySnapshot::Page(_))))
        .map(|row| row.entity_id)
        .collect();
    if only_changed && changed.is_empty() {
        return Ok(Vec::new());
    }
    let course = crate::courses::get_course(conn, course_id).await?;
    let staged = load_live_course(conn, &course, CourseParts::All)
        .await?
        .overlay(staged_rows, CourseParts::All);
    let chapters = staged
        .modules_in_order()
        .into_iter()
        .flat_map(|module| staged.chapters_in_order(module.id))
        .map(|chapter| Some(chapter.id));
    Ok(std::iter::once(None)
        .chain(chapters)
        .flat_map(|chapter_id| staged.pages_in_order(chapter_id))
        .filter(|page| !only_changed || changed.contains(&page.id))
        .map(|page| PreviewPageLink {
            id: page.id,
            title: page.title.clone(),
            url_path: page.url_path.clone(),
            order_number: page.order_number,
        })
        .collect())
}

/// What the preview link of the whole `changeset` renders: `page_id`, or the first changed page
/// without one, with the changed pages to switch between. The caller checks the same things as
/// for [`resolve_preview`]. Errors with `NotFound` also if the changeset changes no pages and
/// `page_id` is `None`.
pub async fn resolve_changeset_preview(
    conn: &mut PgConnection,
    changeset: &AgentChangeset,
    page_id: Option<Uuid>,
) -> ModelResult<PagePreview> {
    ensure_open(changeset)?;
    let rows = agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?;
    render_with_page_links(conn, changeset.course_id, &rows, true, page_id).await
}

/// What the preview link of the whole published course renders: `page_id`, or the first page
/// without one, with all pages to switch between. The caller checks the same things as for
/// [`resolve_published_preview`].
pub async fn resolve_published_course_preview(
    conn: &mut PgConnection,
    course_id: Uuid,
    page_id: Option<Uuid>,
) -> ModelResult<PagePreview> {
    let mut preview = render_with_page_links(conn, course_id, &[], false, page_id).await?;
    preview.is_published_state = true;
    Ok(preview)
}

async fn render_with_page_links(
    conn: &mut PgConnection,
    course_id: Uuid,
    staged_rows: &[AgentChangesetEntity],
    only_changed: bool,
    page_id: Option<Uuid>,
) -> ModelResult<PagePreview> {
    let page_links = page_links(conn, course_id, staged_rows, only_changed).await?;
    let page_id = page_id
        .or_else(|| page_links.first().map(|link| link.id))
        .ok_or_else(missing_model_error(
            ModelErrorType::NotFound,
            "The preview has no pages",
        ))?;
    let mut preview = render_page(conn, course_id, staged_rows, page_id).await?;
    if let (true, Some(chapter_id)) = (preview.is_chapter_front_page, preview.page.chapter_id) {
        let course = crate::courses::get_course(conn, course_id).await?;
        let staged = load_live_course(conn, &course, CourseParts::All)
            .await?
            .overlay(staged_rows, CourseParts::All);
        preview.chapter_pages = staged
            .pages_in_order(Some(chapter_id))
            .into_iter()
            .filter(|page| page.id != page_id && !page.hidden)
            .map(|page| PreviewPageLink {
                id: page.id,
                title: page.title.clone(),
                url_path: page.url_path.clone(),
                order_number: page.order_number,
            })
            .collect();
    }
    preview.changed_pages = page_links;
    Ok(preview)
}

/// The front page of chapter `chapter_id` as `staged_rows` leave it.
async fn staged_front_page_id(
    conn: &mut PgConnection,
    staged_rows: &[AgentChangesetEntity],
    chapter_id: Uuid,
) -> ModelResult<Option<Uuid>> {
    if let Some(row) = find_row(
        staged_rows,
        EntityKey::new(ContentEntityType::Chapter, chapter_id),
    ) {
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
