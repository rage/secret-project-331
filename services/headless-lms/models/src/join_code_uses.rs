use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct JoinCodeUses {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_instance_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO join_code_uses (id, user_id, course_instance_id)
VALUES ($1, $2, $3)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        user_id,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
