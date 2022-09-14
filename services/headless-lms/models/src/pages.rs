use std::{
    collections::{hash_map, HashMap},
    time::Duration,
};

use futures::future::OptionFuture;
use headless_lms_utils::document_schema_processor::{
    contains_blocks_not_allowed_in_top_level_pages, GutenbergBlock,
};
use itertools::Itertools;
use url::Url;

use crate::{
    chapters::{
        self, course_chapters, get_chapter, get_chapter_by_page_id, Chapter, DatabaseChapter,
    },
    course_instances::{self, CourseInstance},
    courses::{get_nondeleted_course_id_by_slug, Course},
    exercise_service_info,
    exercise_services::{get_internal_public_spec_url, get_model_solution_url},
    exercise_slides::ExerciseSlide,
    exercise_tasks::ExerciseTask,
    exercises::Exercise,
    page_history::{self, HistoryChangeReason, PageHistoryContent},
    prelude::*,
    user_course_settings::{self, UserCourseSettings},
    CourseOrExamId,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Page {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub chapter_id: Option<Uuid>,
    pub url_path: String,
    pub title: String,
    pub deleted_at: Option<DateTime<Utc>>,
    // should always be a Vec<GutenbergBlock>, but is more convenient to keep as Value for sqlx
    pub content: serde_json::Value,
    pub order_number: i32,
    pub copied_from: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageInfo {
    pub page_id: Uuid,
    pub page_title: String,
    pub course_id: Option<Uuid>,
    pub course_name: Option<String>,
    pub course_slug: Option<String>,
    pub organization_slug: Option<String>,
}

impl Page {
    pub fn blocks_cloned(&self) -> ModelResult<Vec<GutenbergBlock>> {
        serde_json::from_value(self.content.clone()).map_err(Into::into)
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CoursePageWithUserData {
    pub page: Page,
    pub instance: Option<CourseInstance>,
    pub settings: Option<UserCourseSettings>,
    /// If true, the frontend needs to update the url in the browser to match the path in the page object without reloading the page.
    pub was_redirected: bool,
    pub is_test_mode: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageWithExercises {
    #[serde(flatten)]
    pub page: Page,
    pub exercises: Vec<Exercise>,
}

// Represents the subset of page fields that are required to create a new page.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewPage {
    pub exercises: Vec<CmsPageExercise>,
    pub exercise_slides: Vec<CmsPageExerciseSlide>,
    pub exercise_tasks: Vec<CmsPageExerciseTask>,
    // should always be a Vec<GutenbergBlock>, but is more convenient to keep as Value
    pub content: serde_json::Value,
    pub url_path: String,
    pub title: String,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub chapter_id: Option<Uuid>,
    /// If set, set this page to be the front page of this course part.
    pub front_page_of_chapter_id: Option<Uuid>,
    /// Read from the course's settings if None. If course_id is None as well, defaults to "simple"
    pub content_search_language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NormalizedCmsExerciseTask {
    pub id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub private_spec: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageRoutingData {
    pub url_path: String,
    pub title: String,
    pub page_id: Uuid,
    pub chapter_number: i32,
    pub chapter_id: Uuid,
    pub chapter_opens_at: Option<DateTime<Utc>>,
    pub chapter_front_page_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
pub struct PageMetadata {
    pub page_id: Uuid,
    pub order_number: i32,
    pub chapter_id: Option<Uuid>,
    pub chapter_number: Option<i32>,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageChapterAndCourseInformation {
    pub chapter_name: Option<String>,
    pub chapter_number: Option<i32>,
    pub course_name: Option<String>,
    pub course_slug: Option<String>,
    pub chapter_front_page_id: Option<Uuid>,
    pub chapter_front_page_url_path: Option<String>,
    pub organization_slug: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageSearchResult {
    pub id: Uuid,
    pub title_headline: Option<String>,
    pub rank: Option<f32>,
    pub content_headline: Option<String>,
    pub url_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ContentManagementPage {
    pub page: Page,
    pub exercises: Vec<CmsPageExercise>,
    pub exercise_slides: Vec<CmsPageExerciseSlide>,
    pub exercise_tasks: Vec<CmsPageExerciseTask>,
    pub organization_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageSearchRequest {
    query: String,
}
#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageNavigationInformation {
    pub chapter_front_page: Option<PageRoutingData>,
    pub next_page: Option<PageRoutingData>,
    pub previous_page: Option<PageRoutingData>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseWithExerciseTasks {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    course_id: Uuid,
    deleted_at: Option<DateTime<Utc>>,
    name: String,
    deadline: Option<DateTime<Utc>>,
    page_id: Uuid,
    exercise_tasks: Vec<ExerciseTask>,
    score_maximum: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct IsChapterFrontPage {
    pub is_chapter_front_page: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct HistoryRestoreData {
    pub history_id: Uuid,
}

pub async fn insert_course_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    url_path: &str,
    title: &str,
    order_number: i32,
    author: Uuid,
) -> ModelResult<(Uuid, Uuid)> {
    let mut tx = conn.begin().await?;
    let page_res = sqlx::query!(
        "
INSERT INTO pages (
    course_id,
    content,
    url_path,
    title,
    order_number
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
        course_id,
        serde_json::Value::Array(vec![]),
        url_path,
        title,
        order_number
    )
    .fetch_one(&mut tx)
    .await?;
    let history_id = crate::page_history::insert(
        &mut tx,
        page_res.id,
        title,
        &PageHistoryContent {
            content: serde_json::Value::Array(vec![]),
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
        },
        HistoryChangeReason::PageSaved,
        author,
        None,
    )
    .await?;
    tx.commit().await?;
    Ok((page_res.id, history_id))
}

pub async fn insert_exam_page(
    conn: &mut PgConnection,
    exam_id: Uuid,
    page: NewPage,
    author: Uuid,
) -> ModelResult<(Uuid, Uuid)> {
    let mut tx = conn.begin().await?;
    let page_res = sqlx::query!(
        "
INSERT INTO pages (
    exam_id,
    content,
    url_path,
    title,
    order_number
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
        exam_id,
        serde_json::Value::Array(vec![]),
        page.url_path,
        page.title,
        0
    )
    .fetch_one(&mut tx)
    .await?;

    let history_id = crate::page_history::insert(
        &mut tx,
        page_res.id,
        page.title.as_str(),
        &PageHistoryContent {
            content: serde_json::Value::Array(vec![]),
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
        },
        HistoryChangeReason::PageSaved,
        author,
        None,
    )
    .await?;
    tx.commit().await?;
    Ok((page_res.id, history_id))
}

pub async fn set_chapter(
    conn: &mut PgConnection,
    page_id: Uuid,
    chapter_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE pages SET chapter_id = $1 WHERE id = $2",
        chapter_id,
        page_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_course_and_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseOrExamId> {
    let res = sqlx::query!(
        "
SELECT course_id, exam_id
FROM pages
WHERE id = $1
  AND deleted_at IS NULL;
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    CourseOrExamId::from(res.course_id, res.exam_id)
}

pub async fn course_pages(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Vec<Page>> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
FROM pages
WHERE course_id = $1
  AND deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(pages)
}

pub async fn chapter_pages(conn: &mut PgConnection, chapter_id: Uuid) -> ModelResult<Vec<Page>> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
FROM pages
WHERE chapter_id = $1
  AND deleted_at IS NULL;
        ",
        chapter_id
    )
    .fetch_all(conn)
    .await?;
    Ok(pages)
}

pub async fn get_page(conn: &mut PgConnection, page_id: Uuid) -> ModelResult<Page> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
FROM pages
WHERE id = $1;
",
        page_id
    )
    .fetch_one(conn)
    .await?;
    Ok(pages)
}

pub async fn get_page_info(conn: &mut PgConnection, page_id: Uuid) -> ModelResult<PageInfo> {
    let res = sqlx::query_as!(
        PageInfo,
        r#"
    SELECT
        p.id as page_id,
        p.title as page_title,
        c.id as "course_id?",
        c.name as "course_name?",
        c.slug as "course_slug?",
        o.slug as "organization_slug?"
    FROM pages p
    LEFT JOIN courses c
        on c.id = p.course_id
    LEFT JOIN organizations o
        on o.id = c.organization_id
    WHERE p.id = $1;
        "#,
        page_id
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}

async fn get_page_by_path(
    conn: &mut PgConnection,
    course_id: Uuid,
    url_path: &str,
) -> ModelResult<Option<Page>> {
    let page = sqlx::query_as!(
        Page,
        "
SELECT pages.id,
  pages.created_at,
  pages.updated_at,
  pages.course_id,
  pages.exam_id,
  pages.chapter_id,
  pages.url_path,
  pages.title,
  pages.deleted_at,
  pages.content,
  pages.order_number,
  pages.copied_from
FROM pages
WHERE pages.course_id = $1
  AND url_path = $2
  AND pages.deleted_at IS NULL;
        ",
        course_id,
        url_path
    )
    .fetch_optional(conn)
    .await?;
    Ok(page)
}

pub async fn get_page_with_user_data_by_path(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    course_slug: &str,
    url_path: &str,
) -> ModelResult<CoursePageWithUserData> {
    let course_data = get_nondeleted_course_id_by_slug(conn, course_slug).await?;
    let page_option = get_page_by_path(conn, course_data.id, url_path).await?;

    if let Some(page) = page_option {
        return get_course_page_with_user_data_from_selected_page(
            conn,
            user_id,
            page,
            false,
            course_data.is_test_mode,
        )
        .await;
    } else {
        let potential_redirect =
            try_to_find_redirected_page(conn, course_data.id, url_path).await?;
        if let Some(redirected_page) = potential_redirect {
            return get_course_page_with_user_data_from_selected_page(
                conn,
                user_id,
                redirected_page,
                true,
                course_data.is_test_mode,
            )
            .await;
        }
    }

    Err(ModelError::NotFound("Page not found".to_string()))
}

pub async fn try_to_find_redirected_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    url_path: &str,
) -> ModelResult<Option<Page>> {
    let page = sqlx::query_as!(
        Page,
        "
SELECT pages.id,
  pages.created_at,
  pages.updated_at,
  pages.course_id,
  pages.exam_id,
  pages.chapter_id,
  pages.url_path,
  pages.title,
  pages.deleted_at,
  pages.content,
  pages.order_number,
  pages.copied_from
FROM url_redirections
  JOIN pages on pages.id = url_redirections.destination_page_id
WHERE url_redirections.course_id = $1
  AND old_url_path = $2
  AND url_redirections.deleted_at IS NULL
  AND pages.deleted_at IS NULL;
    ",
        course_id,
        url_path
    )
    .fetch_optional(conn)
    .await?;
    Ok(page)
}

pub async fn get_course_page_with_user_data_from_selected_page(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    page: Page,
    was_redirected: bool,
    is_test_mode: bool,
) -> ModelResult<CoursePageWithUserData> {
    if let Some(chapter_id) = page.chapter_id {
        if !crate::chapters::is_open(conn, chapter_id).await? {
            return Err(ModelError::PreconditionFailed(
                "Chapter is not open yet".to_string(),
            ));
        }
    }

    if let Some(course_id) = page.course_id {
        if let Some(user_id) = user_id {
            let instance =
                course_instances::current_course_instance_of_user(conn, user_id, course_id).await?;
            let settings = user_course_settings::get_user_course_settings_by_course_id(
                conn, user_id, course_id,
            )
            .await?;
            return Ok(CoursePageWithUserData {
                page,
                instance,
                settings,
                was_redirected,
                is_test_mode,
            });
        }
    }
    Ok(CoursePageWithUserData {
        page,
        instance: None,
        settings: None,
        was_redirected,
        is_test_mode,
    })
}

pub async fn get_page_with_exercises(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ContentManagementPage> {
    let page = get_page(&mut *conn, id).await?;
    let exercises: Vec<CmsPageExercise> =
        crate::exercises::get_exercises_by_page_id(&mut *conn, page.id)
            .await?
            .into_iter()
            .map(|x| x.into())
            .collect();
    let exercise_slides: Vec<CmsPageExerciseSlide> =
        crate::exercise_slides::get_exercise_slides_by_exercise_ids(
            &mut *conn,
            &exercises.iter().map(|x| x.id).collect::<Vec<Uuid>>(),
        )
        .await?
        .into_iter()
        .map(|x| x.into())
        .collect();
    let exercise_tasks: Vec<CmsPageExerciseTask> =
        crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_ids(
            &mut *conn,
            &exercise_slides.iter().map(|x| x.id).collect::<Vec<Uuid>>(),
        )
        .await?
        .into_iter()
        .map(|x| x.into())
        .collect();
    let organization_id = get_organization_id(&mut *conn, id).await?;
    Ok(ContentManagementPage {
        page,
        exercises,
        exercise_slides,
        exercise_tasks,
        organization_id,
    })
}

pub async fn get_by_exam_id(conn: &mut PgConnection, exam_id: Uuid) -> ModelResult<Page> {
    let res = sqlx::query_as!(
        Page,
        "
SELECT pages.id,
  pages.created_at,
  pages.updated_at,
  pages.course_id,
  pages.exam_id,
  pages.chapter_id,
  pages.url_path,
  pages.title,
  pages.deleted_at,
  pages.content,
  pages.order_number,
  pages.copied_from
FROM pages
WHERE exam_id = $1
AND pages.deleted_at IS NULL
",
        exam_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CmsPageExercise {
    pub id: Uuid,
    pub name: String,
    pub order_number: i32,
    pub score_maximum: i32,
    pub max_tries_per_slide: Option<i32>,
    pub limit_number_of_tries: bool,
    pub deadline: Option<DateTime<Utc>>,
    pub needs_peer_review: bool,
}

impl From<Exercise> for CmsPageExercise {
    fn from(exercise: Exercise) -> Self {
        Self {
            id: exercise.id,
            name: exercise.name,
            order_number: exercise.order_number,
            score_maximum: exercise.score_maximum,
            max_tries_per_slide: exercise.max_tries_per_slide,
            limit_number_of_tries: exercise.limit_number_of_tries,
            deadline: exercise.deadline,
            needs_peer_review: exercise.needs_peer_review,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CmsPageExerciseSlide {
    pub id: Uuid,
    pub exercise_id: Uuid,
    pub order_number: i32,
}

impl From<ExerciseSlide> for CmsPageExerciseSlide {
    fn from(slide: ExerciseSlide) -> Self {
        Self {
            id: slide.id,
            exercise_id: slide.exercise_id,
            order_number: slide.order_number,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CmsPageExerciseTask {
    pub id: Uuid,
    pub exercise_slide_id: Uuid,
    pub assignment: serde_json::Value,
    pub exercise_type: String,
    pub private_spec: Option<serde_json::Value>,
    pub order_number: i32,
}

impl From<ExerciseTask> for CmsPageExerciseTask {
    fn from(task: ExerciseTask) -> Self {
        CmsPageExerciseTask {
            id: task.id,
            exercise_slide_id: task.exercise_slide_id,
            assignment: task.assignment,
            exercise_type: task.exercise_type,
            private_spec: task.private_spec,
            order_number: task.order_number,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CmsPageUpdate {
    pub content: serde_json::Value,
    pub exercises: Vec<CmsPageExercise>,
    pub exercise_slides: Vec<CmsPageExerciseSlide>,
    pub exercise_tasks: Vec<CmsPageExerciseTask>,
    pub url_path: String,
    pub title: String,
    pub chapter_id: Option<Uuid>,
}

impl CmsPageUpdate {
    /// Checks that each exercise has at least one slide and each slide has at least one task.
    pub fn validate_exercise_data(&self) -> ModelResult<()> {
        let mut exercise_ids: HashMap<Uuid, bool> =
            self.exercises.iter().map(|x| (x.id, false)).collect();
        let mut slide_ids = self
            .exercise_slides
            .iter()
            .map(|x| {
                if let hash_map::Entry::Occupied(mut e) = exercise_ids.entry(x.exercise_id) {
                    e.insert(true);
                    Ok((x.id, false))
                } else {
                    Err(ModelError::PreconditionFailed(
                        "Exercide ids in slides don't match.".to_string(),
                    ))
                }
            })
            .collect::<ModelResult<HashMap<Uuid, bool>>>()?;

        if let Some((exercise_id, _)) = exercise_ids.into_iter().find(|(_, x)| !x) {
            return Err(ModelError::PreconditionFailedWithCMSAnchorBlockId {
                id: exercise_id,
                description: "Exercise must have at least one slide.",
            });
        }

        for task in self.exercise_tasks.iter() {
            if let hash_map::Entry::Occupied(mut e) = slide_ids.entry(task.exercise_slide_id) {
                e.insert(true);
            } else {
                return Err(ModelError::PreconditionFailed(
                    "Exercise slide ids in tasks don't match.".to_string(),
                ));
            }
        }
        if let Some((slide_id, _)) = slide_ids.into_iter().find(|(_, x)| !x) {
            return Err(ModelError::PreconditionFailedWithCMSAnchorBlockId {
                id: slide_id,
                description: "Exercise slide must have at least one task.",
            });
        }
        Ok(())
    }
}

pub async fn update_page(
    conn: &mut PgConnection,
    page_id: Uuid,
    page_update: CmsPageUpdate,
    author: Uuid,
    retain_exercise_ids: bool,
    history_change_reason: HistoryChangeReason,
    is_exam_page: bool,
) -> ModelResult<ContentManagementPage> {
    page_update.validate_exercise_data()?;

    let parsed_content: Vec<GutenbergBlock> = serde_json::from_value(page_update.content)?;
    if !is_exam_page
        && page_update.chapter_id.is_none()
        && contains_blocks_not_allowed_in_top_level_pages(&parsed_content)
    {
        return Err(ModelError::Generic(
                "Top level non-exam pages cannot contain exercises, exercise tasks or list of exercises in the chapter".to_string(),
            ));
    }

    let mut tx = conn.begin().await?;

    // Updating page
    let page = sqlx::query_as!(
        Page,
        r"
UPDATE pages
SET content = $2,
  url_path = $3,
  title = $4,
  chapter_id = $5
WHERE id = $1
RETURNING id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
        ",
        page_id,
        serde_json::to_value(parsed_content)?,
        page_update.url_path.trim(),
        page_update.title.trim(),
        page_update.chapter_id
    )
    .fetch_one(&mut tx)
    .await?;

    // Exercises
    let existing_exercise_ids =
        crate::exercises::delete_exercises_by_page_id(&mut tx, page.id).await?;
    let remapped_exercises = upsert_exercises(
        &mut tx,
        &page,
        &existing_exercise_ids,
        &page_update.exercises,
        retain_exercise_ids,
    )
    .await?;

    // Exercise slides
    let existing_exercise_slide_ids =
        crate::exercise_slides::delete_exercise_slides_by_exercise_ids(
            &mut tx,
            &existing_exercise_ids,
        )
        .await?;
    let remapped_exercise_slides = upsert_exercise_slides(
        &mut tx,
        &remapped_exercises,
        &existing_exercise_slide_ids,
        &page_update.exercise_slides,
        retain_exercise_ids,
    )
    .await?;

    // Set as deleted and get existing specs
    let existing_exercise_task_specs = sqlx::query_as!(
        ExerciseTaskIdAndSpec,
        "
UPDATE exercise_tasks
SET deleted_at = now()
WHERE exercise_slide_id = ANY($1)
RETURNING id,
  private_spec,
  public_spec,
  model_solution_spec;
        ",
        &existing_exercise_slide_ids,
    )
    .fetch_all(&mut tx)
    .await?;
    let final_tasks = upsert_exercise_tasks(
        &mut tx,
        &remapped_exercise_slides,
        &existing_exercise_task_specs,
        &page_update.exercise_tasks,
        retain_exercise_ids,
    )
    .await?;

    // Now, we might have changed some of the exercise ids and need to do the same changes in the page content as well
    let new_content = headless_lms_utils::document_schema_processor::remap_ids_in_content(
        &page.content,
        remapped_exercises
            .iter()
            .map(|(id, e)| (*id, e.id))
            .collect::<HashMap<Uuid, Uuid>>(),
    )?;

    let page = sqlx::query_as!(
        Page,
        "
UPDATE pages
SET content = $1
WHERE id = $2
RETURNING id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from;
        ",
        new_content,
        page.id
    )
    .fetch_one(&mut tx)
    .await?;

    let final_exercises: Vec<CmsPageExercise> = remapped_exercises.into_values().collect();
    let final_slides: Vec<CmsPageExerciseSlide> = remapped_exercise_slides.into_values().collect();
    let history_content = PageHistoryContent {
        content: page.content.clone(),
        exercises: final_exercises,
        exercise_slides: final_slides,
        exercise_tasks: final_tasks,
    };
    crate::page_history::insert(
        &mut tx,
        page_id,
        &page_update.title,
        &history_content,
        history_change_reason,
        author,
        None,
    )
    .await?;
    let organization_id = get_organization_id(&mut tx, page.id).await?;

    tx.commit().await?;

    Ok(ContentManagementPage {
        page,
        exercises: history_content.exercises,
        exercise_slides: history_content.exercise_slides,
        exercise_tasks: history_content.exercise_tasks,
        organization_id,
    })
}

/// Remaps ids from updates to exercises that may have their ids regenerated.
async fn upsert_exercises(
    conn: &mut PgConnection,
    page: &Page,
    existing_exercise_ids: &[Uuid],
    exercise_updates: &[CmsPageExercise],
    retain_exercise_ids: bool,
) -> ModelResult<HashMap<Uuid, CmsPageExercise>> {
    let mut remapped_exercises = HashMap::new();
    for exercise_update in exercise_updates.iter() {
        let exercise_exists = existing_exercise_ids
            .iter()
            .any(|id| *id == exercise_update.id);
        let safe_for_db_exercise_id = if retain_exercise_ids || exercise_exists {
            exercise_update.id
        } else {
            Uuid::new_v4()
        };

        let exercise = sqlx::query_as!(
            CmsPageExercise,
            "
INSERT INTO exercises(
    id,
    course_id,
    name,
    order_number,
    page_id,
    chapter_id,
    exam_id,
    score_maximum,
    max_tries_per_slide,
    limit_number_of_tries,
    deadline,
    needs_peer_review
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12
  ) ON CONFLICT (id) DO
UPDATE
SET course_id = $2,
  name = $3,
  order_number = $4,
  page_id = $5,
  chapter_id = $6,
  exam_id = $7,
  score_maximum = $8,
  max_tries_per_slide = $9,
  limit_number_of_tries = $10,
  deadline = $11,
  needs_peer_review = $12,
  deleted_at = NULL
RETURNING id,
  name,
  order_number,
  score_maximum,
  max_tries_per_slide,
  limit_number_of_tries,
  deadline,
  needs_peer_review
            ",
            safe_for_db_exercise_id,
            page.course_id,
            exercise_update.name,
            exercise_update.order_number,
            page.id,
            page.chapter_id,
            page.exam_id,
            exercise_update.score_maximum,
            exercise_update.max_tries_per_slide,
            exercise_update.limit_number_of_tries,
            exercise_update.deadline,
            exercise_update.needs_peer_review,
        )
        .fetch_one(&mut *conn)
        .await?;
        remapped_exercises.insert(exercise_update.id, exercise);
    }
    Ok(remapped_exercises)
}

/// Remaps ids from updates to exercise slides that may have their ids changed.
async fn upsert_exercise_slides(
    conn: &mut PgConnection,
    remapped_exercises: &HashMap<Uuid, CmsPageExercise>,
    existing_slide_ids: &[Uuid],
    slide_updates: &[CmsPageExerciseSlide],
    retain_exercise_ids: bool,
) -> ModelResult<HashMap<Uuid, CmsPageExerciseSlide>> {
    let mut remapped_exercise_slides = HashMap::new();
    for slide_update in slide_updates.iter() {
        let slide_exists = existing_slide_ids.iter().any(|id| *id == slide_update.id);
        let safe_for_db_slide_id = if retain_exercise_ids || slide_exists {
            slide_update.id
        } else {
            Uuid::new_v4()
        };
        let safe_for_db_exercise_id = remapped_exercises
            .get(&slide_update.exercise_id)
            .ok_or_else(|| {
                ModelError::PreconditionFailed(
                    "Illegal exercise id for exercise slide.".to_string(),
                )
            })?
            .id;

        let exercise_slide = sqlx::query_as!(
            CmsPageExerciseSlide,
            "
INSERT INTO exercise_slides (id, exercise_id, order_number)
VALUES ($1, $2, $3) ON CONFLICT (id) DO
UPDATE
SET exercise_id = $2,
  order_number = $3,
  deleted_at = NULL
RETURNING id,
  exercise_id,
  order_number;
            ",
            safe_for_db_slide_id,
            safe_for_db_exercise_id,
            slide_update.order_number,
        )
        .fetch_one(&mut *conn)
        .await?;

        remapped_exercise_slides.insert(slide_update.id, exercise_slide);
    }
    Ok(remapped_exercise_slides)
}

/// Remaps ids from updates to exercise tasks that may have their ids changed.
async fn upsert_exercise_tasks(
    conn: &mut PgConnection,
    remapped_slides: &HashMap<Uuid, CmsPageExerciseSlide>,
    existing_task_specs: &[ExerciseTaskIdAndSpec],
    task_updates: &[CmsPageExerciseTask],
    retain_exercise_ids: bool,
) -> ModelResult<Vec<CmsPageExerciseTask>> {
    // For generating public specs for exercises.
    let client = reqwest::Client::new();
    let exercise_types: Vec<String> = task_updates
        .iter()
        .map(|task| task.exercise_type.clone())
        .unique()
        .collect();
    let exercise_service_hashmap =
        exercise_service_info::get_selected_exercise_services_by_type(&mut *conn, &exercise_types)
            .await?;
    let public_spec_urls_by_exercise_type = exercise_service_hashmap
        .iter()
        .map(|(key, (service, info))| Ok((key, get_internal_public_spec_url(service, info)?)))
        .collect::<ModelResult<HashMap<&String, Url>>>()?;
    let model_solution_urls_by_exercise_type = exercise_service_hashmap
        .iter()
        .map(|(key, (service, info))| Ok((key, get_model_solution_url(service, info)?)))
        .collect::<ModelResult<HashMap<&String, Url>>>()?;

    let mut remapped_exercise_tasks = Vec::new();
    for task_update in task_updates.iter() {
        let existing_exercise_task = existing_task_specs.iter().find(|o| o.id == task_update.id);
        let safe_for_db_exercise_task_id = match existing_exercise_task {
            Some(_) => task_update.id,
            _ if retain_exercise_ids => task_update.id,
            None => Uuid::new_v4(),
        };

        let task_exists = existing_task_specs
            .iter()
            .any(|task| task.id == task_update.id);
        let safe_for_db_task_id = if retain_exercise_ids || task_exists {
            task_update.id
        } else {
            Uuid::new_v4()
        };
        let normalized_task = NormalizedCmsExerciseTask {
            id: safe_for_db_task_id,
            assignment: task_update.assignment.clone(),
            exercise_type: task_update.exercise_type.clone(),
            private_spec: task_update.private_spec.clone(),
        };
        let model_solution_spec = fetch_derived_spec(
            existing_exercise_task,
            &normalized_task,
            &model_solution_urls_by_exercise_type,
            &client,
            existing_exercise_task.and_then(|value| value.model_solution_spec.clone()),
            task_update.id,
        )
        .await?;
        let public_spec: Option<serde_json::Value> = fetch_derived_spec(
            existing_exercise_task,
            &normalized_task,
            &public_spec_urls_by_exercise_type,
            &client,
            existing_exercise_task.and_then(|value| value.public_spec.clone()),
            task_update.id,
        )
        .await?;
        let safe_for_db_exercise_slide_id = remapped_slides
            .get(&task_update.exercise_slide_id)
            .ok_or_else(|| {
                ModelError::PreconditionFailed(
                    "Illegal exercise slide id for exercise task.".to_string(),
                )
            })?
            .id;

        // Upsert
        let exercise_task = sqlx::query_as!(
            CmsPageExerciseTask,
            "
INSERT INTO exercise_tasks(
    id,
    exercise_slide_id,
    exercise_type,
    assignment,
    public_spec,
    private_spec,
    model_solution_spec,
    order_number
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO
UPDATE
SET exercise_slide_id = $2,
  exercise_type = $3,
  assignment = $4,
  public_spec = $5,
  private_spec = $6,
  model_solution_spec = $7,
  order_number = $8,
  deleted_at = NULL
RETURNING id,
  exercise_slide_id,
  assignment,
  exercise_type,
  private_spec,
  order_number
                ",
            safe_for_db_exercise_task_id,
            safe_for_db_exercise_slide_id,
            task_update.exercise_type,
            task_update.assignment,
            public_spec,
            task_update.private_spec,
            model_solution_spec,
            task_update.order_number,
        )
        .fetch_one(&mut *conn)
        .await?;
        remapped_exercise_tasks.push(exercise_task)
    }
    Ok(remapped_exercise_tasks)
}

/// Only used when testing.
pub async fn update_page_content(
    conn: &mut PgConnection,
    page_id: Uuid,
    content: &serde_json::Value,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE pages
SET content = $1
WHERE id = $2;
",
        content,
        page_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug)]
struct ExerciseTaskIdAndSpec {
    pub id: Uuid,
    pub private_spec: Option<serde_json::Value>,
    pub public_spec: Option<serde_json::Value>,
    pub model_solution_spec: Option<serde_json::Value>,
}

async fn fetch_derived_spec(
    existing_exercise_task: Option<&ExerciseTaskIdAndSpec>,
    task_update: &NormalizedCmsExerciseTask,
    urls_by_exercise_type: &HashMap<&String, Url>,
    client: &reqwest::Client,
    previous_spec: Option<serde_json::Value>,
    cms_block_id: Uuid,
) -> Result<Option<serde_json::Value>, ModelError> {
    let result_spec: Option<serde_json::Value> = match existing_exercise_task {
        Some(exercise_task) if exercise_task.private_spec == task_update.private_spec => {
            // Skip generating public spec for an existing exercise again if private spec is still the same.
            previous_spec
        }
        _ => {
            let url = urls_by_exercise_type
                .get(&task_update.exercise_type)
                .ok_or(ModelError::PreconditionFailedWithCMSAnchorBlockId {
                    id: cms_block_id,
                    description: "Missing exercise type for exercise task.",
                })?
                .clone();
            let res = client
                .post(url)
                .timeout(Duration::from_secs(120))
                .json(&task_update.private_spec)
                .send()
                .await?;
            if !res.status().is_success() {
                let error = res.text().await.unwrap_or_default();
                return Err(ModelError::Generic(format!(
                    "Failed to generate spec for exercise: {}.",
                    error,
                )));
            }
            Some(res.json::<serde_json::Value>().await?)
        }
    };
    Ok(result_spec)
}

pub async fn insert_new_content_page(
    conn: &mut PgConnection,
    new_page: NewPage,
    user: Uuid,
) -> ModelResult<Page> {
    let mut tx = conn.begin().await?;

    let course_material_content = serde_json::to_value(vec![GutenbergBlock::hero_section(
        new_page.title.trim(),
        "",
    )])?;

    let content_page = NewPage {
        chapter_id: new_page.chapter_id,
        content: course_material_content,
        course_id: new_page.course_id,
        exam_id: None,
        front_page_of_chapter_id: None,
        title: new_page.title,
        url_path: new_page.url_path,
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content_search_language: None,
    };
    let page = crate::pages::insert_page(&mut tx, content_page, user).await?;

    tx.commit().await?;
    Ok(page)
}

pub async fn insert_page(
    conn: &mut PgConnection,
    new_page: NewPage,
    author: Uuid,
) -> ModelResult<Page> {
    let next_order_number = match (new_page.chapter_id, new_page.course_id) {
        (Some(id), _) => get_next_page_order_number_in_chapter(conn, id).await?,
        (None, Some(course_id)) => {
            get_next_order_number_for_courses_top_level_pages(conn, course_id).await?
        }
        (None, None) => 1,
    };
    let course: OptionFuture<_> = new_page
        .course_id
        .map(|id| crate::courses::get_course(conn, id))
        .into();
    let course = course.await.transpose()?;

    let mut tx = conn.begin().await?;

    let content_search_language = course
        .and_then(|c| c.content_search_language)
        .or(new_page.content_search_language)
        .unwrap_or_else(|| "simple".to_string());

    let page = sqlx::query_as!(
        Page,
        r#"
INSERT INTO pages(
    course_id,
    exam_id,
    content,
    url_path,
    title,
    order_number,
    chapter_id,
    content_search_language
  )
VALUES($1, $2, $3, $4, $5, $6, $7, $8::regconfig)
RETURNING id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
          "#,
        new_page.course_id,
        new_page.exam_id,
        new_page.content,
        new_page.url_path.trim(),
        new_page.title.trim(),
        next_order_number,
        new_page.chapter_id,
        content_search_language as _
    )
    .fetch_one(&mut tx)
    .await?;

    let cms_page = update_page(
        &mut tx,
        page.id,
        CmsPageUpdate {
            content: page.content,
            exercises: new_page.exercises,
            exercise_slides: new_page.exercise_slides,
            exercise_tasks: new_page.exercise_tasks,
            url_path: page.url_path,
            title: page.title,
            chapter_id: page.chapter_id,
        },
        author,
        false,
        HistoryChangeReason::PageSaved,
        new_page.exam_id.is_some(),
    )
    .await?;

    if let Some(front_page_of_chapter_id) = new_page.front_page_of_chapter_id {
        let _res = sqlx::query_as!(
            DatabaseChapter,
            r#"
UPDATE chapters
SET front_page_id = $1
WHERE id = $2
RETURNING *;
        "#,
            page.id,
            front_page_of_chapter_id
        )
        // this should fail if no rows returned
        .fetch_one(&mut tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Page {
        content: cms_page.page.content,
        course_id: page.course_id,
        exam_id: page.exam_id,
        created_at: page.created_at,
        updated_at: page.updated_at,
        deleted_at: page.deleted_at,
        id: page.id,
        title: cms_page.page.title,
        url_path: cms_page.page.url_path,
        order_number: page.order_number,
        chapter_id: page.chapter_id,
        copied_from: page.copied_from,
    })
}

pub async fn delete_page_and_exercises(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Page> {
    let mut tx = conn.begin().await?;
    let page = sqlx::query_as!(
        Page,
        r#"
UPDATE pages
SET deleted_at = now()
WHERE id = $1
RETURNING id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
          "#,
        page_id,
    )
    .fetch_one(&mut tx)
    .await?;

    sqlx::query!(
        r#"
  UPDATE exercises
  SET deleted_at = now()
  WHERE page_id = $1
          "#,
        page_id,
    )
    .execute(&mut tx)
    .await?;

    sqlx::query!(
        "
UPDATE exercise_slides
SET deleted_at = now()
WHERE exercise_id IN (
    SELECT id
    FROM exercises
    WHERE page_id = $1
  );
        ",
        page.id
    )
    .execute(&mut tx)
    .await?;

    sqlx::query!(
        r#"
UPDATE exercise_tasks
SET deleted_at = now()
WHERE exercise_slide_id IN (
    SELECT s.id
    FROM exercise_slides s
      JOIN exercises e ON (s.exercise_id = e.id)
    WHERE e.page_id = $1
  );
            "#,
        page.id
    )
    .execute(&mut tx)
    .await?;

    tx.commit().await?;
    Ok(page)
}

pub async fn get_chapters_pages_with_exercises(
    conn: &mut PgConnection,
    chapters_id: Uuid,
) -> ModelResult<Vec<PageWithExercises>> {
    let chapter_pages = sqlx::query_as!(
        Page,
        r#"
SELECT id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
FROM pages
WHERE chapter_id = $1
  AND deleted_at IS NULL
        "#,
        chapters_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let page_ids: Vec<Uuid> = chapter_pages.iter().map(|page| page.id).collect();
    let pages_exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
FROM exercises
WHERE page_id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND deleted_at IS NULL
        "#,
        &page_ids
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut page_to_exercises: HashMap<Uuid, Vec<Exercise>> = pages_exercises
        .into_iter()
        .into_group_map_by(|exercise| exercise.page_id);
    let mut chapter_pages_with_exercises: Vec<PageWithExercises> = chapter_pages
        .into_iter()
        .map(|page| {
            let page_id = page.id;
            let mut exercises = match page_to_exercises.remove(&page_id) {
                Some(ex) => ex,
                None => Vec::new(),
            };

            exercises.sort_by(|a, b| a.order_number.cmp(&b.order_number));
            PageWithExercises { page, exercises }
        })
        .collect();

    chapter_pages_with_exercises.sort_by(|a, b| a.page.order_number.cmp(&b.page.order_number));

    Ok(chapter_pages_with_exercises)
}

pub async fn get_next_page(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Option<PageRoutingData>> {
    let page_metadata = get_current_page_metadata(conn, page_id).await?;
    let next_page = get_next_page_by_order_number(conn, &page_metadata).await?;

    match next_page {
        Some(next_page) => Ok(Some(next_page)),
        None => {
            let first_page = get_next_page_by_chapter_number(conn, &page_metadata).await?;
            Ok(first_page)
        }
    }
}

async fn get_current_page_metadata(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<PageMetadata> {
    let page_metadata = sqlx::query_as!(
        PageMetadata,
        r#"
SELECT p.id as page_id,
  p.order_number as order_number,
  p.course_id as course_id,
  p.exam_id as exam_id,
  c.id as "chapter_id?",
  c.chapter_number as "chapter_number?"
FROM pages p
  LEFT JOIN chapters c ON p.chapter_id = c.id
WHERE p.id = $1;
"#,
        page_id
    )
    .fetch_one(conn)
    .await?;

    if page_metadata.chapter_number.is_none() {
        return Err(ModelError::InvalidRequest(
            "Page is not related to any chapter".to_string(),
        ));
    }

    Ok(page_metadata)
}

async fn get_next_page_by_order_number(
    conn: &mut PgConnection,
    current_page_metadata: &PageMetadata,
) -> ModelResult<Option<PageRoutingData>> {
    let next_page = sqlx::query_as!(
        PageRoutingData,
        "
SELECT p.url_path as url_path,
  p.title as title,
  p.id as page_id,
  c.chapter_number as chapter_number,
  c.id as chapter_id,
  c.opens_at as chapter_opens_at,
  c.front_page_id as chapter_front_page_id
FROM pages p
  LEFT JOIN chapters c ON p.chapter_id = c.id
WHERE p.order_number = (
    SELECT MIN(pa.order_number)
    FROM pages pa
    WHERE pa.order_number > $1
      AND pa.deleted_at IS NULL
  )
  AND p.course_id = $2
  AND c.chapter_number = $3
  AND p.deleted_at IS NULL;
        ",
        current_page_metadata.order_number,
        current_page_metadata.course_id,
        current_page_metadata.chapter_number
    )
    .fetch_optional(conn)
    .await?;

    Ok(next_page)
}

async fn get_next_page_by_chapter_number(
    conn: &mut PgConnection,
    current_page_metadata: &PageMetadata,
) -> ModelResult<Option<PageRoutingData>> {
    let next_page = sqlx::query_as!(
        PageRoutingData,
        "
SELECT p.url_path as url_path,
  p.title as title,
  p.id as page_id,
  c.chapter_number as chapter_number,
  c.id as chapter_id,
  c.opens_at as chapter_opens_at,
  c.front_page_id as chapter_front_page_id
FROM chapters c
  INNER JOIN pages p on c.id = p.chapter_id
WHERE c.chapter_number = (
    SELECT MIN(ca.chapter_number)
    FROM chapters ca
    WHERE ca.chapter_number > $1
      AND ca.deleted_at IS NULL
  )
  AND c.course_id = $2
  AND p.deleted_at IS NULL
ORDER BY p.order_number
LIMIT 1;
        ",
        current_page_metadata.chapter_number,
        current_page_metadata.course_id
    )
    .fetch_optional(conn)
    .await?;

    Ok(next_page)
}

async fn get_next_page_order_number_in_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<i32> {
    let next_order_number = sqlx::query!(
        "
select max(p.order_number) as order_number
from pages p
where p.chapter_id = $1
  and p.deleted_at is null;
",
        chapter_id
    )
    .fetch_one(conn)
    .await?;

    match next_order_number.order_number {
        Some(order_number) => Ok(order_number + 1),
        None => Ok(0),
    }
}

pub async fn get_page_navigation_data(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<PageNavigationInformation> {
    let previous_page_data = get_previous_page(conn, page_id).await?;

    let next_page_data = get_next_page(conn, page_id).await?;

    let chapter_front_page = get_chapter_front_page_by_page_id(conn, page_id).await?;
    // This may be different from the chapter of the previous page and the chapter of the next page so we need to fetch it to be sure.
    let chapter_front_page_chapter = OptionFuture::from(
        chapter_front_page
            .clone()
            .and_then(|front_page| front_page.chapter_id)
            .map(|chapter_id| chapters::get_chapter(conn, chapter_id)),
    )
    .await
    .transpose()?;

    let chapter_front_page_data = chapter_front_page
        .map(|front_page| -> ModelResult<_> {
            if let Some(chapter_front_page_chapter) = chapter_front_page_chapter {
                Ok(PageRoutingData {
                    url_path: front_page.url_path,
                    title: front_page.title,
                    page_id: front_page.id,
                    chapter_number: chapter_front_page_chapter.chapter_number,
                    chapter_id: chapter_front_page_chapter.id,
                    chapter_opens_at: chapter_front_page_chapter.opens_at,
                    chapter_front_page_id: Some(front_page.id),
                })
            } else {
                Err(ModelError::InvalidRequest(
                    "Chapter front page chapter not found".to_string(),
                ))
            }
        })
        .transpose()?;
    Ok(PageNavigationInformation {
        chapter_front_page: chapter_front_page_data,
        next_page: next_page_data,
        previous_page: previous_page_data,
    })
}

pub async fn get_previous_page(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Option<PageRoutingData>> {
    let page_metadata = get_current_page_metadata(conn, page_id).await?;
    let previous_page = get_previous_page_by_order_number(conn, &page_metadata).await?;

    match previous_page {
        Some(previous_page) => Ok(Some(previous_page)),
        None => {
            let first_page = get_previous_page_by_chapter_number(conn, &page_metadata).await?;
            Ok(first_page)
        }
    }
}

pub async fn get_chapter_front_page_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Option<Page>> {
    let page_metadata = get_current_page_metadata(conn, page_id).await?;
    let chapter = chapters::get_chapter_info_by_page_metadata(conn, &page_metadata).await?;
    let page_option_future: OptionFuture<_> = chapter
        .chapter_front_page_id
        .map(|chapter_front_page_id| get_page(conn, chapter_front_page_id))
        .into();
    let page = page_option_future.await.transpose()?;
    Ok(page)
}

async fn get_previous_page_by_order_number(
    conn: &mut PgConnection,
    current_page_metadata: &PageMetadata,
) -> ModelResult<Option<PageRoutingData>> {
    let previous_page = sqlx::query_as!(
        PageRoutingData,
        "
SELECT p.url_path as url_path,
  p.title as title,
  c.chapter_number as chapter_number,
  p.id as page_id,
  c.id as chapter_id,
  c.opens_at as chapter_opens_at,
  c.front_page_id as chapter_front_page_id
FROM pages p
  LEFT JOIN chapters c ON p.chapter_id = c.id
WHERE p.order_number = (
    SELECT MAX(pa.order_number)
    FROM pages pa
    WHERE pa.order_number < $1
      AND pa.deleted_at IS NULL
  )
  AND p.course_id = $2
  AND c.chapter_number = $3
  AND p.deleted_at IS NULL;
        ",
        current_page_metadata.order_number,
        current_page_metadata.course_id,
        current_page_metadata.chapter_number
    )
    .fetch_optional(conn)
    .await?;

    Ok(previous_page)
}

async fn get_previous_page_by_chapter_number(
    conn: &mut PgConnection,
    current_page_metadata: &PageMetadata,
) -> ModelResult<Option<PageRoutingData>> {
    let previous_page = sqlx::query_as!(
        PageRoutingData,
        "
SELECT p.url_path as url_path,
  p.title as title,
  p.id as page_id,
  c.chapter_number as chapter_number,
  c.id as chapter_id,
  c.opens_at as chapter_opens_at,
  c.front_page_id as chapter_front_page_id
FROM chapters c
  INNER JOIN pages p on c.id = p.chapter_id
WHERE c.chapter_number = (
    SELECT MAX(ca.chapter_number)
    FROM chapters ca
    WHERE ca.chapter_number < $1
      AND ca.deleted_at IS NULL
  )
  AND c.course_id = $2
  AND p.deleted_at IS NULL
ORDER BY p.order_number
LIMIT 1;
        ",
        current_page_metadata.chapter_number,
        current_page_metadata.course_id
    )
    .fetch_optional(conn)
    .await?;

    Ok(previous_page)
}

async fn get_next_order_number_for_courses_top_level_pages(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<i32> {
    let next_order_number = sqlx::query!(
        "
select max(p.order_number) as order_number
from pages p
where p.course_id = $1
  and p.chapter_id is null
  and p.deleted_at is null;
",
        course_id
    )
    .fetch_one(conn)
    .await?;

    match next_order_number.order_number {
        Some(order_number) => Ok(order_number + 1),
        None => Ok(0),
    }
}

pub async fn get_chapter_pages(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<Vec<Page>> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
FROM pages p
WHERE p.chapter_id = $1
  AND p.deleted_at IS NULL;
    ",
        chapter_id
    )
    .fetch_all(conn)
    .await?;

    Ok(pages)
}

pub async fn get_chapters_pages_exclude_main_frontpage(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<Vec<Page>> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
FROM pages p
WHERE p.chapter_id = $1
  AND p.deleted_at IS NULL
  AND p.id NOT IN (
    SELECT front_page_id
    FROM chapters c
    WHERE c.front_page_id = p.id
  );
    ",
        chapter_id
    )
    .fetch_all(conn)
    .await?;

    Ok(pages)
}

/**
Returns search results for a phrase i.e. looks for matches where the words come up right after each other
*/
pub async fn get_page_search_results_for_phrase(
    conn: &mut PgConnection,
    course_id: Uuid,
    page_search_request: &PageSearchRequest,
) -> ModelResult<Vec<PageSearchResult>> {
    let course = crate::courses::get_course(&mut *conn, course_id).await?;

    // Last word of the search term needed so that the sql statement can change it to a prefix match.
    // Allows the last word to not be fully typed.
    let last_word = if let Some(last) = page_search_request
        .query
        .trim()
        .split_ascii_whitespace()
        .last()
    {
        last
    } else {
        return Ok(Vec::new());
    };

    let res =   sqlx::query_as!(
            PageSearchResult,
            "
-- common table expression for the search term tsquery so that we don't have to repeat it many times
WITH cte as (
    -- Converts the search term to a phrase search with phraseto_tsquery but appends ':*' to the last word so that it
    -- becomes a prefix match. This way the search will also contain results when the last word in the search term
    -- is only partially typed. Note that if to_tsquery($4) decides to stem the word, the replacement will be skipped.
    SELECT ts_rewrite(
        phraseto_tsquery($2::regconfig, $3),
        to_tsquery($4),
        to_tsquery($4 || ':*')
    ) as query
)
SELECT id,
    ts_rank(
    content_search,
    (
        SELECT query
        from cte
    )
    ) as rank,
    ts_headline(
    $2::regconfig,
    title,
    (
        SELECT query
        from cte
    )
    ) as title_headline,
    ts_headline(
    $2::regconfig,
    content_search_original_text,
    (
        SELECT query
        from cte
    )
    ) as content_headline,
    url_path
FROM pages
WHERE course_id = $1
    AND deleted_at IS NULL
    AND content_search @@ (
    SELECT query
    from cte
    )
ORDER BY rank DESC
LIMIT 50;
        ",
            course_id,
            course.content_search_language as _,
            page_search_request.query,
            last_word
        )
        .fetch_all(conn)
        .await?;

    Ok(add_course_url_prefix_to_search_results(res, &course))
}

/**
Returns search results for the given words. The words can appear in the source document in any order.
*/
pub async fn get_page_search_results_for_words(
    conn: &mut PgConnection,
    course_id: Uuid,
    page_search_request: &PageSearchRequest,
) -> ModelResult<Vec<PageSearchResult>> {
    let course = crate::courses::get_course(&mut *conn, course_id).await?;

    // Last word of the search term needed so that the sql statement can change it to a prefix match.
    // Allows the last word to not be fully typed.
    let last_word = if let Some(last) = page_search_request
        .query
        .trim()
        .split_ascii_whitespace()
        .last()
    {
        last
    } else {
        return Ok(Vec::new());
    };

    let res = sqlx::query_as!(
            PageSearchResult,
            "
-- common table expression for the search term tsquery so that we don't have to repeat it many times
WITH cte as (
    -- Converts the search term to a word search with ands between the words with plainto_tsquery but appends ':*' to the
    -- last word so that it  becomes a prefix match. This way the search will also contain results when the last word in
    -- the search term is only partially typed. Note that if to_tsquery($4) decides to stem the word, the replacement
    -- will be skipped.
    SELECT ts_rewrite(
        plainto_tsquery($2::regconfig, $3),
        to_tsquery($4),
        to_tsquery($4 || ':*')
    ) as query
)
SELECT id,
    ts_rank(
    content_search,
    (
        SELECT query
        from cte
    )
    ) as rank,
    ts_headline(
    $2::regconfig,
    title,
    (
        SELECT query
        from cte
    )
    ) as title_headline,
    ts_headline(
    $2::regconfig,
    content_search_original_text,
    (
        SELECT query
        from cte
    )
    ) as content_headline,
    url_path
FROM pages
WHERE course_id = $1
    AND deleted_at IS NULL
    AND content_search @@ (
    SELECT query
    from cte
    )
ORDER BY rank DESC
LIMIT 50;
        ",
            course_id,
            course.content_search_language as _,
            page_search_request.query,
            last_word
        )
        .fetch_all(conn)
        .await?;

    Ok(add_course_url_prefix_to_search_results(res, &course))
}

fn add_course_url_prefix_to_search_results(
    search_results: Vec<PageSearchResult>,
    course: &Course,
) -> Vec<PageSearchResult> {
    search_results
        .into_iter()
        .map(|mut sr| {
            let optional_slash = if sr.url_path.starts_with('/') {
                ""
            } else {
                "/"
            };
            sr.url_path = format!("/{}{}{}", course.slug, optional_slash, sr.url_path);
            sr
        })
        .collect()
}

/// Restore page contents and exercises to a previous revision
pub async fn restore(
    conn: &mut PgConnection,
    page_id: Uuid,
    history_id: Uuid,
    author: Uuid,
) -> ModelResult<Uuid> {
    // fetch old content
    let page = get_page(conn, page_id).await?;
    let history_data = page_history::get_history_data(conn, history_id).await?;

    update_page(
        conn,
        page.id,
        CmsPageUpdate {
            content: history_data.content.content,
            exercises: history_data.content.exercises,
            exercise_slides: history_data.content.exercise_slides,
            exercise_tasks: history_data.content.exercise_tasks,
            url_path: page.url_path,
            title: history_data.title,
            chapter_id: page.chapter_id,
        },
        author,
        true,
        HistoryChangeReason::HistoryRestored,
        history_data.exam_id.is_some(),
    )
    .await?;

    Ok(history_id)
}

pub async fn get_organization_id(conn: &mut PgConnection, page_id: Uuid) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
SELECT organizations.id
FROM pages
  LEFT OUTER JOIN courses ON courses.id = pages.course_id
  LEFT OUTER JOIN exams ON exams.id = pages.exam_id
  JOIN organizations ON organizations.id = courses.organization_id
  OR organizations.id = exams.organization_id
WHERE pages.id = $1
",
        page_id,
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(res.id)
}

pub async fn get_page_chapter_and_course_information(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<PageChapterAndCourseInformation> {
    let res = sqlx::query_as!(
        PageChapterAndCourseInformation,
        r#"
SELECT chapters.name as "chapter_name?",
  chapters.chapter_number as "chapter_number?",
  courses.name as "course_name?",
  courses.slug as "course_slug?",
  chapters.front_page_id as "chapter_front_page_id?",
  p2.url_path as "chapter_front_page_url_path?",
  organizations.slug as organization_slug
FROM pages
  LEFT JOIN chapters on pages.chapter_id = chapters.id
  LEFT JOIN courses on pages.course_id = courses.id
  LEFT JOIN pages p2 ON chapters.front_page_id = p2.id
  LEFT JOIN organizations on courses.organization_id = organizations.id
WHERE pages.id = $1
"#,
        page_id,
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(res)
}

/// Makes the order numbers and chapter ids to match in the db what's in the page objects
/// Assumes that all pages belong to the given course id
pub async fn reorder_pages(
    conn: &mut PgConnection,
    pages: &[Page],
    course_id: Uuid,
) -> ModelResult<()> {
    let db_pages = course_pages(conn, course_id).await?;
    let chapters = course_chapters(conn, course_id).await?;
    let mut tx = conn.begin().await?;
    for page in pages {
        if let Some(matching_db_page) = db_pages.iter().find(|p| p.id == page.id) {
            if matching_db_page.chapter_id == page.chapter_id {
                // Chapter not changing
                // Avoid conflicts in order_number since unique indexes cannot be deferred. The random number will not end up committing in the transaction since the loop goes through all the pages and will correct the number.
                sqlx::query!(
                    "UPDATE pages
SET order_number = floor(random() * (2000000 -200000 + 1) + 200000)
WHERE pages.order_number = $1
  AND pages.chapter_id = $2
  AND deleted_at IS NULL",
                    page.order_number,
                    page.chapter_id
                )
                .execute(&mut tx)
                .await?;
                sqlx::query!(
                    "UPDATE pages SET order_number = $2 WHERE pages.id = $1",
                    page.id,
                    page.order_number
                )
                .execute(&mut tx)
                .await?;
            } else {
                // Chapter changes
                if let Some(old_chapter_id) = matching_db_page.chapter_id {
                    if let Some(new_chapter_id) = page.chapter_id {
                        // Moving page to another chapter
                        if let Some(old_chapter) = chapters.iter().find(|o| o.id == old_chapter_id)
                        {
                            if let Some(new_chapter) =
                                chapters.iter().find(|o| o.id == new_chapter_id)
                            {
                                let old_path = &page.url_path;
                                let new_path = old_path.replacen(
                                    &old_chapter.chapter_number.to_string(),
                                    &new_chapter.chapter_number.to_string(),
                                    1,
                                );
                                sqlx::query!(
                                    "UPDATE pages SET url_path = $2, chapter_id = $3, order_number = $4 WHERE pages.id = $1",
                                    page.id,
                                    new_path,
                                    new_chapter.id,
                                    page.order_number
                                )
                                .execute(&mut tx)
                                .await?;
                                sqlx::query!(
                                    "INSERT INTO url_redirections(destination_page_id, old_url_path, course_id) VALUES ($1, $2, $3)",
                                    page.id,
                                    old_path,
                                    course_id
                                )
                                .execute(&mut tx)
                                .await?;
                            } else {
                                return Err(ModelError::InvalidRequest(
                                    "New chapter not found".to_string(),
                                ));
                            }
                        } else {
                            return Err(ModelError::InvalidRequest(
                                "Old chapter not found".to_string(),
                            ));
                        }
                    } else {
                        // Moving page from a chapter to a top level page
                        return Err(ModelError::InvalidRequest(
                            "Making a chapter page a top level page is not supported yet"
                                .to_string(),
                        ));
                    }
                } else {
                    error!("Cannot move a top level page to a chapter. matching_db_page.chapter_id: {:?} page.chapter_id: {:?}", matching_db_page.chapter_id, page.chapter_id);
                    // Moving page from the top level to a chapter
                    return Err(ModelError::InvalidRequest(
                        "Moving a top level page to a chapter is not supported yet".to_string(),
                    ));
                }
            }
        } else {
            return Err(ModelError::InvalidRequest(format!(
                "Page {} does exist in course {}",
                page.id, course_id
            )));
        }
    }
    tx.commit().await?;
    Ok(())
}

pub async fn reorder_chapters(
    conn: &mut PgConnection,
    chapters: &[Chapter],
    course_id: Uuid,
) -> ModelResult<()> {
    let db_chapters = dbg!(course_chapters(conn, course_id).await?);
    let mut tx = conn.begin().await?;
    // Look for the modified chapter in the existing database

    // TODO USE CHAPTER ID FOR THE LOOP
    for chapter in chapters {
        if let Some(matching_db_chapter) = db_chapters.iter().find(|c| c.id == chapter.id) {
            if let Some(old_chapter) = db_chapters.iter().find(|o| o.id == matching_db_chapter.id) {
                // if matching_db_chapter.id == chapter.id {
                // to avoid conflicting chapter_number when chapter is modified

                //GIVE TWO MODIFIED CHAPTERS RANDOM NUMBERS
                sqlx::query!(
                    "UPDATE chapters
                SET chapter_number = floor(random() * (20000000 - 2000000 + 1) + 200000)
                WHERE chapters.id = $1
                  AND chapters.course_id = $2
                  AND deleted_at IS NULL",
                    matching_db_chapter.id,
                    course_id
                )
                .execute(&mut tx)
                .await?;
                // }

                // get newly modified chapter
                let chapter_with_randomized_chapter_number =
                    get_chapter(&mut tx, matching_db_chapter.id).await?;
                let random_chapter_number = chapter_with_randomized_chapter_number.chapter_number;
                let pages =
                    get_chapter_pages(&mut tx, chapter_with_randomized_chapter_number.id).await?;

                for page in pages {
                    let old_path = &page.url_path;
                    let new_path = old_path.replacen(
                        &old_chapter.chapter_number.to_string(),
                        &random_chapter_number.to_string(),
                        1,
                    );

                    // update each page path associated with a random chapter number
                    sqlx::query!(
                        "UPDATE pages SET url_path = $2 WHERE pages.id = $1",
                        page.id,
                        new_path
                    )
                    .execute(&mut tx)
                    .await?;
                }
            }
        }
    }

    for chapter in dbg!(chapters) {
        if let Some(matching_db_chapter) = db_chapters.iter().find(|c| c.id == chapter.id) {
            /*             let old_chapter_id = matching_db_chapter.id;
                       let new_chapter_id = chapter.id;
            */
            if let Some(old_chapter) = db_chapters.iter().find(|o| o.id == matching_db_chapter.id) {
                if let Some(new_chapter) = chapters.iter().find(|o| o.id == matching_db_chapter.id)
                {
                    let old_chapter_number = &old_chapter.chapter_number;
                    let new_chapter_number = &new_chapter.chapter_number;

                    let randomized_chapter = get_chapter(&mut tx, chapter.id).await?;

                    let randomized_chapter_number = randomized_chapter.chapter_number;

                    // update chapter_number
                    sqlx::query!(
                        "UPDATE chapters SET chapter_number = $2 WHERE chapters.id = $1",
                        chapter.id,
                        new_chapter_number
                    )
                    .execute(&mut tx)
                    .await?;

                    // update all pages url in the modified chapter
                    let pages = get_chapter_pages(&mut tx, chapter.id).await?;

                    for page in pages {
                        let old_path = &page.url_path;
                        let new_path = old_path.replacen(
                            &randomized_chapter_number.to_string(),
                            &new_chapter_number.to_string(),
                            1,
                        );
                        // update each page path associated with the modified chapter
                        sqlx::query!(
                            "UPDATE pages SET url_path = $2 WHERE pages.id = $1",
                            page.id,
                            new_path
                        )
                        .execute(&mut tx)
                        .await?;

                        sqlx::query!(
                            "INSERT INTO url_redirections(destination_page_id, old_url_path, course_id) VALUES ($1, $2, $3)",
                            page.id,
                            old_path,
                            course_id
                        )
                        .execute(&mut tx)
                        .await?;
                    }
                }
            } else {
                return Err(ModelError::InvalidRequest(
                    "New chapter not found".to_string(),
                ));
            }
        } else {
            return Err(ModelError::InvalidRequest(
                "Old chapter not found".to_string(),
            ));
        }
    }

    tx.commit().await?;
    Ok(())
}

pub async fn is_chapter_front_page(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<IsChapterFrontPage> {
    let chapter = get_chapter_by_page_id(conn, page_id).await?;

    Ok(chapter.front_page_id.map_or(
        IsChapterFrontPage {
            is_chapter_front_page: false,
        },
        |id| IsChapterFrontPage {
            is_chapter_front_page: id == page_id,
        },
    ))
}

#[cfg(test)]
mod test {
    use chrono::TimeZone;

    use super::*;
    use crate::{exams::NewExam, test_helper::*};

    #[tokio::test]
    async fn gets_organization_id() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module, chapter: _chapter, :page);

        let course_page_org = get_organization_id(tx.as_mut(), page).await.unwrap();
        assert_eq!(org, course_page_org);

        let new_exam_id = crate::exams::insert(
            tx.as_mut(),
            &NewExam {
                name: "name".to_string(),
                starts_at: None,
                ends_at: None,
                time_minutes: 120,
                organization_id: org,
            },
            None,
        )
        .await
        .unwrap();
        let page = crate::pages::insert_page(
            tx.as_mut(),
            NewPage {
                exercises: vec![],
                exercise_slides: vec![],
                exercise_tasks: vec![],
                content: serde_json::Value::Array(vec![]),
                url_path: "url".to_string(),
                title: "title".to_string(),
                course_id: None,
                exam_id: Some(new_exam_id),
                chapter_id: None,
                front_page_of_chapter_id: None,
                content_search_language: None,
            },
            user,
        )
        .await
        .unwrap();
        let exam_page_org = get_organization_id(tx.as_mut(), page.id).await.unwrap();
        assert_eq!(org, exam_page_org);
    }

    #[tokio::test]
    async fn page_update_validation_works() {
        let e1 = CmsPageExercise {
            id: Uuid::parse_str("0c9dca80-5904-4d35-a945-8c080446f667").unwrap(),
            name: "".to_string(),
            order_number: 1,
            score_maximum: 1,
            max_tries_per_slide: None,
            limit_number_of_tries: false,
            deadline: Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
            needs_peer_review: false,
        };
        let e1_s1 = CmsPageExerciseSlide {
            id: Uuid::parse_str("43380e81-6ff2-4f46-9f38-af0ac6a8421a").unwrap(),
            exercise_id: e1.id,
            order_number: 1,
        };
        let e1_s1_t1 = CmsPageExerciseTask {
            id: Uuid::parse_str("6fb19c22-bca0-42cf-8be5-4141e21cc7a9").unwrap(),
            exercise_slide_id: e1_s1.id,
            assignment: serde_json::json!([]),
            exercise_type: "exercise".to_string(),
            private_spec: None,
            order_number: 1,
        };

        // Works without exercises
        assert!(create_update(vec![], vec![], vec![])
            .validate_exercise_data()
            .is_ok());

        // Works with single valid exercise
        assert!(create_update(
            vec![e1.clone()],
            vec![e1_s1.clone()],
            vec![e1_s1_t1.clone()],
        )
        .validate_exercise_data()
        .is_ok());

        // Fails with missing slide
        assert!(create_update(vec![e1.clone()], vec![], vec![e1_s1_t1],)
            .validate_exercise_data()
            .is_err());

        // Fails with missing task
        assert!(create_update(vec![e1], vec![e1_s1], vec![],)
            .validate_exercise_data()
            .is_err());
    }

    fn create_update(
        exercises: Vec<CmsPageExercise>,
        exercise_slides: Vec<CmsPageExerciseSlide>,
        exercise_tasks: Vec<CmsPageExerciseTask>,
    ) -> CmsPageUpdate {
        CmsPageUpdate {
            content: serde_json::json!([]),
            exercises,
            exercise_slides,
            exercise_tasks,
            url_path: "".to_string(),
            title: "".to_string(),
            chapter_id: None,
        }
    }
}
