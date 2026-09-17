use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct FeedbackCategory {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct NewFeedbackCategory {
    pub name: String,
}

pub async fn insert(conn: &mut PgConnection, category: NewFeedbackCategory) -> ModelResult<Uuid> {
    if let Some(c) = get_by_name(conn, &category.name).await? {
        return Ok(c.id);
    };

    let res = sqlx::query_as!(
        FeedbackCategory,
        "
INSERT INTO feedback_categories (name)
VALUES ($1)
RETURNING *
        ",
        category.name,
    )
    .fetch_one(conn)
    .await?;

    Ok(res.id)
}

pub async fn get_by_name(
    conn: &mut PgConnection,
    name: &String,
) -> ModelResult<Option<FeedbackCategory>> {
    let res = sqlx::query_as!(
        FeedbackCategory,
        "
SELECT *
FROM feedback_categories
WHERE name = $1
  AND deleted_at IS NULL
        ",
        name
    )
    .fetch_optional(conn)
    .await?;

    Ok(res)
}

pub async fn get_all(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<FeedbackCategory>> {
    let res = sqlx::query_as!(
        FeedbackCategory,
        "
SELECT fc.*
FROM feedback_categories AS fc
WHERE EXISTS (
    SELECT id
    FROM feedback AS f
    WHERE fc.id = f.category_id
      AND f.deleted_at IS NULL
      AND f.course_id = $1
  )
  AND fc.deleted_at IS NULL
        ",
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}
