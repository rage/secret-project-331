use std::path::PathBuf;

use crate::{
    pages::{NewPage, Page, PageWithExercises},
    prelude::*,
    user_exercise_states::get_user_course_instance_chapter_metrics,
};
use headless_lms_utils::{
    document_schema_processor::GutenbergBlock, file_store::FileStore,
    numbers::option_f32_to_f32_two_decimals, ApplicationConfiguration,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct DatabaseChapter {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_image_path: Option<String>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub copied_from: Option<Uuid>,
    pub module: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Chapter {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_image_url: Option<String>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub copied_from: Option<Uuid>,
    pub module: Option<Uuid>,
}

impl Chapter {
    pub fn from_database_chapter(
        chapter: &DatabaseChapter,
        file_store: &dyn FileStore,
        app_conf: &ApplicationConfiguration,
    ) -> Self {
        let chapter_image_url = chapter.chapter_image_path.as_ref().map(|image| {
            let path = PathBuf::from(image);
            file_store.get_download_url(path.as_path(), app_conf)
        });
        Self {
            id: chapter.id,
            created_at: chapter.created_at,
            updated_at: chapter.updated_at,
            name: chapter.name.clone(),
            course_id: chapter.course_id,
            deleted_at: chapter.deleted_at,
            chapter_image_url,
            chapter_number: chapter.chapter_number,
            front_page_id: chapter.front_page_id,
            opens_at: chapter.opens_at,
            copied_from: chapter.copied_from,
            deadline: chapter.deadline,
            module: chapter.module,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub enum ChapterStatus {
    Open,
    Closed,
}

impl Default for ChapterStatus {
    fn default() -> Self {
        Self::Closed
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ChapterPagesWithExercises {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_number: i32,
    pub pages: Vec<PageWithExercises>,
}

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewChapter {
    pub name: String,
    pub course_id: Uuid,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub module: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterUpdate {
    pub name: String,
    pub front_page_id: Option<Uuid>,
    pub deadline: Option<DateTime<Utc>>,
    pub opens_at: Option<DateTime<Utc>>,
    pub module: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    course_id: Uuid,
    chapter_number: i32,
    module: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO chapters (name, course_id, chapter_number, module)
VALUES ($1, $2, $3, $4)
RETURNING id
",
        name,
        course_id,
        chapter_number,
        module
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn set_front_page(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    front_page_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE chapters SET front_page_id = $1 WHERE id = $2",
        front_page_id,
        chapter_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_opens_at(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    opens_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE chapters SET opens_at = $1 WHERE id = $2",
        opens_at,
        chapter_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Checks the opens_at field for the chapter and compares it to the current time. If null, the chapter is always open.
pub async fn is_open(conn: &mut PgConnection, chapter_id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query!(
        r#"
SELECT opens_at
FROM chapters
WHERE id = $1
"#,
        chapter_id
    )
    .fetch_one(conn)
    .await?;
    let open = res.opens_at.map(|o| o <= Utc::now()).unwrap_or(true);
    Ok(open)
}

pub async fn get_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<DatabaseChapter> {
    let chapter = sqlx::query_as!(
        DatabaseChapter,
        "
SELECT *
from chapters
where id = $1;",
        chapter_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(chapter)
}

pub async fn get_course_id(conn: &mut PgConnection, chapter_id: Uuid) -> ModelResult<Uuid> {
    let course_id = sqlx::query!("SELECT course_id from chapters where id = $1", chapter_id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn update_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    chapter_update: ChapterUpdate,
) -> ModelResult<DatabaseChapter> {
    let res = sqlx::query_as!(
        DatabaseChapter,
        r#"
UPDATE chapters
SET name = $2,
  deadline = $3,
  opens_at = $4,
  module = $5
WHERE id = $1
RETURNING *;
    "#,
        chapter_id,
        chapter_update.name,
        chapter_update.deadline,
        chapter_update.opens_at,
        chapter_update.module
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_chapter_image_path(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    chapter_image_path: Option<String>,
) -> ModelResult<DatabaseChapter> {
    let updated_chapter = sqlx::query_as!(
        DatabaseChapter,
        "
UPDATE chapters
SET chapter_image_path = $1
WHERE id = $2
RETURNING *;",
        chapter_image_path,
        chapter_id
    )
    .fetch_one(conn)
    .await?;
    Ok(updated_chapter)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterWithStatus {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub status: ChapterStatus,
    pub chapter_image_url: Option<String>,
    pub module: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCourseInstanceChapterProgress {
    pub score_given: f32,
    pub score_maximum: i32,
    pub total_exercises: Option<u32>,
    pub attempted_exercises: Option<u32>,
}

pub async fn course_chapters(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<DatabaseChapter>> {
    let chapters = sqlx::query_as!(
        DatabaseChapter,
        r#"
SELECT id,
  created_at,
  updated_at,
  name,
  course_id,
  deleted_at,
  chapter_image_path,
  chapter_number,
  front_page_id,
  opens_at,
  copied_from,
  deadline,
  module
FROM chapters
WHERE course_id = $1
  AND deleted_at IS NULL;
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(chapters)
}

pub async fn course_instance_chapters(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Vec<DatabaseChapter>> {
    let chapters = sqlx::query_as!(
        DatabaseChapter,
        r#"
SELECT id,
  created_at,
  updated_at,
  name,
  course_id,
  deleted_at,
  chapter_image_path,
  chapter_number,
  front_page_id,
  opens_at,
  copied_from,
  deadline,
  module
FROM chapters
WHERE course_id = (SELECT course_id FROM course_instances WHERE id = $1)
  AND deleted_at IS NULL;
"#,
        course_instance_id
    )
    .fetch_all(conn)
    .await?;
    Ok(chapters)
}

pub async fn insert_chapter(
    conn: &mut PgConnection,
    chapter: NewChapter,
    user: Uuid,
) -> ModelResult<(DatabaseChapter, Page)> {
    let mut tx = conn.begin().await?;

    let chapter = sqlx::query_as!(
        DatabaseChapter,
        r#"
INSERT INTO chapters(
    name,
    course_id,
    chapter_number,
    deadline,
    opens_at,
    module
  )
VALUES($1, $2, $3, $4, $5, $6)
RETURNING *;
"#,
        chapter.name,
        chapter.course_id,
        chapter.chapter_number,
        chapter.deadline,
        chapter.opens_at,
        chapter.module
    )
    .fetch_one(&mut tx)
    .await?;

    let chapter_frontpage_content = serde_json::to_value(vec![
        GutenbergBlock::hero_section("Insert chapter heading...", "Insert chapter subheading..."),
        GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/chapter-progress".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string()),
    ])?;
    let chapter_frontpage = NewPage {
        chapter_id: Some(chapter.id),
        content: chapter_frontpage_content,
        course_id: Some(chapter.course_id),
        exam_id: None,
        front_page_of_chapter_id: Some(chapter.id),
        title: chapter.name.clone(),
        url_path: format!("/chapter-{}", chapter.chapter_number),
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content_search_language: None,
    };
    let page = crate::pages::insert_page(&mut tx, chapter_frontpage, user).await?;

    tx.commit().await?;
    Ok((chapter, page))
}

pub async fn delete_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<DatabaseChapter> {
    let mut tx = conn.begin().await?;
    let deleted = sqlx::query_as!(
        DatabaseChapter,
        r#"
UPDATE chapters
SET deleted_at = now()
WHERE id = $1
RETURNING *;
"#,
        chapter_id
    )
    .fetch_one(&mut tx)
    .await?;
    // We'll also delete all the pages and exercises so that they don't conflict with future chapters
    sqlx::query!(
        "UPDATE pages SET deleted_at = now() WHERE chapter_id = $1;",
        chapter_id
    )
    .execute(&mut tx)
    .await?;
    sqlx::query!(
        "UPDATE exercise_tasks SET deleted_at = now() WHERE deleted_at IS NULL AND exercise_slide_id IN (SELECT id FROM exercise_slides WHERE exercise_slides.deleted_at IS NULL AND exercise_id IN (SELECT id FROM exercises WHERE chapter_id = $1 AND exercises.deleted_at IS NULL));",
        chapter_id
    )
    .execute(&mut tx).await?;
    sqlx::query!(
        "UPDATE exercise_slides SET deleted_at = now() WHERE deleted_at IS NULL AND exercise_id IN (SELECT id FROM exercises WHERE chapter_id = $1 AND exercises.deleted_at IS NULL);",
        chapter_id
    )
    .execute(&mut tx).await?;
    sqlx::query!(
        "UPDATE exercises SET deleted_at = now() WHERE deleted_at IS NULL AND chapter_id = $1;",
        chapter_id
    )
    .execute(&mut tx)
    .await?;
    tx.commit().await?;
    Ok(deleted)
}

pub async fn get_user_course_instance_chapter_progress(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    chapter_id: Uuid,
    user_id: Uuid,
) -> ModelResult<UserCourseInstanceChapterProgress> {
    let mut exercises = crate::exercises::get_exercises_by_chapter_id(conn, chapter_id).await?;

    let exercise_ids: Vec<Uuid> = exercises.iter_mut().map(|e| e.id).collect();
    let score_maximum: i32 = exercises.into_iter().map(|e| e.score_maximum).sum();

    let user_chapter_metrics =
        get_user_course_instance_chapter_metrics(conn, course_instance_id, &exercise_ids, user_id)
            .await?;

    let result = UserCourseInstanceChapterProgress {
        score_given: option_f32_to_f32_two_decimals(user_chapter_metrics.score_given),
        score_maximum,
        total_exercises: Some(exercise_ids.len())
            .map(TryInto::try_into)
            .transpose()?,
        attempted_exercises: user_chapter_metrics
            .attempted_exercises
            .map(TryInto::try_into)
            .transpose()?,
    };
    Ok(result)
}
