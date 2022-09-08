use chrono::NaiveDate;
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
    .map_err(|e| ModelError::new(ModelErrorType::Generic, e.to_string(), Some(Box::from(e))))?;
    Ok(hash)
}

pub async fn get_key_for_the_day(conn: &mut PgConnection) -> ModelResult<Vec<u8>> {
    let now = Utc::now();
    let valid_for_date = now.date().naive_utc();
    let res = try_get_key_for_the_day_internal(conn, valid_for_date).await?;
    match res {
        Some(hashing_key) => Ok(hashing_key),
        None => {
            try_insert_key_for_the_day_internal(conn, valid_for_date).await?;
            let second_try = try_get_key_for_the_day_internal(conn, valid_for_date).await?;
            match second_try {
                Some(hashing_key) => Ok(hashing_key),
                None => Err(ModelError::new(
                    ModelErrorType::Generic,
                    "Failed to get hashing key for the day".to_string(),
                    None,
                )),
            }
        }
    }
}

async fn try_get_key_for_the_day_internal(
    conn: &mut PgConnection,
    valid_for_date: NaiveDate,
) -> ModelResult<Option<Vec<u8>>> {
    let res = sqlx::query!(
        "
SELECT hashing_key FROM page_visit_datum_daily_visit_hashing_keys
WHERE valid_for_date = $1
    ",
        valid_for_date
    )
    .fetch_optional(conn)
    .await?;
    Ok(res.map(|r| r.hashing_key))
}

async fn try_insert_key_for_the_day_internal(
    conn: &mut PgConnection,
    valid_for_date: NaiveDate,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO page_visit_datum_daily_visit_hashing_keys(valid_for_date)
VALUES ($1)
ON CONFLICT (valid_for_date) DO NOTHING
    ",
        valid_for_date
    )
    .execute(&mut *conn)
    .await?;

    // We no longer need the keys from the previous days, so lets delete them.
    sqlx::query!(
        "
DELETE FROM page_visit_datum_daily_visit_hashing_keys WHERE valid_for_date < $1
    ",
        valid_for_date
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}
