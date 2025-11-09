use crate::prelude::*;

#[derive(sqlx::FromRow, Debug, Clone)]
pub struct UserEmailCode {
    pub id: Uuid,
    pub user_id: Uuid,
    pub code: String,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert_user_email_code(
    conn: &mut PgConnection,
    user_id: Uuid,
    code: String,
) -> ModelResult<String> {
    let mut tx = conn.begin().await?;

    // Soft delete possible previous codes so that only one code is at use at a time
    let _ = sqlx::query!(
        r#"
   UPDATE user_email_codes
SET deleted_at = NOW()
WHERE user_id = $1
  AND deleted_at IS NULL
    "#,
        user_id
    )
    .execute(&mut *tx)
    .await?;

    // Attempt to insert new code; the unique index ensures no more than one active code per user
    let record = sqlx::query!(
        r#"
      INSERT INTO user_email_codes (code, user_id)
VALUES ($1, $2)
RETURNING code
        "#,
        code,
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(record.code)
}

pub async fn get_unused_user_email_code_with_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Option<UserEmailCode>> {
    let now = Utc::now();
    let record = sqlx::query_as!(
        UserEmailCode,
        r#"
SELECT id,
  code,
  user_id,
  created_at,
  updated_at,
  used_at,
  deleted_at,
  expires_at
FROM user_email_codes
WHERE user_id = $1
  AND deleted_at IS NULL
  AND used_at IS NULL
  AND expires_at > $2
        "#,
        user_id,
        now
    )
    .fetch_optional(conn)
    .await?;

    Ok(record)
}

pub async fn is_reset_user_email_code_valid(
    conn: &mut PgConnection,
    user_id: Uuid,
    code: &String,
) -> ModelResult<bool> {
    let now = Utc::now();
    let record = sqlx::query!(
        r#"
SELECT *
FROM user_email_codes
WHERE user_id = $1
  AND code = $2
  AND deleted_at IS NULL
  AND used_at IS NULL
  AND expires_at > $3
       "#,
        user_id,
        code,
        now
    )
    .fetch_optional(conn)
    .await?;

    Ok(record.is_some())
}

pub async fn mark_user_email_code_used(
    conn: &mut PgConnection,
    user_id: Uuid,
    code: &String,
) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
UPDATE user_email_codes
SET used_at = NOW(),
  deleted_at = NOW()
WHERE user_id = $1
  AND code = $2
  AND deleted_at IS NULL
        "#,
        user_id,
        code
    )
    .execute(conn)
    .await?;

    Ok(result.rows_affected() > 0)
}
