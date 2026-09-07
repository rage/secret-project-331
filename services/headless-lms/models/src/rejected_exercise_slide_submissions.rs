use crate::{
    exercise_task_submissions::AnswerKind,
    library::grading::{
        StudentExerciseSlideSubmission, StudentExerciseTaskSubmission, SubmittedAnswer,
    },
    prelude::*,
};

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct RejectedExerciseSlideSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub http_status_code: Option<i32>,
    pub error_message: Option<String>,
    pub response_body: Option<String>,
}

pub async fn insert_rejected_exercise_slide_submission(
    conn: &mut PgConnection,
    rejected_submission: &StudentExerciseSlideSubmission,
    user_id: Uuid,
    http_status_code: Option<i32>,
    error_message: Option<String>,
    response_body: Option<String>,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let res = sqlx::query!(
        "
INSERT INTO rejected_exercise_slide_submissions (
    user_id,
    exercise_slide_id,
    http_status_code,
    error_message,
    response_body
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
        ",
        user_id,
        rejected_submission.exercise_slide_id,
        http_status_code,
        error_message,
        response_body,
    )
    .fetch_one(&mut *tx)
    .await?;

    for task in &rejected_submission.exercise_task_submissions {
        insert_rejected_exercise_task_submission(&mut tx, task, res.id).await?;
    }

    tx.commit().await?;
    Ok(res.id)
}

/// Used internally only by the `insert_rejected_exercise_slide_submission` function.
async fn insert_rejected_exercise_task_submission(
    conn: &mut PgConnection,
    rejected_submission: &StudentExerciseTaskSubmission,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Uuid> {
    let answer = rejected_submission.to_submitted_answer()?;
    let (answer_kind, answer_json, file_upload_ids) = match &answer {
        SubmittedAnswer::Json { data } => (AnswerKind::Json, Some(data), None),
        SubmittedAnswer::File {
            metadata,
            file_upload_ids,
        } => (AnswerKind::File, metadata.as_ref(), Some(file_upload_ids)),
    };
    let res = sqlx::query!(
        "
INSERT INTO rejected_exercise_task_submissions (
    rejected_exercise_slide_submission_id,
    data_json,
    answer_kind
  )
VALUES ($1, $2, $3)
RETURNING id
        ",
        exercise_slide_submission_id,
        answer_json,
        answer_kind,
    )
    .fetch_one(&mut *conn)
    .await?;
    if let Some(file_upload_ids) = file_upload_ids {
        insert_rejected_exercise_task_submission_files(conn, res.id, file_upload_ids).await?;
    }
    Ok(res.id)
}

/// Records which files a rejected file answer named.
///
/// The files themselves are not spared from the exercise_answer_uploads reaper, so this is what a
/// later diagnosis has to work from: the ids still resolve to soft-deleted file_uploads rows
/// carrying each file's name, type and size.
///
/// `order_number` must stay encoded exactly as
/// [`exercise_task_submission_files::insert_many`](crate::exercise_task_submission_files::insert_many)
/// encodes it, so a rejection can be compared against an accepted answer.
async fn insert_rejected_exercise_task_submission_files(
    conn: &mut PgConnection,
    rejected_exercise_task_submission_id: Uuid,
    file_upload_ids: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO rejected_exercise_task_submission_files (
    rejected_exercise_task_submission_id,
    file_upload_id,
    order_number
  )
SELECT $1,
  file_upload_id,
  (ordinality - 1)::integer
FROM UNNEST($2::uuid []) WITH ORDINALITY AS t(file_upload_id, ordinality)
",
        rejected_exercise_task_submission_id,
        file_upload_ids
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// How many live rejections a user has collected on a slide.
pub async fn count_with_slide_and_user_ids(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
    user_id: Uuid,
) -> ModelResult<u32> {
    let count = sqlx::query_scalar!(
        r#"
SELECT count(*) AS "count!"
FROM rejected_exercise_slide_submissions
WHERE exercise_slide_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
"#,
        exercise_slide_id,
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(count.try_into()?)
}
