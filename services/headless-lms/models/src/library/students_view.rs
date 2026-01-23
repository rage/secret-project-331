//! Contains helper functions needed for student view
use crate::chapters::{
    self, ChapterAvailability, CourseUserInfo, DatabaseChapter, UserChapterProgress,
};
use crate::prelude::*;
use crate::user_details::UserDetail;
use crate::user_exercise_states::UserExerciseState;
use chrono::{DateTime, Utc};

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ProgressOverview {
    pub user_details: Vec<UserDetail>,
    pub chapters: Vec<DatabaseChapter>,
    pub user_exercise_states: Vec<UserExerciseState>,
    pub chapter_availability: Vec<ChapterAvailability>,
    pub user_chapter_progress: Vec<UserChapterProgress>,
}

pub async fn get_progress(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<ProgressOverview> {
    let user_details = crate::user_details::get_users_by_course_id(conn, course_id).await?;
    let chapters = crate::chapters::course_chapters(conn, course_id).await?;
    let user_exercise_states =
        crate::user_exercise_states::get_all_for_course(conn, course_id).await?;
    let chapter_availability = chapters::fetch_chapter_availability(conn, course_id).await?;
    let user_chapter_progress = chapters::fetch_user_chapter_progress(conn, course_id).await?;

    Ok(ProgressOverview {
        user_details,
        chapters,
        user_exercise_states,
        chapter_availability,
        user_chapter_progress,
    })
}

pub async fn get_course_users(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseUserInfo>> {
    let rows = chapters::fetch_course_users(conn, course_id).await?;
    Ok(rows)
}

#[derive(Clone, PartialEq, Deserialize, Serialize, sqlx::FromRow)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CompletionGridRow {
    pub student: String,
    pub module: Option<String>, // empty/default row can be None
    pub grade: String,          // "-", "Passed", "Failed", or number as text
    pub status: String,         // "Registered" | "-"
}

/// Returns student × module grid with latest completion per (user,module),
/// formatted for the Completions tab.
pub async fn get_completions_grid_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CompletionGridRow>> {
    let rows_raw = sqlx::query!(
        r#"
WITH modules AS (
  SELECT id AS module_id, name AS module_name, order_number
  FROM course_modules
  WHERE course_id = $1
    AND deleted_at IS NULL
),
enrolled AS (
  SELECT DISTINCT user_id
  FROM course_instance_enrollments
  WHERE course_id = $1
    AND deleted_at IS NULL
),
latest_cmc AS (
  SELECT DISTINCT ON (cmc.user_id, cmc.course_module_id)
    cmc.id,
    cmc.user_id,
    cmc.course_module_id,
    cmc.grade,
    cmc.passed,
    cmc.completion_date
  FROM course_module_completions cmc
  WHERE cmc.course_id = $1
    AND cmc.deleted_at IS NULL
  ORDER BY cmc.user_id, cmc.course_module_id, cmc.completion_date DESC
),
cmcr AS (
  SELECT course_module_completion_id
  FROM course_module_completion_registered_to_study_registries
  WHERE course_id = $1
    AND deleted_at IS NULL
)
SELECT
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  m.module_name AS "module_name?",
  r.grade AS "grade?",
  r.passed AS "passed?",
  (r.id IS NOT NULL AND r.id IN (SELECT course_module_completion_id FROM cmcr)) AS "is_registered?"
FROM modules m
CROSS JOIN enrolled e
JOIN users u ON u.id = e.user_id
LEFT JOIN user_details ud ON ud.user_id = u.id
LEFT JOIN latest_cmc r
  ON r.user_id = e.user_id
 AND r.course_module_id = m.module_id
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    let rows = rows_raw
        .into_iter()
        .map(|r| {
            let first = r.first_name.unwrap_or_default().trim().to_string();
            let last = r.last_name.unwrap_or_default().trim().to_string();

            let student = if first.is_empty() && last.is_empty() {
                "(Missing name)".to_string()
            } else {
                format!("{first} {last}").trim().to_string()
            };

            let grade = match (r.grade, r.passed) {
                (Some(g), _) => g.to_string(),
                (None, Some(true)) => "Passed".to_string(),
                (None, Some(false)) => "Failed".to_string(),
                (None, None) => "-".to_string(),
            };

            let status = if r.is_registered.unwrap_or(false) {
                "Registered".to_string()
            } else {
                "-".to_string()
            };

            CompletionGridRow {
                student,
                module: r.module_name,
                grade,
                status,
            }
        })
        .collect();

    Ok(rows)
}

#[derive(Clone, PartialEq, Deserialize, Serialize, sqlx::FromRow)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CertificateGridRow {
    pub student: String,
    pub certificate: String,
    pub date_issued: Option<DateTime<Utc>>,
    pub verification_id: Option<String>,
    pub certificate_id: Option<Uuid>,
    pub name_on_certificate: Option<String>,
}

/// Returns one row per enrolled student with their overall course certificate info.
pub async fn get_certificates_grid_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CertificateGridRow>> {
    let rows = sqlx::query_as!(
        CertificateGridRow,
        r#"
WITH enrolled AS (
  SELECT DISTINCT user_id
  FROM course_instance_enrollments
  WHERE course_id = $1
    AND deleted_at IS NULL
),
user_certs AS (
  -- one latest certificate per user for this course
  SELECT DISTINCT ON (gc.user_id)
    gc.user_id,
    gc.id,
    gc.created_at AS latest_issued_at,
    gc.verification_id,
    gc.name_on_certificate
  FROM generated_certificates gc
  JOIN certificate_configuration_to_requirements cctr
    ON gc.certificate_configuration_id = cctr.certificate_configuration_id
   AND cctr.deleted_at IS NULL
  JOIN course_modules cm
    ON cm.id = cctr.course_module_id
   AND cm.deleted_at IS NULL
  WHERE cm.course_id = $1
    AND gc.deleted_at IS NULL
  ORDER BY gc.user_id, gc.created_at DESC
)
SELECT
  /* non-null */
  CASE
    WHEN ud.first_name IS NULL OR TRIM(ud.first_name) = ''
      OR ud.last_name  IS NULL OR TRIM(ud.last_name)  = ''
    THEN '(Missing name)'
    ELSE TRIM(ud.first_name) || ' ' || TRIM(ud.last_name)
  END AS "student!",

  /* non-null */
  CASE
    WHEN uc.user_id IS NOT NULL THEN 'Course Certificate'
    ELSE 'No Certificate'
  END AS "certificate!",

  /* nullable */
  uc.latest_issued_at AS "date_issued?",
  uc.verification_id  AS "verification_id?",
  uc.id               AS "certificate_id?",
  uc.name_on_certificate AS "name_on_certificate?"

FROM enrolled e
JOIN users u ON u.id = e.user_id
LEFT JOIN user_details ud ON ud.user_id = u.id
LEFT JOIN user_certs uc ON uc.user_id = e.user_id
ORDER BY
  COALESCE(NULLIF(LOWER(TRIM(ud.last_name)),  ''), 'zzzzzz'),
  COALESCE(NULLIF(LOWER(TRIM(ud.first_name)), ''), 'zzzzzz')
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(rows)
}
