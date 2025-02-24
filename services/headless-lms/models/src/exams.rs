use chrono::Duration;
use std::collections::HashMap;

use crate::{courses::Course, prelude::*};
use headless_lms_utils::document_schema_processor::GutenbergBlock;

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Exam {
    pub id: Uuid,
    pub name: String,
    pub instructions: serde_json::Value,
    // TODO: page_id is not in the exams table, prevents from using select * with query_as!
    pub page_id: Uuid,
    pub courses: Vec<Course>,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub time_minutes: i32,
    pub minimum_points_treshold: i32,
    pub language: String,
    pub grade_manually: bool,
}

impl Exam {
    /// Whether or not the exam has already started at the specified timestamp. If no start date for
    /// exam is defined, returns the provided default instead.
    pub fn started_at_or(&self, timestamp: DateTime<Utc>, default: bool) -> bool {
        match self.starts_at {
            Some(starts_at) => starts_at <= timestamp,
            None => default,
        }
    }

    /// Whether or not the exam has already ended at the specified timestamp. If no end date for exam
    /// is defined, returns the provided default instead.
    pub fn ended_at_or(&self, timestamp: DateTime<Utc>, default: bool) -> bool {
        match self.ends_at {
            Some(ends_at) => ends_at < timestamp,
            None => default,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct OrgExam {
    pub id: Uuid,
    pub name: String,
    pub instructions: serde_json::Value,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub time_minutes: i32,
    pub organization_id: Uuid,
    pub minimum_points_treshold: i32,
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
  exams.time_minutes,
  exams.minimum_points_treshold,
  exams.language,
  exams.grade_manually
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
  courses.created_at,
  courses.updated_at,
  courses.deleted_at,
  name,
  description,
  organization_id,
  language_code,
  copied_from,
  content_search_language::text,
  course_language_group_id,
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions,
  can_add_chatbot,
  is_unlisted,
  is_joinable_by_code_only,
  join_code,
  ask_marketing_consent,
  flagged_answers_threshold
FROM courses
  JOIN course_exams ON courses.id = course_exams.course_id
WHERE course_exams.exam_id = $1
  AND courses.deleted_at IS NULL
  AND course_exams.deleted_at IS NULL
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
        minimum_points_treshold: exam.minimum_points_treshold,
        language: exam.language.unwrap_or("en-US".to_string()),
        grade_manually: exam.grade_manually,
    })
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseExam {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewExam {
    pub name: String,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub time_minutes: i32,
    pub organization_id: Uuid,
    pub minimum_points_treshold: i32,
    pub grade_manually: bool,
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
    organization_id,
    minimum_points_treshold,
    grade_manually
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        exam.name,
        serde_json::Value::Array(vec![]),
        exam.starts_at,
        exam.ends_at,
        exam.time_minutes,
        exam.organization_id,
        exam.minimum_points_treshold,
        exam.grade_manually,
    )
    .fetch_one(conn)
    .await?;

    Ok(res.id)
}

pub async fn edit(conn: &mut PgConnection, id: Uuid, new_exam: NewExam) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exams
SET name = COALESCE($2, name),
  starts_at = $3,
  ends_at = $4,
  time_minutes = $5,
  minimum_points_treshold = $6,
  grade_manually = $7
WHERE id = $1
",
        id,
        new_exam.name,
        new_exam.starts_at,
        new_exam.ends_at,
        new_exam.time_minutes,
        new_exam.minimum_points_treshold,
        new_exam.grade_manually,
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
  organization_id,
  minimum_points_treshold
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

pub async fn get_organization_exam_with_exam_id(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> ModelResult<OrgExam> {
    let res = sqlx::query_as!(
        OrgExam,
        "
SELECT id,
  name,
  instructions,
  starts_at,
  ends_at,
  time_minutes,
  organization_id,
  minimum_points_treshold
FROM exams
WHERE exams.id = $1
  AND exams.deleted_at IS NULL
",
        exam_id
    )
    .fetch_one(conn)
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

pub async fn enroll(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
    is_teacher_testing: bool,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exam_enrollments (exam_id, user_id, is_teacher_testing)
VALUES ($1, $2, $3)
",
        exam_id,
        user_id,
        is_teacher_testing
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExamEnrollment {
    pub user_id: Uuid,
    pub exam_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub is_teacher_testing: bool,
    pub show_exercise_answers: Option<bool>,
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
  started_at,
  ended_at,
  is_teacher_testing,
  show_exercise_answers
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

pub async fn get_exam_enrollments_for_users(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, ExamEnrollment>> {
    let enrollments = sqlx::query_as!(
        ExamEnrollment,
        "
SELECT user_id,
  exam_id,
  started_at,
  ended_at,
  is_teacher_testing,
  show_exercise_answers
FROM exam_enrollments
WHERE user_id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND exam_id = $2
  AND deleted_at IS NULL
",
        user_ids,
        exam_id,
    )
    .fetch_all(conn)
    .await?;

    let mut res: HashMap<Uuid, ExamEnrollment> = HashMap::new();
    for item in enrollments.into_iter() {
        res.insert(item.user_id, item);
    }
    Ok(res)
}

pub async fn get_ongoing_exam_enrollments(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ExamEnrollment>> {
    let enrollments = sqlx::query_as!(
        ExamEnrollment,
        "
SELECT user_id,
  exam_id,
  started_at,
  ended_at,
  is_teacher_testing,
  show_exercise_answers
FROM exam_enrollments
WHERE
    ended_at IS NULL
  AND deleted_at IS NULL
"
    )
    .fetch_all(conn)
    .await?;
    Ok(enrollments)
}

pub async fn get_exams(conn: &mut PgConnection) -> ModelResult<HashMap<Uuid, OrgExam>> {
    let exams = sqlx::query_as!(
        OrgExam,
        "
SELECT id,
  name,
  instructions,
  starts_at,
  ends_at,
  time_minutes,
  organization_id,
  minimum_points_treshold
FROM exams
WHERE deleted_at IS NULL
"
    )
    .fetch_all(conn)
    .await?;

    let mut res: HashMap<Uuid, OrgExam> = HashMap::new();
    for item in exams.into_iter() {
        res.insert(item.id, item);
    }
    Ok(res)
}

pub async fn update_exam_start_time(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
    started_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exam_enrollments
SET started_at = $3
WHERE exam_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
",
        exam_id,
        user_id,
        started_at
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_exam_ended_at(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
    ended_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exam_enrollments
SET ended_at = $3
WHERE exam_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
",
        exam_id,
        user_id,
        ended_at
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_exam_ended_at_for_users_with_exam_id(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_ids: &[Uuid],
    ended_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exam_enrollments
SET ended_at = $3
WHERE user_id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND exam_id = $2
  AND deleted_at IS NULL
",
        user_ids,
        exam_id,
        ended_at
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_show_exercise_answers(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
    show_exercise_answers: bool,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exam_enrollments
SET show_exercise_answers = $3
WHERE exam_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
",
        exam_id,
        user_id,
        show_exercise_answers
    )
    .execute(conn)
    .await?;
    Ok(())
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
