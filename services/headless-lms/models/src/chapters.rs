use std::{collections::HashMap, path::PathBuf};

use crate::CourseOrExamId;
use crate::exercises;
use crate::exercises::GradingProgress;
use crate::user_exercise_states::{self, ReviewingStage};
use crate::{
    course_modules, courses,
    pages::{PageMetadata, PageWithExercises},
    prelude::*,
};
use headless_lms_utils::{
    ApplicationConfiguration, file_store::FileStore,
    numbers::option_f32_to_f32_two_decimals_with_none_as_zero,
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
#[derive(Default)]
pub enum ChapterStatus {
    Open,
    #[default]
    Closed,
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
where id = $1 AND deleted_at IS NULL;",
        chapter_id,
    )
    .fetch_optional(conn)
    .await?;
    chapter.ok_or_else(|| {
        ModelError::new(
            ModelErrorType::NotFound,
            format!(
                "Chapter with id {} not found or has been deleted",
                chapter_id
            ),
            None,
        )
    })
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
    pub deadline: Option<DateTime<Utc>>,
    pub status: ChapterStatus,
    pub chapter_image_url: Option<String>,
    pub course_module_id: Uuid,
    pub exercise_deadline_override_count: i64,
    pub exercise_deadline_override_distinct_count: i64,
    pub earliest_exercise_deadline_override: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy, Default)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterExerciseDeadlineOverrideSummary {
    pub earliest_exercise_deadline_override: Option<DateTime<Utc>>,
    pub exercise_deadline_override_count: i64,
    pub exercise_deadline_override_distinct_count: i64,
}

impl ChapterWithStatus {
    pub fn from_database_chapter_timestamp_and_image_url(
        database_chapter: DatabaseChapter,
        timestamp: DateTime<Utc>,
        chapter_image_url: Option<String>,
        exercise_deadline_overrides: Option<ChapterExerciseDeadlineOverrideSummary>,
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
        let exercise_deadline_overrides = exercise_deadline_overrides.unwrap_or_default();
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
            deadline: database_chapter.deadline,
            status,
            chapter_image_url,
            course_module_id: database_chapter.course_module_id,
            exercise_deadline_override_count: exercise_deadline_overrides
                .exercise_deadline_override_count,
            exercise_deadline_override_distinct_count: exercise_deadline_overrides
                .exercise_deadline_override_distinct_count,
            earliest_exercise_deadline_override: exercise_deadline_overrides
                .earliest_exercise_deadline_override,
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

pub async fn exercise_deadline_overrides_by_chapter_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<HashMap<Uuid, ChapterExerciseDeadlineOverrideSummary>> {
    let rows = sqlx::query!(
        r#"
SELECT
  e.chapter_id,
  MIN(COALESCE(e.deadline, c.deadline)) FILTER (
    WHERE COALESCE(e.deadline, c.deadline) IS NOT NULL
  ) AS earliest_exercise_deadline_override,
  COUNT(*) FILTER (
    WHERE e.deadline IS NOT NULL
      AND (c.deadline IS NULL OR e.deadline <> c.deadline)
  ) AS exercise_deadline_override_count,
  COUNT(DISTINCT COALESCE(e.deadline, c.deadline)) FILTER (
    WHERE COALESCE(e.deadline, c.deadline) IS NOT NULL
  ) AS exercise_deadline_override_distinct_count
FROM exercises e
JOIN chapters c ON c.id = e.chapter_id
WHERE c.course_id = $1
  AND c.deleted_at IS NULL
  AND e.deleted_at IS NULL
GROUP BY e.chapter_id, c.deadline
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    let mut summaries = HashMap::new();
    for row in rows {
        if let Some(chapter_id) = row.chapter_id {
            summaries.insert(
                chapter_id,
                ChapterExerciseDeadlineOverrideSummary {
                    earliest_exercise_deadline_override: row.earliest_exercise_deadline_override,
                    exercise_deadline_override_count: row
                        .exercise_deadline_override_count
                        .unwrap_or(0),
                    exercise_deadline_override_distinct_count: row
                        .exercise_deadline_override_distinct_count
                        .unwrap_or(0),
                },
            );
        }
    }
    Ok(summaries)
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
AND deleted_at IS NULL
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
    let course_instance =
        crate::course_instances::get_course_instance(conn, course_instance_id).await?;
    let mut exercises = crate::exercises::get_exercises_by_chapter_id(conn, chapter_id).await?;

    let exercise_ids: Vec<Uuid> = exercises.iter_mut().map(|e| e.id).collect();
    let score_maximum: i32 = exercises.into_iter().map(|e| e.score_maximum).sum();

    let user_chapter_metrics = crate::user_exercise_states::get_user_course_chapter_metrics(
        conn,
        course_instance.course_id,
        &exercise_ids,
        user_id,
    )
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserChapterProgress {
    pub user_id: Uuid,
    pub chapter_id: Uuid,
    pub chapter_number: i32,
    pub chapter_name: String,
    pub points_obtained: f64,
    pub exercises_attempted: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterAvailability {
    pub chapter_id: Uuid,
    pub chapter_number: i32,
    pub chapter_name: String,
    pub exercises_available: i64,
    pub points_available: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseUserInfo {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub user_id: Uuid,
    pub email: Option<String>,
    pub course_instance: Option<String>,
}

pub async fn fetch_user_chapter_progress(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<UserChapterProgress>> {
    let rows = sqlx::query_as!(
        UserChapterProgress,
        r#"
WITH base AS (
  SELECT ues.user_id,
    ex.chapter_id,
    ues.exercise_id,
    COALESCE(ues.score_given, 0)::double precision AS points
  FROM user_exercise_states ues
    JOIN exercises ex ON ex.id = ues.exercise_id
  WHERE ues.course_id = $1
    AND ues.deleted_at IS NULL
    AND ex.deleted_at IS NULL
)
SELECT b.user_id AS user_id,
  c.id AS chapter_id,
  c.chapter_number AS chapter_number,
  c.name AS chapter_name,
  COALESCE(SUM(b.points), 0)::double precision AS "points_obtained!",
  COALESCE(COUNT(DISTINCT b.exercise_id), 0)::bigint AS "exercises_attempted!"
FROM base b
  JOIN chapters c ON c.id = b.chapter_id
GROUP BY b.user_id,
  c.id,
  c.chapter_number,
  c.name
ORDER BY b.user_id,
  c.chapter_number
        "#,
        course_id
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows)
}

pub async fn fetch_chapter_availability(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<ChapterAvailability>> {
    let rows = sqlx::query_as!(
        ChapterAvailability,
        r#"
SELECT c.id AS chapter_id,
  c.chapter_number AS chapter_number,
  c.name AS chapter_name,
  COALESCE(COUNT(ex.id), 0)::bigint AS "exercises_available!",
  COALESCE(COUNT(ex.id), 0)::bigint AS "points_available!"
FROM chapters c
  JOIN exercises ex ON ex.chapter_id = c.id
WHERE c.course_id = $1
  AND c.deleted_at IS NULL
  AND ex.deleted_at IS NULL
GROUP BY c.id,
  c.chapter_number,
  c.name
ORDER BY c.chapter_number
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(rows)
}

pub async fn fetch_course_users(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseUserInfo>> {
    let rows_raw = sqlx::query!(
        r#"
    SELECT
        ud.first_name,
        ud.last_name,
        u.id AS user_id,
        ud.email AS "email?",
        ci.name AS "course_instance?"
    FROM course_instance_enrollments AS cie
    JOIN users              AS u  ON u.id = cie.user_id
    LEFT JOIN user_details  AS ud ON ud.user_id = u.id
    JOIN course_instances   AS ci ON ci.id = cie.course_instance_id
    WHERE cie.course_id = $1
        AND cie.deleted_at IS NULL
    ORDER BY 1, user_id
    "#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    let rows = rows_raw
        .into_iter()
        .map(|r| {
            let first_name = r
                .first_name
                .map(|f| f.trim().to_string())
                .filter(|f| !f.is_empty());
            let last_name = r
                .last_name
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty());

            CourseUserInfo {
                first_name,
                last_name,
                user_id: r.user_id,
                email: r.email,
                course_instance: r.course_instance,
            }
        })
        .collect();

    Ok(rows)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UnreturnedExercise {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterLockPreview {
    pub has_unreturned_exercises: bool,
    pub unreturned_exercises_count: i32,
    pub unreturned_exercises: Vec<UnreturnedExercise>,
}

pub async fn get_chapter_lock_preview(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<ChapterLockPreview> {
    let exercises = crate::exercises::get_exercises_by_chapter_id(conn, chapter_id).await?;

    if exercises.is_empty() {
        return Ok(ChapterLockPreview {
            has_unreturned_exercises: false,
            unreturned_exercises_count: 0,
            unreturned_exercises: Vec::new(),
        });
    }

    let exercise_ids: Vec<Uuid> = exercises.iter().map(|e| e.id).collect();

    let returned_exercise_ids =
        crate::user_exercise_states::get_returned_exercise_ids_for_user_and_course(
            conn,
            &exercise_ids,
            user_id,
            course_id,
        )
        .await?;

    let returned_ids: std::collections::HashSet<Uuid> = returned_exercise_ids.into_iter().collect();

    let unreturned_exercises: Vec<UnreturnedExercise> = exercises
        .into_iter()
        .filter(|e| !returned_ids.contains(&e.id))
        .map(|e| UnreturnedExercise {
            id: e.id,
            name: e.name,
        })
        .collect();

    let count = unreturned_exercises.len() as i32;
    let has_unreturned = count > 0;

    Ok(ChapterLockPreview {
        has_unreturned_exercises: has_unreturned,
        unreturned_exercises_count: count,
        unreturned_exercises,
    })
}

pub async fn get_previous_chapters_in_module(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<Vec<DatabaseChapter>> {
    let chapter = get_chapter(conn, chapter_id).await?;
    let previous_chapters = sqlx::query_as!(
        DatabaseChapter,
        r#"
SELECT *
FROM chapters
WHERE course_module_id = $1
  AND chapter_number < $2
  AND deleted_at IS NULL
ORDER BY chapter_number ASC
        "#,
        chapter.course_module_id,
        chapter.chapter_number
    )
    .fetch_all(conn)
    .await?;
    Ok(previous_chapters)
}

pub async fn move_chapter_exercises_to_manual_review(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<()> {
    let exercises = exercises::get_exercises_by_chapter_id(conn, chapter_id).await?;

    for exercise in exercises {
        let user_exercise_state_result =
            user_exercise_states::get_users_current_by_exercise(conn, user_id, &exercise).await;

        let Ok(user_exercise_state) = user_exercise_state_result else {
            continue;
        };
        if user_exercise_state.reviewing_stage == ReviewingStage::WaitingForManualGrading
            || user_exercise_state.reviewing_stage == ReviewingStage::ReviewedAndLocked
            || user_exercise_state.selected_exercise_slide_id.is_none()
        {
            continue;
        }

        let course_or_exam_id = CourseOrExamId::Course(course_id);
        let new_stage = if exercise.needs_peer_review || exercise.needs_self_review {
            ReviewingStage::WaitingForManualGrading
        } else if !exercise.teacher_reviews_answer_after_locking
            && user_exercise_state.grading_progress == GradingProgress::FullyGraded
        {
            ReviewingStage::ReviewedAndLocked
        } else {
            ReviewingStage::WaitingForManualGrading
        };

        user_exercise_states::update_reviewing_stage(
            conn,
            user_id,
            course_or_exam_id,
            exercise.id,
            new_stage,
        )
        .await?;
    }

    Ok(())
}

/// Unlocks the first chapter(s) with exercises in the base module (order_number == 0) for a user.
/// Also unlocks any chapters without exercises that come before the first chapter with exercises.
pub async fn unlock_first_chapters_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    use crate::{course_modules, exercises, user_chapter_locking_statuses};

    let all_modules = course_modules::get_by_course_id(conn, course_id).await?;
    let base_module = all_modules
        .into_iter()
        .find(|m| m.order_number == 0)
        .ok_or_else(|| {
            ModelError::new(
                ModelErrorType::NotFound,
                "Base module not found".to_string(),
                None,
            )
        })?;

    let module_chapter_ids = get_for_module(conn, base_module.id).await?;
    let mut module_chapters = course_chapters(conn, course_id)
        .await?
        .into_iter()
        .filter(|c| module_chapter_ids.contains(&c.id))
        .collect::<Vec<_>>();
    module_chapters.sort_by_key(|c| c.chapter_number);

    let mut chapters_to_unlock = Vec::new();

    for chapter in &module_chapters {
        let exercises = exercises::get_exercises_by_chapter_id(conn, chapter.id).await?;
        let has_exercises = !exercises.is_empty();

        if has_exercises {
            chapters_to_unlock.push(chapter.id);
            break;
        } else {
            chapters_to_unlock.push(chapter.id);
        }
    }

    for chapter_id in &chapters_to_unlock {
        user_chapter_locking_statuses::unlock_chapter(conn, user_id, *chapter_id, course_id)
            .await?;
    }

    Ok(chapters_to_unlock)
}

/// Unlocks the next chapter(s) for a user after they complete a chapter.
/// If the completed chapter is the last in a base module (order_number == 0), unlocks the first chapter
/// of all additional modules (order_number != 0). Otherwise, unlocks the next chapter in the same module.
/// Note: If a module has no chapters with exercises, all chapters in that module will be unlocked.
/// This is intentional to allow progression through content-only chapters.
pub async fn unlock_next_chapters_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    use crate::{course_modules, exercises, user_chapter_locking_statuses};

    let completed_chapter = get_chapter(conn, chapter_id).await?;
    let module = course_modules::get_by_id(conn, completed_chapter.course_module_id).await?;

    let module_chapters = get_for_module(conn, completed_chapter.course_module_id).await?;
    let mut all_module_chapters = course_chapters(conn, course_id)
        .await?
        .into_iter()
        .filter(|c| module_chapters.contains(&c.id))
        .collect::<Vec<_>>();
    all_module_chapters.sort_by_key(|c| c.chapter_number);

    let mut chapters_to_unlock = Vec::new();

    let is_base_module = module.order_number == 0;

    let course = courses::get_course(conn, course_id).await?;
    let mut all_module_chapters_completed = true;
    for chapter in &all_module_chapters {
        let status = user_chapter_locking_statuses::get_or_init_status(
            conn,
            user_id,
            chapter.id,
            Some(course_id),
            Some(course.chapter_locking_enabled),
        )
        .await?;
        if !matches!(
            status,
            Some(user_chapter_locking_statuses::ChapterLockingStatus::CompletedAndLocked)
        ) {
            all_module_chapters_completed = false;
            break;
        }
    }

    if is_base_module && all_module_chapters_completed {
        let all_modules = course_modules::get_by_course_id(conn, course_id).await?;
        let additional_modules: Vec<_> = all_modules
            .into_iter()
            .filter(|m| m.order_number != 0)
            .collect();

        let mut all_additional_module_chapter_ids = Vec::new();
        for additional_module in &additional_modules {
            let module_chapter_ids = get_for_module(conn, additional_module.id).await?;
            all_additional_module_chapter_ids.extend(module_chapter_ids);
        }

        let all_exercises = if !all_additional_module_chapter_ids.is_empty() {
            exercises::get_exercises_by_chapter_ids(conn, &all_additional_module_chapter_ids)
                .await?
        } else {
            Vec::new()
        };

        let exercises_by_chapter: std::collections::HashMap<Uuid, Vec<_>> = all_exercises
            .into_iter()
            .fold(std::collections::HashMap::new(), |mut acc, ex| {
                if let Some(ch_id) = ex.chapter_id {
                    acc.entry(ch_id).or_insert_with(Vec::new).push(ex);
                }
                acc
            });

        for additional_module in additional_modules {
            let module_chapter_ids = get_for_module(conn, additional_module.id).await?;
            let mut module_chapters = course_chapters(conn, course_id)
                .await?
                .into_iter()
                .filter(|c| module_chapter_ids.contains(&c.id))
                .collect::<Vec<_>>();
            module_chapters.sort_by_key(|c| c.chapter_number);

            for chapter in &module_chapters {
                let has_exercises = exercises_by_chapter
                    .get(&chapter.id)
                    .map(|exs| !exs.is_empty())
                    .unwrap_or(false);

                if has_exercises {
                    chapters_to_unlock.push(chapter.id);
                    break;
                } else {
                    chapters_to_unlock.push(chapter.id);
                }
            }
        }
    } else {
        let module_chapter_ids = get_for_module(conn, completed_chapter.course_module_id).await?;
        let mut module_chapters = course_chapters(conn, course_id)
            .await?
            .into_iter()
            .filter(|c| module_chapter_ids.contains(&c.id))
            .collect::<Vec<_>>();
        module_chapters.sort_by_key(|c| c.chapter_number);
        let mut found_completed = false;
        let mut candidate_chapter_ids = Vec::new();

        for chapter in &module_chapters {
            if chapter.id == completed_chapter.id {
                found_completed = true;
                continue;
            }

            if !found_completed {
                continue;
            }

            candidate_chapter_ids.push(chapter.id);
        }

        let all_exercises = if !candidate_chapter_ids.is_empty() {
            exercises::get_exercises_by_chapter_ids(conn, &candidate_chapter_ids).await?
        } else {
            Vec::new()
        };

        let exercises_by_chapter: std::collections::HashMap<Uuid, Vec<_>> = all_exercises
            .into_iter()
            .fold(std::collections::HashMap::new(), |mut acc, ex| {
                if let Some(ch_id) = ex.chapter_id {
                    acc.entry(ch_id).or_insert_with(Vec::new).push(ex);
                }
                acc
            });

        for chapter_id in candidate_chapter_ids {
            let has_exercises = exercises_by_chapter
                .get(&chapter_id)
                .map(|exs| !exs.is_empty())
                .unwrap_or(false);

            if has_exercises {
                chapters_to_unlock.push(chapter_id);
                break;
            } else {
                chapters_to_unlock.push(chapter_id);
            }
        }
    }

    for chapter_id in &chapters_to_unlock {
        user_chapter_locking_statuses::unlock_chapter(conn, user_id, *chapter_id, course_id)
            .await?;
    }

    Ok(chapters_to_unlock)
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
                    language_code: "en".to_string(),
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
                    flagged_answers_threshold: Some(3),
                    can_add_chatbot: false,
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
