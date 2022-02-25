use std::collections::HashMap;

use chrono::Duration;
use serde_json::Value;

use crate::{courses::Course, prelude::*};

#[derive(Debug, Serialize, TS)]
pub struct Exam {
    pub id: Uuid,
    pub name: String,
    pub instructions: String,
    pub page_id: Uuid,
    pub courses: Vec<Course>,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub time_minutes: i32,
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
  course_language_group_id
FROM courses
  JOIN course_exams ON courses.id = course_exams.course_id
WHERE course_exams.exam_id = $1
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

#[derive(Debug, Serialize, TS)]
pub struct CourseExam {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct NewExam {
    pub id: Uuid,
    pub name: String,
    pub instructions: String,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub time_minutes: i32,
    pub organization_id: Uuid,
}

pub async fn insert(conn: &mut PgConnection, exam: NewExam) -> ModelResult<()> {
    sqlx::query!(
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
",
        exam.id,
        exam.name,
        exam.instructions,
        exam.starts_at,
        exam.ends_at,
        exam.time_minutes,
        exam.organization_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn edit(
    conn: &mut PgConnection,
    id: Uuid,
    name: Option<&str>,
    instructions: Option<&str>,
    starts_at: Option<DateTime<Utc>>,
    ends_at: Option<DateTime<Utc>>,
    time_minutes: Option<i32>,
) -> ModelResult<()> {
    if time_minutes.map(|i| i > 0).unwrap_or_default() {
        return Err(ModelError::PreconditionFailed(
            "Exam duration has to be positive".to_string(),
        ));
    }
    sqlx::query!(
        "
UPDATE exams
SET name = COALESCE($2, name),
instructions = COALESCE($3, instructions),
  starts_at = $4,
  ends_at = $5,
  time_minutes = $6
WHERE id = $1
",
        id,
        name,
        instructions,
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
            ModelError::PreconditionFailed("User has no enrollment for the exam".to_string())
        })?;
    let student_has_time =
        Utc::now() <= enrollment.started_at + Duration::minutes(exam.time_minutes.into());
    let exam_is_ongoing = exam.ends_at.map(|ea| Utc::now() < ea).unwrap_or_default();
    Ok(student_has_time || exam_is_ongoing)
}

#[derive(Debug, Serialize, TS)]
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

pub async fn copy_exam(conn: &mut PgConnection, exam_id: Uuid) -> ModelResult<Exam> {
    let exam = get(conn, exam_id).await?;
    copy_exam_internals(conn, exam).await
}

pub async fn copy_exam_internals(conn: &mut PgConnection, parent_exam: Exam) -> ModelResult<Exam> {
    let mut tx = conn.begin().await?;

    let res = sqlx::query!(
        "SELECT language, organization_id FROM exams WHERE id = $1",
        parent_exam.id
    )
    .fetch_one(&mut tx)
    .await?;

    // create new exam
    let new_copied_exam = sqlx::query!(
        "
INSERT INTO exams(
    name,
    organization_id,
    instructions,
    starts_at,
    ends_at,
    language,
    time_minutes
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;
    ",
        parent_exam.name,
        res.organization_id,
        parent_exam.instructions,
        parent_exam.starts_at,
        parent_exam.ends_at,
        res.language,
        parent_exam.time_minutes
    )
    .fetch_one(&mut tx)
    .await?;

    // copy exam pages

    let contents_iter = sqlx::query!(
        "
INSERT INTO pages (
    id,
    course_id,
    content,
    url_path,
    title,
    chapter_id,
    order_number,
    copied_from,
    content_search_language
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  content,
  url_path,
  title,
  uuid_generate_v5($1, chapter_id::text),
  order_number,
  id,
  content_search_language
FROM pages
WHERE (course_id = $2)
RETURNING id,
  content;
    ",
        new_copied_exam.id,
        parent_exam.id
    )
    .fetch_all(&mut tx)
    .await?
    .into_iter()
    .map(|record| (record.id, record.content));

    // copy exercises

    let old_to_new_exercise_ids = sqlx::query!(
        "
INSERT INTO exercises (
    id,
    course_id,
    name,
    deadline,
    page_id,
    score_maximum,
    order_number,
    chapter_id,
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  name,
  deadline,
  uuid_generate_v5($1, page_id::text),
  score_maximum,
  order_number,
  chapter_id,
  id
FROM exercises
WHERE course_id = $2
RETURNING id,
  copied_from;
    ",
        new_copied_exam.id,
        parent_exam.id
    )
    .fetch_all(&mut tx)
    .await?
    .into_iter()
    .map(|record| {
        Ok((
            record
                .copied_from
                .ok_or_else(|| {
                    ModelError::Generic("Query failed to return valid data.".to_string())
                })?
                .to_string(),
            record.id.to_string(),
        ))
    })
    .collect::<ModelResult<HashMap<String, String>>>()?;

    // replace exercise ids
    for (page_id, content) in contents_iter {
        if let Value::Array(mut blocks) = content {
            for block in blocks.iter_mut() {
                if block["name"] != Value::String("moocfi/exercise".to_string()) {
                    continue;
                }
                if let Value::String(old_id) = &block["attributes"]["id"] {
                    let new_id = old_to_new_exercise_ids
                        .get(old_id)
                        .ok_or_else(|| {
                            ModelError::Generic("Invalid exercise id in content.".to_string())
                        })?
                        .to_string();
                    block["attributes"]["id"] = Value::String(new_id);
                }
            }
            sqlx::query!(
                "
UPDATE pages
SET content = $1
WHERE id = $2;
                ",
                Value::Array(blocks),
                page_id,
            )
            .execute(&mut tx)
            .await?;
        }
    }

    // copy exercise slides

    sqlx::query!(
        "
INSERT INTO exercise_slides (
    id, exercise_id, order_number
)
SELECT uuid_generate_v5($1, id::text),
    uuid_generate_v5($1, exercise_id::text),
    order_number
FROM exercise_slides
WHERE exercise_id IN (SELECT id FROM exercises WHERE course_id = $2);
        ",
        new_copied_exam.id,
        parent_exam.id
    )
    .execute(&mut tx)
    .await?;

    // copy exercise tasks
    sqlx::query!(
        "
INSERT INTO exercise_tasks (
    id,
    exercise_slide_id,
    exercise_type,
    assignment,
    private_spec,
    spec_file_id,
    public_spec,
    model_solution_spec,
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  uuid_generate_v5($1, exercise_slide_id::text),
  exercise_type,
  assignment,
  private_spec,
  spec_file_id,
  public_spec,
  model_solution_spec,
  id
FROM exercise_tasks
WHERE exercise_slide_id IN (
    SELECT s.id
    FROM exercise_slides s
      JOIN exercises e ON (e.id = s.exercise_id)
    WHERE e.course_id = $2
  );
    ",
        new_copied_exam.id,
        parent_exam.id,
    )
    .execute(&mut tx)
    .await?;

    tx.commit().await?;

    get(conn, new_copied_exam.id).await
}
