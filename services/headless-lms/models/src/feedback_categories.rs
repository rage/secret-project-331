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

/// Trim and normalize category names:
///     - lowercase
///     - remove trailing and preceding non-alphanumeric chars
///     - remove '*' and ';', these shouldn't be needed
fn normalize(input: &String) -> String {
    input
        .to_lowercase()
        .replace(";", "")
        .replace("*", "")
        .trim_end_matches(|x: char| !x.is_alphanumeric())
        .trim_start_matches(|x: char| !x.is_alphanumeric())
        .to_string()
}

pub async fn insert_or_get_by_name(
    conn: &mut PgConnection,
    category: NewFeedbackCategory,
) -> ModelResult<Uuid> {
    let normalized_name = normalize(&category.name);
    if normalized_name.is_empty() {
        return Err(model_err!(
            InvalidRequest,
            format!(
                "Cannot insert invalid or empty feedback_category name. Name: {} Name after normalization: {}",
                &category.name, normalized_name
            )
        ));
    }

    // use normalized name for getting
    if let Some(c) = get_by_name(conn, &normalized_name).await? {
        return Ok(c.id);
    };

    let res = sqlx::query!(
        r#"
WITH inserted AS (
  INSERT INTO feedback_categories (name)
  VALUES ($1)
  ON CONFLICT DO NOTHING
  RETURNING *
)
SELECT id AS "id!"
FROM inserted
WHERE id IS NOT NULL
UNION
SELECT id AS "id!"
FROM feedback_categories
WHERE name = $1
AND deleted_at IS NULL
        "#,
        normalized_name,
    )
    .fetch_one(conn)
    .await?;

    Ok(res.id)
}

pub async fn get_by_name(
    conn: &mut PgConnection,
    // Should be normalized before calling
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

pub async fn get_all_by_read_status(
    conn: &mut PgConnection,
    course_id: Uuid,
    read: bool,
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
      AND f.marked_as_read = $2
  )
  AND fc.deleted_at IS NULL
        ",
        course_id,
        read
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}
