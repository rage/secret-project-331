use headless_lms_utils::page_visit_hasher::hash_anonymous_identifier;

use crate::prelude::*;

pub struct GenerateAnonymousIdentifierInput {
    pub course_id: Uuid,
    pub user_agent: String,
    pub ip_address: String,
}
pub async fn generate_anonymous_identifier(
    conn: &mut PgConnection,
    input: GenerateAnonymousIdentifierInput,
) -> ModelResult<String> {
    let key_for_the_day = get_key_for_the_day(conn).await?;
    let hash = hash_anonymous_identifier(
        input.course_id,
        key_for_the_day,
        input.user_agent,
        input.ip_address,
    )
    .map_err(|e| ModelError::Generic(e.to_string()))?;
    Ok(hash)
}

pub async fn get_key_for_the_day(conn: &mut PgConnection) -> ModelResult<Vec<u8>> {
    let now = Utc::now();
    let valid_for_date = now.date().naive_utc();
    let res = sqlx::query!(
        "
INSERT INTO page_visit_datum_daily_visit_hashing_keys(valid_for_date)
VALUES ($1)
ON CONFLICT (valid_for_date) DO NOTHING
RETURNING hashing_key
    ",
        valid_for_date
    )
    .fetch_one(conn)
    .await?;
    Ok(res.hashing_key)
}
