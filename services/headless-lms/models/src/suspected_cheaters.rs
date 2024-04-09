use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SuspectedCheaters {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub total_duration: u64, // Represented in milliseconds
    pub total_points: f32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Threshold {
    pub id: Uuid,
    pub course_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_threshold: f32,
    pub duration_threshold: Option<u64>,
}

pub async fn insert(
  conn: &mut PgConnection,
  user_id: Uuid,
  total_duration: u64,
  score_threshold: f32,
) -> SuspectedCheaters<()> {
  sqlx::query!(
      "
    INSERT INTO suspected_cheaters (
      user_id,
      total_duration,
      total_points
    )
    VALUES ($1, $2, $3)
      ",
      user_id,
      total_duration,
      total_points
  )
  .execute(conn)
  .await?;
  Ok(())
}

pub async fn insert_threshold(
  conn: &mut PgConnection,
  user_id: Uuid,
  duration: Option<u64>,
  points: f32,
) -> SuspectedCheaters<()> {
  sqlx::query!(
      "
    INSERT INTO suspected_cheaters (
      user_id,
      duration,
      points
    )
    VALUES ($1, $2, $3)
      ",
      user_id,
      duration,
      points
  )
  .execute(conn)
  .await?;
  Ok(())
}

pub async fn delete_suspected_cheaters(
  conn: &mut PgConnection,
  id: Uuid
) -> ModelResult<String> {
  let repsonse = sqlx::query!(
    r#"
      UPDATE suspected_cheaters
      SET deleted_at = now()
      WHERE id = $1
      RETURNING id
    "#,
    id
  )
  .fetch_one(conn)
  .await?;
  Ok(response.id)
}

pub async fn get_suspected_cheaters_by_id(
  conn: &mut PgConnection,
  id: Uuid,
) -> ModelResult<SuspectedCheaters> {
  let cheaters = sqlx::query_as!(
    SuspectedCheaters,
    "
      SELECT *
      FROM suspected_cheaters
      WHERE id = $1
      AND deleted_at IS NULL;
    ",
      id
  )
  .fetch_one(conn)
  .await?;
  Ok(cheaters)
}
