use crate::models::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Connection, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, TS)]
pub struct NewFeedback {
    pub feedback_given: String,
    pub related_blocks: Vec<FeedbackBlock>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, TS)]
pub struct FeedbackBlock {
    pub id: Uuid,
    pub text: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    new_feedback: NewFeedback,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let res = sqlx::query!(
        "
INSERT INTO feedback(user_id, course_id, feedback_given)
VALUES ($1, $2, $3)
RETURNING id
",
        user_id,
        course_id,
        new_feedback.feedback_given,
    )
    .fetch_one(&mut tx)
    .await?;
    for block in new_feedback.related_blocks {
        sqlx::query!(
            "
INSERT INTO block_feedback(feedback_id, block_id, block_text)
VALUES ($1, $2, $3)
",
            res.id,
            block.id,
            block.text,
        )
        .execute(&mut tx)
        .await?;
    }
    tx.commit().await?;
    Ok(res.id)
}

pub async fn mark_as_read(conn: &mut PgConnection, id: Uuid, read: bool) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE feedback
SET marked_as_read = $1
WHERE id = $2
",
        read,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct Feedback {
    id: Uuid,
    user_id: Uuid,
    course_id: Uuid,
    feedback_given: String,
    marked_as_read: bool,
    created_at: DateTime<Utc>,
    block_ids: Vec<Uuid>,
    block_texts: Vec<String>,
}

pub async fn get_feedback_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Feedback>> {
    let res = sqlx::query!(
        "
SELECT feedback.id,
  feedback.user_id,
  feedback.course_id,
  feedback.feedback_given,
  feedback.marked_as_read,
  feedback.created_at,
  array_agg(block_feedback.block_id) filter (where block_feedback.block_id is not null) AS block_ids,
  array_agg(block_feedback.block_text) filter (where block_feedback.block_text is not null) AS block_texts
FROM feedback
  LEFT JOIN block_feedback ON block_feedback.feedback_id = feedback.id
WHERE course_id = $1
  AND feedback.deleted_at IS NULL
  AND block_feedback.deleted_at IS NULL
GROUP BY feedback.id,
  feedback.user_id,
  feedback.course_id,
  feedback.feedback_given,
  feedback.marked_as_read,
  feedback.created_at
",
        course_id
    )
    .map(|r| Feedback {
        id: r.id,
        user_id: r.user_id,
        course_id: r.course_id,
        feedback_given: r.feedback_given,
        marked_as_read: r.marked_as_read,
        created_at: r.created_at,
        block_ids: r.block_ids.unwrap_or_default(),
        block_texts: r.block_texts.unwrap_or_default(),
    })
    .fetch_all(conn)
    .await?;
    Ok(res)
}
