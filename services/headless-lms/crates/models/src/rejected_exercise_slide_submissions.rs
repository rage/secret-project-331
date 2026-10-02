use crate::prelude::*;

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
