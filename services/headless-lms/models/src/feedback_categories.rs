use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct FeedbackCategory {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub category_llm_id: i32,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct NewFeedbackCategory {
    pub category_llm_id: i32,
    pub name: String,
}

pub async fn insert(conn: &mut PgConnection, category: NewFeedbackCategory) -> ModelResult<Uuid> {
    let res = sqlx::query_as!(
        FeedbackCategory,
        "
INSERT INTO feedback_categories (
    name,
    category_llm_id
  )
VALUES ($1, $2)
RETURNING *
        ",
        category.name,
        category.category_llm_id
    )
    .fetch_one(conn)
    .await?;

    Ok(res.id)
}

pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<FeedbackCategory>> {
    let res = sqlx::query_as!(
        FeedbackCategory,
        "
SELECT * FROM feedback_categories
WHERE deleted_at IS NULL
        "
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}
