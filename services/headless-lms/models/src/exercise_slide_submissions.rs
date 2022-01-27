use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NewExerciseSlideSubmission {
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub exercise_id: Uuid,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct ExerciseSlideSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub exercise_id: Uuid,
    pub user_id: Uuid,
}

pub async fn insert_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_submission: NewExerciseSlideSubmission,
) -> ModelResult<ExerciseSlideSubmission> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        "
INSERT INTO exercise_slide_submissions (
    course_id,
    course_instance_id,
    exam_id,
    exercise_id,
    user_id
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
        ",
        exercise_slide_submission.course_id,
        exercise_slide_submission.course_instance_id,
        exercise_slide_submission.exam_id,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert_exercise_slide_submission_with_id(
    conn: &mut PgConnection,
    id: Uuid,
    exercise_slide_submission: &NewExerciseSlideSubmission,
) -> ModelResult<ExerciseSlideSubmission> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        "
INSERT INTO exercise_slide_submissions (
    id,
    course_id,
    course_instance_id,
    exam_id,
    exercise_id,
    user_id
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *
        ",
        id,
        exercise_slide_submission.course_id,
        exercise_slide_submission.course_instance_id,
        exercise_slide_submission.exam_id,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    let exercise_slide_submission = sqlx::query_as!(
        ExerciseSlideSubmission,
        "
SELECT *
FROM exercise_slide_submissions
WHERE id = $1
  AND deleted_at IS NULL;
        ",
        id
    )
    .fetch_optional(conn)
    .await?;
    Ok(exercise_slide_submission)
}

pub async fn get_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<ExerciseSlideSubmission>> {
    let submissions = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT *
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND deleted_at IS NULL
LIMIT $2
OFFSET $3;
        "#,
        exercise_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(conn)
    .await?;
    Ok(submissions)
}

pub async fn get_latest_exercise_slide_submission_by_exercise_and_user_ids(
    conn: &mut PgConnection,
    exercise_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        "
SELECT *
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
    ",
        exercise_id,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}
