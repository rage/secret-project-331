use chrono::Duration;

use crate::{courses::Course, prelude::*};
use headless_lms_utils::document_schema_processor::GutenbergBlock;

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Exam {
    pub id: Uuid,
    pub name: String,
    pub instructions: serde_json::Value,
    pub page_id: Uuid,
    pub courses: Vec<Course>,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub time_minutes: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct OrgExam {
    pub id: Uuid,
    pub name: String,
    pub instructions: serde_json::Value,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub time_minutes: i32,
    pub organization_id: Uuid,
}

pub async fn get(conn: &mut PgConnection, id: Uuid) -> ModelResult<Exam> {
    let exam = sqlx::query!(
        "
SELECT exams.id,
  exams.name,
  exams.instructions,
  pages.id AS page_id,
  exams.starts_at,
  exams.ends_at,
  exams.time_minutes
FROM exams
  JOIN pages ON pages.exam_id = exams.id
WHERE exams.id = $1
",
        id
    )
    .fetch_one(&mut *conn)
    .await?;

    let courses = sqlx::query_as!(
        Course,
        "
SELECT id,
  slug,
  created_at,
  updated_at,
  name,
  description,
  organization_id,
  deleted_at,
  language_code,
  copied_from,
  content_search_language::text,
  course_language_group_id,
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions
FROM courses
  JOIN course_exams ON courses.id = course_exams.course_id
WHERE course_exams.exam_id = $1
AND deleted_at IS NULL
",
        id
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(Exam {
        id: exam.id,
        name: exam.name,
        instructions: exam.instructions,
        page_id: exam.page_id,
        starts_at: exam.starts_at,
        ends_at: exam.ends_at,
        time_minutes: exam.time_minutes,
        courses,
    })
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseExam {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewExam {
    pub name: String,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub time_minutes: i32,
    pub organization_id: Uuid,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExamInstructions {
    pub id: Uuid,
    pub instructions: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExamInstructionsUpdate {
    pub instructions: serde_json::Value,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    exam: &NewExam,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exams (
    id,
    name,
    instructions,
    starts_at,
    ends_at,
    time_minutes,
    organization_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        exam.name,
        serde_json::Value::Array(vec![]),
        exam.starts_at,
        exam.ends_at,
        exam.time_minutes,
        exam.organization_id
    )
    .fetch_one(conn)
    .await?;

    Ok(res.id)
}

pub async fn edit(
    conn: &mut PgConnection,
    id: Uuid,
    name: Option<&str>,
    starts_at: Option<DateTime<Utc>>,
    ends_at: Option<DateTime<Utc>>,
    time_minutes: Option<i32>,
) -> ModelResult<()> {
    if time_minutes.map(|i| i > 0).unwrap_or_default() {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Exam duration has to be positive".to_string(),
            None,
        ));
    }
    sqlx::query!(
        "
UPDATE exams
SET name = COALESCE($2, name),
  starts_at = $3,
  ends_at = $4,
  time_minutes = $5
WHERE id = $1
",
        id,
        name,
        starts_at,
        ends_at,
        time_minutes,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_course(conn: &mut PgConnection, id: Uuid, course: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_exams (course_id, exam_id)
VALUES ($1, $2)
",
        course,
        id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn unset_course(conn: &mut PgConnection, id: Uuid, course: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
DELETE FROM course_exams
WHERE exam_id = $1
  AND course_id = $2
",
        id,
        course
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_exams_for_organization(
    conn: &mut PgConnection,
    organization: Uuid,
) -> ModelResult<Vec<OrgExam>> {
    let res = sqlx::query_as!(
        OrgExam,
        "
SELECT id,
  name,
  instructions,
  starts_at,
  ends_at,
  time_minutes,
  organization_id
FROM exams
WHERE exams.organization_id = $1
  AND exams.deleted_at IS NULL
",
        organization
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_exams_for_organization(
    conn: &mut PgConnection,
    organization: Uuid,
) -> ModelResult<Vec<CourseExam>> {
    let res = sqlx::query_as!(
        CourseExam,
        "
SELECT exams.id,
  courses.id as course_id,
  courses.name as course_name,
  exams.name
FROM exams
  JOIN course_exams ON course_exams.exam_id = exams.id
  JOIN courses ON courses.id = course_exams.course_id
WHERE exams.organization_id = $1
  AND exams.deleted_at IS NULL
  AND courses.deleted_at IS NULL
",
        organization
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_exams_for_course(
    conn: &mut PgConnection,
    course: Uuid,
) -> ModelResult<Vec<CourseExam>> {
    let res = sqlx::query_as!(
        CourseExam,
        "
SELECT exams.id,
  courses.id as course_id,
  courses.name as course_name,
  exams.name
FROM exams
  JOIN course_exams ON course_id = $1
  JOIN courses ON courses.id = $1
  AND exams.deleted_at IS NULL
  AND courses.deleted_at IS NULL
",
        course
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn enroll(conn: &mut PgConnection, exam_id: Uuid, user_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exam_enrollments (exam_id, user_id)
VALUES ($1, $2)
",
        exam_id,
        user_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Checks whether a submission can be made for the given exam.
pub async fn verify_exam_submission_can_be_made(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
) -> ModelResult<bool> {
    let exam = get(conn, exam_id).await?;
    let enrollment = get_enrollment(conn, exam_id, user_id)
        .await?
        .ok_or_else(|| {
            ModelError::new(
                ModelErrorType::PreconditionFailed,
                "User has no enrollment for the exam".to_string(),
                None,
            )
        })?;
    let student_has_time =
        Utc::now() <= enrollment.started_at + Duration::minutes(exam.time_minutes.into());
    let exam_is_ongoing = exam.ends_at.map(|ea| Utc::now() < ea).unwrap_or_default();
    Ok(student_has_time && exam_is_ongoing)
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExamEnrollment {
    pub user_id: Uuid,
    pub exam_id: Uuid,
    pub started_at: DateTime<Utc>,
}

pub async fn get_enrollment(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<ExamEnrollment>> {
    let res = sqlx::query_as!(
        ExamEnrollment,
        "
SELECT user_id,
  exam_id,
  started_at
FROM exam_enrollments
WHERE exam_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
",
        exam_id,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_organization_id(conn: &mut PgConnection, exam_id: Uuid) -> ModelResult<Uuid> {
    let organization_id = sqlx::query!(
        "
SELECT organization_id
FROM exams
WHERE id = $1
",
        exam_id
    )
    .fetch_one(conn)
    .await?
    .organization_id;
    Ok(organization_id)
}

pub async fn get_exam_instructions_data(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> ModelResult<ExamInstructions> {
    let exam_instructions_data = sqlx::query_as!(
        ExamInstructions,
        "
SELECT id, instructions
FROM exams
WHERE id = $1;
",
        exam_id
    )
    .fetch_one(conn)
    .await?;
    Ok(exam_instructions_data)
}

pub async fn update_exam_instructions(
    conn: &mut PgConnection,
    exam_id: Uuid,
    instructions_update: ExamInstructionsUpdate,
) -> ModelResult<ExamInstructions> {
    let parsed_content: Vec<GutenbergBlock> =
        serde_json::from_value(instructions_update.instructions)?;
    let updated_data = sqlx::query_as!(
        ExamInstructions,
        "
    UPDATE exams
    SET instructions = $1
    WHERE id = $2
    RETURNING id,
        instructions
    ",
        serde_json::to_value(parsed_content)?,
        exam_id
    )
    .fetch_one(conn)
    .await?;

    Ok(updated_data)
}
