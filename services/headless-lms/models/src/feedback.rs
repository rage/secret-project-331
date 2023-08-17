use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewFeedback {
    pub feedback_given: String,
    pub selected_text: Option<String>,
    pub related_blocks: Vec<FeedbackBlock>,
    pub page_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct FeedbackBlock {
    pub id: Uuid,
    pub text: Option<String>,
    pub order_number: Option<i32>,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    user_id: Option<Uuid>,
    course_id: Uuid,
    new_feedback: NewFeedback,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let res = sqlx::query!(
        "
INSERT INTO feedback(
    id,
    user_id,
    course_id,
    feedback_given,
    selected_text,
    page_id
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        user_id,
        course_id,
        new_feedback.feedback_given,
        new_feedback.selected_text,
        new_feedback.page_id
    )
    .fetch_one(&mut *tx)
    .await?;
    for (n, block) in new_feedback.related_blocks.iter().enumerate() {
        sqlx::query!(
            "
INSERT INTO block_feedback(feedback_id, block_id, block_text, order_number)
VALUES ($1, $2, $3, $4)
",
            res.id,
            block.id,
            block.text,
            n as i32
        )
        .execute(&mut *tx)
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Feedback {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub course_id: Uuid,
    pub page_id: Option<Uuid>,
    pub feedback_given: String,
    pub selected_text: Option<String>,
    pub marked_as_read: bool,
    pub created_at: DateTime<Utc>,
    pub blocks: Vec<FeedbackBlock>,
    pub page_title: String,
    pub page_url_path: String,
}

pub async fn get_feedback_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    read: bool,
    pagination: Pagination,
) -> ModelResult<Vec<Feedback>> {
    let res = sqlx::query!(
        r#"
SELECT fb.*,
  pages.title as "page_title",
  pages.url_path as "page_url_path"
FROM (
    SELECT feedback.id as "id!",
      feedback.user_id,
      feedback.course_id as "course_id!",
      feedback.page_id,
      feedback.feedback_given as "feedback_given!",
      feedback.selected_text,
      feedback.marked_as_read as "marked_as_read!",
      feedback.created_at as "created_at!",
      array_agg(block_feedback.block_id) filter (
        where block_feedback.block_id IS NOT NULL
      ) AS "block_ids: Vec<Uuid>",
      array_agg(block_feedback.block_text) filter (
        where block_feedback.block_id IS NOT NULL
      ) AS "block_texts: Vec<Option<String>>",
      array_agg(block_feedback.order_number) filter (
        where block_feedback.block_id IS NOT NULL
      ) AS "block_order_numbers: Vec<Option<i32>>"
    FROM feedback
      LEFT JOIN block_feedback ON block_feedback.feedback_id = feedback.id
    WHERE course_id = $1
      AND feedback.marked_as_read = $2
      AND feedback.deleted_at IS NULL
      AND block_feedback.deleted_at IS NULL
    GROUP BY feedback.id,
      feedback.user_id,
      feedback.course_id,
      feedback.feedback_given,
      feedback.marked_as_read,
      feedback.created_at
    ORDER BY feedback.created_at DESC,
      feedback.id
    LIMIT $3 OFFSET $4
  ) fb
  JOIN pages on pages.id = fb.page_id
"#,
        course_id,
        read,
        pagination.limit(),
        pagination.offset(),
    )
    .map(|r| Feedback {
        id: r.id,
        user_id: r.user_id,
        course_id: r.course_id,
        page_id: r.page_id,
        feedback_given: r.feedback_given,
        selected_text: r.selected_text,
        marked_as_read: r.marked_as_read,
        created_at: r.created_at,
        blocks: r
            .block_ids
            .unwrap_or_default()
            .into_iter()
            .zip(r.block_texts.unwrap_or_default())
            .zip(r.block_order_numbers.unwrap_or_default())
            .map(|((id, text), order_number)| FeedbackBlock {
                id,
                text,
                order_number,
            })
            .collect(),
        page_title: r.page_title,
        page_url_path: r.page_url_path,
    })
    .fetch_all(conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct FeedbackCount {
    pub read: u32,
    pub unread: u32,
}

pub async fn get_feedback_count_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<FeedbackCount> {
    let res = sqlx::query!(
        "
SELECT COUNT(*) filter (
    where marked_as_read
  ) AS read,
  COUNT(*) filter (
    where not(marked_as_read)
  ) AS unread
FROM feedback
WHERE course_id = $1
  AND feedback.deleted_at IS NULL
",
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(FeedbackCount {
        read: res.read.unwrap_or_default().try_into()?,
        unread: res.unread.unwrap_or_default().try_into()?,
    })
}
