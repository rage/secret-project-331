use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CourseLanguageVersion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(conn: &mut PgConnection) -> ModelResult<Uuid> {
    let course_language_group_id = sqlx::query!(
        "
INSERT INTO course_language_groups DEFAULT
VALUES
RETURNING id;
        "
    )
    .fetch_one(conn)
    .await?
    .id;

    Ok(course_language_group_id)
}

pub async fn insert_with_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let course_language_group_id = sqlx::query!(
        "
INSERT INTO course_language_groups (id)
VALUES ($1)
RETURNING id;
        ",
        id
    )
    .fetch_one(conn)
    .await?
    .id;

    Ok(course_language_group_id)
}
