use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SuspectedCheaters {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub total_duration_seconds: Option<i32>,
    pub total_points: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ThresholdData {
    pub points: i32,
    pub duration_seconds: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Threshold {
    pub id: Uuid,
    pub course_instance_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub points: i32,
    pub duration_seconds: Option<i32>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    total_duration_seconds: Option<i32>,
    total_points: i32,
) -> ModelResult<()> {
    sqlx::query!(
        "
    INSERT INTO suspected_cheaters (
      user_id,
      total_duration_seconds,
      total_points
    )
    VALUES ($1, $2, $3)
      ",
        user_id,
        total_duration_seconds,
        total_points
    )
    .fetch_one(conn)
    .await?;
    Ok(())
}

pub async fn insert_thresholds(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    duration_seconds: Option<i32>,
    points: i32,
) -> ModelResult<()> {
    sqlx::query!(
        "
    INSERT INTO cheater_thresholds (
      course_instance_id,
      duration_seconds,
      points
    )
    VALUES ($1, $2, $3)
      ",
        course_instance_id,
        duration_seconds,
        points
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_thresholds_by_point(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    points: i32,
) -> ModelResult<()> {
    sqlx::query!(
        "
      UPDATE cheater_thresholds
      SET points = $2
      WHERE course_instance_id = $1
    ",
        course_instance_id,
        points
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_thresholds_by_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Threshold> {
    let thresholds = sqlx::query_as!(
        Threshold,
        "
      SELECT *
      FROM cheater_thresholds
      WHERE course_instance_id = $1
      AND deleted_at IS NULL;
    ",
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(thresholds)
}

pub async fn delete_suspected_cheaters(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
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
    Ok(())
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
