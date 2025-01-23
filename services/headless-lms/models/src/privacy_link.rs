use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PrivacyLink {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub title: String,
    pub url: String,
    pub course_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PrivacyLinkNew {
    pub course_id: Uuid,
    pub title: String,
    pub url: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    title: String,
    url: String,
) -> ModelResult<PrivacyLink> {
    let res = sqlx::query_as!(
        PrivacyLink,
        r#"
INSERT INTO privacy_links (course_id, title, url)
VALUES ($1, $2, $3)
RETURNING *
"#,
        course_id,
        title,
        url,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_privacy_link(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<PrivacyLink>> {
    let res = sqlx::query_as!(
        PrivacyLink,
        "SELECT *
FROM privacy_links
WHERE course_id = $1
  AND deleted_at IS NULL",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn delete_privacy_link(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<PrivacyLink> {
    let deleted = sqlx::query_as!(
        PrivacyLink,
        r#"
UPDATE privacy_links
SET deleted_at = now()
WHERE course_id = $1
RETURNING *
  "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
