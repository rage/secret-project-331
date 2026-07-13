use std::collections::HashMap;

use crate::{
    course_instances::CourseInstance, course_module_completions::CourseModuleCompletion,
    courses::Course, prelude::*, user_course_settings::UserCourseSettings,
};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseInstanceEnrollment {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]

pub struct CourseInstanceEnrollmentsInfo {
    pub course_instance_enrollments: Vec<CourseInstanceEnrollment>,
    pub course_instances: Vec<CourseInstance>,
    pub courses: Vec<Course>,
    pub user_course_settings: Vec<UserCourseSettings>,
    pub course_module_completions: Vec<CourseModuleCompletion>,
}

/// One UTC day's exercise-submission count for a module, used for the activity-density violins on the
/// cross-course timeline. `day` is midnight of the day the submissions fall in.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct DailySubmissionCount {
    pub day: DateTime<Utc>,
    pub count: i32,
}

/// Slim module descriptor so the frontend can label per-module completions and show "X of Y modules"
/// without a separate course-structure fetch. Default (base) module has `name = None`.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseModuleInfo {
    pub id: Uuid,
    pub name: Option<String>,
    pub order_number: i32,
    /// Earliest exercise submission by this user in this module. No module "start" is stored, so the
    /// frontend uses this to infer when an additional module was first worked on. `None` if untouched.
    pub first_submission_at: Option<DateTime<Utc>>,
    /// Number of non-deleted exercises in this module. Submission density is divided by this so courses
    /// of very different size stay comparable. `0` if the module has no chapter-bound exercises.
    pub exercise_count: i32,
    /// This user's exercise submissions in this module bucketed by UTC day, ascending. Empty if none.
    pub daily_submissions: Vec<DailySubmissionCount>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseEnrollmentInfo {
    pub course_id: Uuid,
    pub course: Course,
    pub course_instances: Vec<CourseInstance>,
    pub user_course_settings: Option<UserCourseSettings>,
    /// All non-deleted modules of the course, ordered by `order_number`.
    pub course_modules: Vec<CourseModuleInfo>,
    pub course_module_completions: Vec<CourseModuleCompletion>,
    pub course_module_completions_needing_review: i32,
    pub first_enrolled_at: DateTime<Utc>,
    pub is_current: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseEnrollmentsInfo {
    pub course_enrollments: Vec<CourseEnrollmentInfo>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_instance_enrollments (user_id, course_id, course_instance_id)
VALUES ($1, $2, $3)
",
        user_id,
        course_id,
        course_instance_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct NewCourseInstanceEnrollment {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
}

/**
Inserts enrollment if it doesn't exist yet; on conflict updates deleted_at to NULL (upsert).

Handles duplicate submissions (e.g. multiple tabs or parallel requests) by conflicting on (user_id, course_id, course_instance_id).
*/
pub async fn insert_enrollment_if_it_doesnt_exist(
    conn: &mut PgConnection,
    enrollment: NewCourseInstanceEnrollment,
) -> ModelResult<CourseInstanceEnrollment> {
    let enrollment = sqlx::query_as!(
        CourseInstanceEnrollment,
        "
INSERT INTO course_instance_enrollments (user_id, course_id, course_instance_id)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, course_id, course_instance_id)
DO UPDATE SET deleted_at = NULL
RETURNING *;
",
        enrollment.user_id,
        enrollment.course_id,
        enrollment.course_instance_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(enrollment)
}

pub async fn insert_enrollment_and_set_as_current(
    conn: &mut PgConnection,
    new_enrollment: NewCourseInstanceEnrollment,
) -> ModelResult<CourseInstanceEnrollment> {
    let mut tx = conn.begin().await?;

    let enrollment = insert_enrollment_if_it_doesnt_exist(&mut tx, new_enrollment).await?;
    crate::user_course_settings::upsert_user_course_settings_for_enrollment(&mut tx, &enrollment)
        .await?;
    tx.commit().await?;

    Ok(enrollment)
}

pub async fn get_by_user_and_course_instance_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<CourseInstanceEnrollment> {
    let res = sqlx::query_as!(
        CourseInstanceEnrollment,
        "
SELECT *
FROM course_instance_enrollments
WHERE user_id = $1
  AND course_instance_id = $2
  AND deleted_at IS NULL
        ",
        user_id,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<CourseInstanceEnrollment>> {
    let res = sqlx::query_as!(
        CourseInstanceEnrollment,
        "
SELECT *
FROM course_instance_enrollments
WHERE user_id = $1
  AND deleted_at IS NULL
        ",
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_user_id_and_course_ids(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_ids: &[Uuid],
) -> ModelResult<Vec<CourseInstanceEnrollment>> {
    let res = sqlx::query_as!(
        CourseInstanceEnrollment,
        "
SELECT *
FROM course_instance_enrollments
WHERE user_id = $1
  AND course_id = ANY($2)
  AND deleted_at IS NULL
        ",
        user_id,
        course_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_instance_enrollments_info_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<CourseInstanceEnrollmentsInfo> {
    let course_instance_enrollments = get_by_user_id(conn, user_id).await?;

    let course_instance_ids: Vec<Uuid> = course_instance_enrollments
        .iter()
        .map(|e| e.course_instance_id)
        .collect();

    let course_instances = crate::course_instances::get_by_ids(conn, &course_instance_ids).await?;

    let course_ids: Vec<Uuid> = course_instances.iter().map(|e| e.course_id).collect();

    let courses = crate::courses::get_by_ids(conn, &course_ids).await?;

    let course_module_completions =
        crate::course_module_completions::get_all_by_user_id(conn, user_id).await?;

    // Returns all user course settings because there is always an enrollment for a current course instance (enforced by a database constraint), and all of those are in the course_ids list
    let user_course_settings =
        crate::user_course_settings::get_all_by_user_and_multiple_current_courses(
            conn,
            &course_ids,
            user_id,
        )
        .await?;

    Ok(CourseInstanceEnrollmentsInfo {
        course_instance_enrollments,
        course_instances,
        courses,
        user_course_settings,
        course_module_completions,
    })
}

struct CourseEnrollmentRow {
    course_id: Uuid,
    first_enrolled_at: Option<DateTime<Utc>>,
}

/// Returns one entry per course the user is enrolled in, with aggregated data.
pub async fn get_course_enrollments_info_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<CourseEnrollmentsInfo> {
    let rows = sqlx::query_as!(
        CourseEnrollmentRow,
        "
SELECT course_id, MIN(created_at) AS first_enrolled_at
FROM course_instance_enrollments
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY course_id
ORDER BY first_enrolled_at
        ",
        user_id
    )
    .fetch_all(&mut *conn)
    .await?;

    let course_ids: Vec<Uuid> = rows.iter().map(|r| r.course_id).collect();

    // Earliest submission per module for this user; module ids are globally unique, so grouping by
    // module alone is enough. Used to infer when an additional (non-base) module was first worked on.
    let module_first_submission_rows = sqlx::query!(
        r#"
SELECT c.course_module_id AS "course_module_id?",
       MIN(ess.created_at) AS "first_submission_at!"
FROM exercise_slide_submissions ess
JOIN exercises e ON e.id = ess.exercise_id
LEFT JOIN chapters c ON c.id = e.chapter_id
WHERE ess.user_id = $1 AND ess.course_id = ANY($2) AND ess.deleted_at IS NULL
GROUP BY c.course_module_id
        "#,
        user_id,
        &course_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let first_submission_by_module: HashMap<Uuid, DateTime<Utc>> = module_first_submission_rows
        .into_iter()
        .filter_map(|r| r.course_module_id.map(|id| (id, r.first_submission_at)))
        .collect();

    // Exercise count per module, to normalize submission density (submissions per exercise) so courses
    // of very different size are comparable. Exercises map to a module via their chapter; exercises with
    // no chapter (e.g. exams) are not counted.
    let module_exercise_count_rows = sqlx::query!(
        r#"
SELECT c.course_module_id AS "course_module_id!",
       COUNT(*) AS "count!"
FROM exercises e
JOIN chapters c ON c.id = e.chapter_id AND c.deleted_at IS NULL
WHERE e.course_id = ANY($1) AND e.deleted_at IS NULL
GROUP BY c.course_module_id
        "#,
        &course_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let exercise_count_by_module: HashMap<Uuid, i64> = module_exercise_count_rows
        .into_iter()
        .map(|r| (r.course_module_id, r.count))
        .collect();

    // This user's submissions per module bucketed by UTC day, for the activity-density violins. Restricts
    // to the same non-deleted exercises/chapters as the exercise-count query above so the density
    // numerator and denominator agree; DATE_TRUNC is anchored to UTC (not the session timezone) so the
    // buckets line up with the frontend's fixed 24h grid.
    let module_daily_submission_rows = sqlx::query!(
        r#"
SELECT c.course_module_id AS "course_module_id!",
       DATE_TRUNC('day', ess.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS "day!",
       COUNT(*) AS "count!"
FROM exercise_slide_submissions ess
JOIN exercises e ON e.id = ess.exercise_id AND e.deleted_at IS NULL
JOIN chapters c ON c.id = e.chapter_id AND c.deleted_at IS NULL
WHERE ess.user_id = $1 AND ess.course_id = ANY($2) AND ess.deleted_at IS NULL
GROUP BY c.course_module_id, DATE_TRUNC('day', ess.created_at AT TIME ZONE 'UTC')
ORDER BY c.course_module_id, "day!"
        "#,
        user_id,
        &course_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut daily_submissions_by_module: HashMap<Uuid, Vec<DailySubmissionCount>> = HashMap::new();
    for r in module_daily_submission_rows {
        daily_submissions_by_module
            .entry(r.course_module_id)
            .or_default()
            .push(DailySubmissionCount {
                day: r.day,
                count: r.count as i32,
            });
    }

    let course_instance_enrollments = get_by_user_id(&mut *conn, user_id).await?;
    let all_course_module_completions =
        crate::course_module_completions::get_all_by_user_id(conn, user_id).await?;
    let user_course_settings =
        crate::user_course_settings::get_all_by_user_id(conn, user_id).await?;
    let courses = crate::courses::get_by_ids(conn, &course_ids).await?;
    let course_instance_ids: Vec<Uuid> = course_instance_enrollments
        .iter()
        .map(|e| e.course_instance_id)
        .collect();
    let all_course_instances =
        crate::course_instances::get_by_ids(conn, &course_instance_ids).await?;
    let all_course_modules = crate::course_modules::get_by_course_ids(conn, &course_ids).await?;

    let mut course_enrollments = Vec::with_capacity(rows.len());
    for row in rows {
        let course = courses
            .iter()
            .find(|c| c.id == row.course_id)
            .cloned()
            .ok_or_else(|| {
                crate::ModelError::new(
                    crate::error::ModelErrorType::NotFound,
                    "Course not found for enrollment".to_string(),
                    None,
                )
            })?;
        let course_instances: Vec<_> = all_course_instances
            .iter()
            .filter(|ci| ci.course_id == row.course_id)
            .cloned()
            .collect();
        let user_course_settings_for_course = user_course_settings
            .iter()
            .find(|ucs| ucs.course_language_group_id == course.course_language_group_id)
            .cloned();
        let course_modules = all_course_modules
            .iter()
            .filter(|m| m.course_id == row.course_id)
            .map(|m| CourseModuleInfo {
                id: m.id,
                name: m.name.clone(),
                order_number: m.order_number,
                first_submission_at: first_submission_by_module.get(&m.id).copied(),
                exercise_count: exercise_count_by_module.get(&m.id).copied().unwrap_or(0) as i32,
                daily_submissions: daily_submissions_by_module
                    .get(&m.id)
                    .cloned()
                    .unwrap_or_default(),
            })
            .collect();
        let course_module_completions = all_course_module_completions
            .iter()
            .filter(|cmc| cmc.course_id == row.course_id)
            .cloned()
            .collect();
        let course_module_completions_needing_review = all_course_module_completions
            .iter()
            .filter(|cmc| cmc.course_id == row.course_id && cmc.needs_to_be_reviewed)
            .count() as i32;
        let is_current = user_course_settings_for_course
            .as_ref()
            .map(|ucs| ucs.current_course_id == row.course_id)
            .unwrap_or(false);

        let first_enrolled_at = row.first_enrolled_at.ok_or_else(|| {
            crate::ModelError::new(
                crate::error::ModelErrorType::Generic,
                "first_enrolled_at missing for grouped enrollment row".to_string(),
                None,
            )
        })?;

        course_enrollments.push(CourseEnrollmentInfo {
            course_id: row.course_id,
            course,
            course_instances,
            user_course_settings: user_course_settings_for_course,
            course_modules,
            course_module_completions,
            course_module_completions_needing_review,
            first_enrolled_at,
            is_current,
        });
    }

    Ok(CourseEnrollmentsInfo { course_enrollments })
}
