use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct JoinCodeUses {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO join_code_uses (id, user_id, course_id)
VALUES ($1, $2, $3)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        user_id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn check_if_user_has_access_to_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
SELECT id
FROM join_code_uses
WHERE user_id = $1
AND course_id = $2
        ",
        user_id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
