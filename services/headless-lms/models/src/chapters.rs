use std::path::PathBuf;

use crate::{
    course_modules,
    pages::{PageMetadata, PageWithExercises},
    prelude::*,
    user_exercise_states::get_user_course_instance_chapter_metrics,
};
use headless_lms_utils::{
    file_store::FileStore, numbers::option_f32_to_f32_two_decimals_with_none_as_zero,
    ApplicationConfiguration,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct DatabaseChapter {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub color: Option<String>,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_image_path: Option<String>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub copied_from: Option<Uuid>,
    pub course_module_id: Uuid,
}

impl DatabaseChapter {
    /// True if the chapter is currently open or was open and is now closed.
    pub fn has_opened(&self) -> bool {
        self.opens_at
            .map(|opens_at| opens_at < Utc::now())
            .unwrap_or(true)
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Chapter {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub color: Option<String>,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_image_url: Option<String>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub copied_from: Option<Uuid>,
    pub course_module_id: Uuid,
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
            color: chapter.color.clone(),
            course_id: chapter.course_id,
            deleted_at: chapter.deleted_at,
            chapter_image_url,
            chapter_number: chapter.chapter_number,
            front_page_id: chapter.front_page_id,
            opens_at: chapter.opens_at,
            copied_from: chapter.copied_from,
            deadline: chapter.deadline,
            course_module_id: chapter.course_module_id,
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
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
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewChapter {
    pub name: String,
    pub color: Option<String>,
    pub course_id: Uuid,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    /// If undefined when creating a chapter, will use the course default one.
    /// CHANGE TO NON NULL WHEN FRONTEND MODULE EDITING IMPLEMENTED
    pub course_module_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterUpdate {
    pub name: String,
    pub color: Option<String>,
    pub front_page_id: Option<Uuid>,
    pub deadline: Option<DateTime<Utc>>,
    pub opens_at: Option<DateTime<Utc>>,
    /// CHANGE TO NON NULL WHEN FRONTEND MODULE EDITING IMPLEMENTED
    pub course_module_id: Option<Uuid>,
}

pub struct ChapterInfo {
    pub chapter_id: Uuid,
    pub chapter_name: String,
    pub chapter_front_page_id: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new_chapter: &NewChapter,
) -> ModelResult<Uuid> {
    // Refactor notice: At the moment frontend can optionally decide which module the new chapter
    // belongs to. However, chapters should be grouped in a way that all chapters in the same
    // module have consecutive order numbers. Hence this issue should be resolved first. Ideally
    // this bit was not needed at all.
    // ---------- ----------
    let course_module_id = if let Some(course_module_id) = new_chapter.course_module_id {
        course_module_id
    } else {
        let module = course_modules::get_default_by_course_id(conn, new_chapter.course_id).await?;
        module.id
    };
    // ---------- ----------
    let res = sqlx::query!(
        r"
INSERT INTO chapters(
    id,
    name,
    color,
    course_id,
    chapter_number,
    deadline,
    opens_at,
    course_module_id
  )
VALUES($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        new_chapter.name,
        new_chapter.color,
        new_chapter.course_id,
        new_chapter.chapter_number,
        new_chapter.deadline,
        new_chapter.opens_at,
        course_module_id,
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
  course_module_id = $5,
  color = $6
WHERE id = $1
RETURNING *;
    "#,
        chapter_id,
        chapter_update.name,
        chapter_update.deadline,
        chapter_update.opens_at,
        chapter_update.course_module_id,
        chapter_update.color,
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterWithStatus {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub color: Option<String>,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub status: ChapterStatus,
    pub chapter_image_url: Option<String>,
    pub course_module_id: Uuid,
}

impl ChapterWithStatus {
    pub fn from_database_chapter_timestamp_and_image_url(
        database_chapter: DatabaseChapter,
        timestamp: DateTime<Utc>,
        chapter_image_url: Option<String>,
    ) -> Self {
        let open = database_chapter
            .opens_at
            .map(|o| o <= timestamp)
            .unwrap_or(true);
        let status = if open {
            ChapterStatus::Open
        } else {
            ChapterStatus::Closed
        };
        ChapterWithStatus {
            id: database_chapter.id,
            created_at: database_chapter.created_at,
            updated_at: database_chapter.updated_at,
            name: database_chapter.name,
            color: database_chapter.color,
            course_id: database_chapter.course_id,
            deleted_at: database_chapter.deleted_at,
            chapter_number: database_chapter.chapter_number,
            front_page_id: database_chapter.front_page_id,
            opens_at: database_chapter.opens_at,
            status,
            chapter_image_url,
            course_module_id: database_chapter.course_module_id,
        }
    }
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
  color,
  course_id,
  deleted_at,
  chapter_image_path,
  chapter_number,
  front_page_id,
  opens_at,
  copied_from,
  deadline,
  course_module_id
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
  color,
  course_id,
  deleted_at,
  chapter_image_path,
  chapter_number,
  front_page_id,
  opens_at,
  copied_from,
  deadline,
  course_module_id
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
    .fetch_one(&mut *tx)
    .await?;
    // We'll also delete all the pages and exercises so that they don't conflict with future chapters
    sqlx::query!(
        "UPDATE pages SET deleted_at = now() WHERE chapter_id = $1 AND deleted_at IS NULL;",
        chapter_id
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE exercise_tasks SET deleted_at = now() WHERE deleted_at IS NULL AND exercise_slide_id IN (SELECT id FROM exercise_slides WHERE exercise_slides.deleted_at IS NULL AND exercise_id IN (SELECT id FROM exercises WHERE chapter_id = $1 AND exercises.deleted_at IS NULL));",
        chapter_id
    )
    .execute(&mut *tx).await?;
    sqlx::query!(
        "UPDATE exercise_slides SET deleted_at = now() WHERE deleted_at IS NULL AND exercise_id IN (SELECT id FROM exercises WHERE chapter_id = $1 AND exercises.deleted_at IS NULL);",
        chapter_id
    )
    .execute(&mut *tx).await?;
    sqlx::query!(
        "UPDATE exercises SET deleted_at = now() WHERE deleted_at IS NULL AND chapter_id = $1;",
        chapter_id
    )
    .execute(&mut *tx)
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
        score_given: option_f32_to_f32_two_decimals_with_none_as_zero(
            user_chapter_metrics.score_given,
        ),
        score_maximum,
        total_exercises: Some(TryInto::try_into(exercise_ids.len())).transpose()?,
        attempted_exercises: user_chapter_metrics
            .attempted_exercises
            .map(TryInto::try_into)
            .transpose()?,
    };
    Ok(result)
}

pub async fn get_chapter_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<DatabaseChapter> {
    let chapter = sqlx::query_as!(
        DatabaseChapter,
        "
SELECT c.*
FROM chapters c,
  pages p
WHERE c.id = p.chapter_id
  AND p.id = $1
  AND c.deleted_at IS NULL
    ",
        page_id
    )
    .fetch_one(conn)
    .await?;

    Ok(chapter)
}

pub async fn get_chapter_info_by_page_metadata(
    conn: &mut PgConnection,
    current_page_metadata: &PageMetadata,
) -> ModelResult<ChapterInfo> {
    let chapter_page = sqlx::query_as!(
        ChapterInfo,
        "
        SELECT
            c.id as chapter_id,
            c.name as chapter_name,
            c.front_page_id as chapter_front_page_id
        FROM chapters c
        WHERE c.id = $1
        AND c.course_id = $2
            AND c.deleted_at IS NULL;
        ",
        current_page_metadata.chapter_id,
        current_page_metadata.course_id
    )
    .fetch_one(conn)
    .await?;

    Ok(chapter_page)
}

pub async fn set_module(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    module_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE chapters
SET course_module_id = $2
WHERE id = $1
",
        chapter_id,
        module_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_for_module(conn: &mut PgConnection, module_id: Uuid) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT id
FROM chapters
WHERE course_module_id = $1
AND deleted_at IS NULL
",
        module_id
    )
    .map(|c| c.id)
    .fetch_all(conn)
    .await?;
    Ok(res)
}

#[cfg(test)]
mod tests {
    use super::*;

    mod constraints {
        use super::*;
        use crate::{courses::NewCourse, library, test_helper::*};

        #[tokio::test]
        async fn cannot_create_chapter_for_different_course_than_its_module() {
            insert_data!(:tx, :user, :org, course: course_1, instance: _instance, :course_module);
            let course_2 = library::content_management::create_new_course(
                tx.as_mut(),
                PKeyPolicy::Generate,
                NewCourse {
                    name: "".to_string(),
                    slug: "course-2".to_string(),
                    organization_id: org,
                    language_code: "en-US".to_string(),
                    teacher_in_charge_name: "Teacher".to_string(),
                    teacher_in_charge_email: "teacher@example.com".to_string(),
                    description: "".to_string(),
                    is_draft: false,
                    is_test_mode: false,
                    is_unlisted: false,
                    copy_user_permissions: false,
                    is_joinable_by_code_only: false,
                    join_code: None,
                    ask_marketing_consent: false,
                    flagged_answers_threshold: Some(5),
                },
                user,
                |_, _, _| unimplemented!(),
                |_| unimplemented!(),
            )
            .await
            .unwrap()
            .0
            .id;
            let chapter_result_2 = insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                &NewChapter {
                    name: "Chapter of second course".to_string(),
                    color: None,
                    course_id: course_2,
                    chapter_number: 0,
                    front_page_id: None,
                    opens_at: None,
                    deadline: None,
                    course_module_id: Some(course_module.id),
                },
            )
            .await;
            assert!(
                chapter_result_2.is_err(),
                "Expected chapter creation to fail when course module belongs to a different course."
            );
        }
    }
}
