//! Contains helper functions needed for student view
use crate::chapters::{self, ChapterAvailability, DatabaseChapter, UserChapterProgress};
use crate::prelude::*;
use crate::user_chapter_locking_statuses::UserChapterLockingStatus;
use chrono::{DateTime, Utc};
use sqlx::AssertSqlSafe;
use utoipa::ToSchema;

/// One row of the paginated student identity list (one row per distinct enrolled user).
#[derive(Clone, PartialEq, Deserialize, Serialize, sqlx::FromRow, ToSchema)]

pub struct CourseStudentListRow {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    /// Names of the course instances the user is enrolled in for this course.
    pub course_instances: Vec<String>,
}

/// A page of the student identity list plus the total number of pages for the current filters.
#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]

pub struct StudentsListPage {
    pub data: Vec<CourseStudentListRow>,
    pub total_pages: u32,
}

/// Returns a filtered, sorted, paginated page of the course's enrolled users (identity only).
///
/// `sort_column` is one of `last_name` | `first_name` | `email` and `sort_direction` is `asc` |
/// `desc`; both are matched to fixed SQL fragments (never interpolated from raw input). `search`
/// matches name/email substrings case-insensitively; if it parses as a UUID it also matches the
/// user id exactly. `course_instance_id` optionally narrows to a single instance.
pub async fn get_course_students_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    pagination: Pagination,
    search: Option<&str>,
    sort_column: Option<&str>,
    sort_direction: Option<&str>,
    course_instance_id: Option<Uuid>,
) -> ModelResult<StudentsListPage> {
    // Empty/blank search behaves like no search.
    let search = search.map(str::trim).filter(|s| !s.is_empty());
    let user_id_exact = search.and_then(|s| Uuid::parse_str(s).ok());

    let total_count = sqlx::query!(
        r#"
SELECT COUNT(*) AS "count!"
FROM (
  SELECT u.id
  FROM course_instance_enrollments cie
    JOIN users u ON u.id = cie.user_id
    LEFT JOIN user_details ud ON ud.user_id = u.id
  WHERE cie.course_id = $1
    AND cie.deleted_at IS NULL
    AND ($2::uuid IS NULL OR cie.course_instance_id = $2)
    AND (
      $3::text IS NULL
      OR ud.first_name ILIKE '%' || $3 || '%'
      OR ud.last_name ILIKE '%' || $3 || '%'
      OR ud.email ILIKE '%' || $3 || '%'
      OR ($4::uuid IS NOT NULL AND u.id = $4)
    )
  GROUP BY u.id
) t
        "#,
        course_id,
        course_instance_id,
        search,
        user_id_exact
    )
    .fetch_one(&mut *conn)
    .await?
    .count;

    // Sort column and direction are matched to fixed literals; only bound params carry user data.
    let dir = match sort_direction {
        Some("desc") | Some("DESC") => "DESC",
        _ => "ASC",
    };
    let order_by = match sort_column {
        Some("first_name") => {
            format!(
                "LOWER(TRIM(ud.first_name)) {dir} NULLS LAST, LOWER(TRIM(ud.last_name)) ASC NULLS LAST"
            )
        }
        Some("email") => format!("LOWER(ud.email) {dir} NULLS LAST"),
        _ => {
            format!(
                "LOWER(TRIM(ud.last_name)) {dir} NULLS LAST, LOWER(TRIM(ud.first_name)) ASC NULLS LAST"
            )
        }
    };

    let page_sql = format!(
        r#"
SELECT
  u.id AS user_id,
  ud.first_name AS first_name,
  ud.last_name AS last_name,
  ud.email AS email,
  COALESCE(
    array_agg(DISTINCT ci.name) FILTER (WHERE ci.name IS NOT NULL),
    ARRAY[]::text[]
  ) AS course_instances
FROM course_instance_enrollments cie
  JOIN users u ON u.id = cie.user_id
  LEFT JOIN user_details ud ON ud.user_id = u.id
  JOIN course_instances ci ON ci.id = cie.course_instance_id
WHERE cie.course_id = $1
  AND cie.deleted_at IS NULL
  AND ($4::uuid IS NULL OR cie.course_instance_id = $4)
  AND (
    $2::text IS NULL
    OR ud.first_name ILIKE '%' || $2 || '%'
    OR ud.last_name ILIKE '%' || $2 || '%'
    OR ud.email ILIKE '%' || $2 || '%'
    OR ($3::uuid IS NOT NULL AND u.id = $3)
  )
GROUP BY u.id, ud.first_name, ud.last_name, ud.email
ORDER BY {order_by}
LIMIT $5 OFFSET $6
        "#
    );

    let data = sqlx::query_as::<_, CourseStudentListRow>(AssertSqlSafe(page_sql))
        .bind(course_id)
        .bind(search)
        .bind(user_id_exact)
        .bind(course_instance_id)
        .bind(pagination.limit())
        .bind(pagination.offset())
        .fetch_all(&mut *conn)
        .await?;

    Ok(StudentsListPage {
        data,
        total_pages: pagination.total_pages(total_count as u32),
    })
}

#[derive(Clone, PartialEq, Deserialize, Serialize, sqlx::FromRow, ToSchema)]

pub struct CompletionGridRow {
    pub user_id: Uuid,
    pub module: Option<String>, // empty/default row can be None
    pub grade: Option<i32>,     // raw numeric grade, if any
    pub passed: Option<bool>,   // pass/fail when there is no numeric grade
    pub registered: bool,       // registered to a study registry
    pub needs_to_be_reviewed: bool,
}

/// Returns student × module completion rows for the given users, keyed by `user_id`.
pub async fn get_completions_grid_for_users(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_ids: &[Uuid],
) -> ModelResult<Vec<CompletionGridRow>> {
    let rows = sqlx::query_as!(
        CompletionGridRow,
        r#"
WITH modules AS (
  SELECT id AS module_id, name AS module_name, order_number
  FROM course_modules
  WHERE course_id = $1
    AND deleted_at IS NULL
),
targets AS (
  SELECT DISTINCT user_id
  FROM course_instance_enrollments
  WHERE course_id = $1
    AND deleted_at IS NULL
    AND user_id = ANY($2::uuid[])
),
latest_cmc AS (
  SELECT DISTINCT ON (cmc.user_id, cmc.course_module_id)
    cmc.id,
    cmc.user_id,
    cmc.course_module_id,
    cmc.grade,
    cmc.passed,
    cmc.completion_date,
    cmc.needs_to_be_reviewed
  FROM course_module_completions cmc
  WHERE cmc.course_id = $1
    AND cmc.deleted_at IS NULL
    AND cmc.user_id = ANY($2::uuid[])
  ORDER BY cmc.user_id, cmc.course_module_id, cmc.completion_date DESC
),
cmcr AS (
  SELECT course_module_completion_id
  FROM course_module_completion_registered_to_study_registries
  WHERE course_id = $1
    AND deleted_at IS NULL
)
SELECT
  e.user_id AS "user_id!",
  m.module_name AS "module?",
  r.grade AS "grade?",
  r.passed AS "passed?",
  (r.id IS NOT NULL AND r.id IN (SELECT course_module_completion_id FROM cmcr)) AS "registered!",
  COALESCE(r.needs_to_be_reviewed, false) AS "needs_to_be_reviewed!"
FROM modules m
CROSS JOIN targets e
LEFT JOIN latest_cmc r
  ON r.user_id = e.user_id
 AND r.course_module_id = m.module_id
        "#,
        course_id,
        user_ids
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows)
}

#[derive(Clone, PartialEq, Deserialize, Serialize, sqlx::FromRow, ToSchema)]

pub struct CertificateGridRow {
    pub user_id: Uuid,
    pub date_issued: Option<DateTime<Utc>>,
    pub verification_id: Option<String>,
    pub certificate_id: Option<Uuid>,
    pub name_on_certificate: Option<String>,
}

/// Returns the latest course certificate (if any) for each of the given users, keyed by `user_id`.
pub async fn get_certificates_grid_for_users(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_ids: &[Uuid],
) -> ModelResult<Vec<CertificateGridRow>> {
    let rows = sqlx::query_as!(
        CertificateGridRow,
        r#"
WITH targets AS (
  SELECT DISTINCT user_id
  FROM course_instance_enrollments
  WHERE course_id = $1
    AND deleted_at IS NULL
    AND user_id = ANY($2::uuid[])
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
    AND gc.user_id = ANY($2::uuid[])
  ORDER BY gc.user_id, gc.created_at DESC
)
SELECT
  e.user_id AS "user_id!",
  uc.latest_issued_at AS "date_issued?",
  uc.verification_id AS "verification_id?",
  uc.id AS "certificate_id?",
  uc.name_on_certificate AS "name_on_certificate?"
FROM targets e
LEFT JOIN user_certs uc ON uc.user_id = e.user_id
        "#,
        course_id,
        user_ids
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows)
}

/// Per-user progress detail for the Progress tab. Course-level `chapters` / `chapter_availability`
/// are returned once; the per-user vectors are scoped to the requested `user_ids`.
#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]

pub struct CourseStudentsProgress {
    pub chapter_locking_enabled: bool,
    pub chapters: Vec<DatabaseChapter>,
    pub chapter_availability: Vec<ChapterAvailability>,
    pub user_chapter_progress: Vec<UserChapterProgress>,
    pub user_chapter_locking_statuses: Vec<UserChapterLockingStatus>,
}

pub async fn get_progress_for_users(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_ids: &[Uuid],
) -> ModelResult<CourseStudentsProgress> {
    let course = crate::courses::get_course(conn, course_id).await?;
    let chapters = crate::chapters::course_chapters(conn, course_id).await?;
    let chapter_availability = chapters::fetch_chapter_availability(conn, course_id).await?;
    let user_chapter_progress =
        chapters::fetch_user_chapter_progress_for_users(conn, course_id, user_ids).await?;
    let user_chapter_locking_statuses =
        crate::user_chapter_locking_statuses::get_for_users_and_course(conn, user_ids, &course)
            .await?;

    Ok(CourseStudentsProgress {
        chapter_locking_enabled: course.chapter_locking_enabled,
        chapters,
        chapter_availability,
        user_chapter_progress,
        user_chapter_locking_statuses,
    })
}
