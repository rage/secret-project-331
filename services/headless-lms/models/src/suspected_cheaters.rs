use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SuspectedCheaters {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub total_duration_seconds: Option<i32>,
    pub total_points: i32,
    pub is_archived: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ThresholdData {
    pub points: i32,
    pub duration_seconds: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct DeletedSuspectedCheater {
    pub id: i32,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Threshold {
    pub id: Uuid,
    pub course_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub points: i32,
    pub duration_seconds: Option<i32>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    total_duration_seconds: Option<i32>,
    total_points: i32,
) -> ModelResult<()> {
    sqlx::query!(
        "
    INSERT INTO suspected_cheaters (
      user_id,
      total_duration_seconds,
      total_points,
      course_id
    )
    VALUES ($1, $2, $3, $4)
      ",
        user_id,
        total_duration_seconds,
        total_points,
        course_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn insert_thresholds(
    conn: &mut PgConnection,
    course_id: Uuid,
    duration_seconds: Option<i32>,
    points: i32,
) -> ModelResult<Threshold> {
    let threshold = sqlx::query_as!(
        Threshold,
        "
        INSERT INTO cheater_thresholds (
            course_id,
            duration_seconds,
            points
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (course_id)
        DO UPDATE SET
            duration_seconds = EXCLUDED.duration_seconds,
            points = EXCLUDED.points
        RETURNING *
        ",
        course_id,
        duration_seconds,
        points,
    )
    .fetch_one(conn)
    .await?;

    Ok(threshold)
}

pub async fn update_thresholds_by_point(
    conn: &mut PgConnection,
    course_id: Uuid,
    points: i32,
) -> ModelResult<()> {
    sqlx::query!(
        "
      UPDATE cheater_thresholds
      SET points = $2
      WHERE course_id = $1
    ",
        course_id,
        points
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_thresholds_by_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Threshold> {
    let thresholds = sqlx::query_as!(
        Threshold,
        "
      SELECT id,
      course_id,
      duration_seconds,
      points,
      created_at,
      updated_at,
      deleted_at
      FROM cheater_thresholds
      WHERE course_id = $1
      AND deleted_at IS NULL;
    ",
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(thresholds)
}

pub async fn archive_suspected_cheater(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
      UPDATE suspected_cheaters
      SET is_archived = TRUE
      WHERE id = $1
    ",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn approve_suspected_cheater(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
      UPDATE suspected_cheaters
      SET is_archived = FALSE
      WHERE id = $1
    ",
        id
    )
    .execute(conn)
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
      WHERE user_id = $1
      AND deleted_at IS NULL;
    ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(cheaters)
}

pub async fn get_all_suspected_cheaters_in_course_instance(
    conn: &mut PgConnection,
    course_id: Uuid,
    archive: bool,
) -> ModelResult<Vec<SuspectedCheaters>> {
    let cheaters = sqlx::query_as!(
        SuspectedCheaters,
        "
SELECT *
FROM suspected_cheaters
WHERE course_id = $1
    AND is_archived = $2
    AND deleted_at IS NULL;
    ",
        course_id,
        archive
    )
    .fetch_all(conn)
    .await?;
    Ok(cheaters)
}
