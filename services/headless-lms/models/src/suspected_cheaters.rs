use crate::course_modules;
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
    pub duration_seconds: i32,
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
    pub course_module_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub duration_seconds: i32,
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
    duration_seconds: i32,
) -> ModelResult<Threshold> {
    let default_module = course_modules::get_default_by_course_id(conn, course_id).await?;

    let threshold = sqlx::query_as!(
        Threshold,
        "
        INSERT INTO cheater_thresholds (
            course_module_id,
            duration_seconds
        )
        VALUES ($1, $2)
        ON CONFLICT (course_module_id)
        DO UPDATE SET
            duration_seconds = EXCLUDED.duration_seconds
        RETURNING *
        ",
        default_module.id,
        duration_seconds,
    )
    .fetch_one(conn)
    .await?;

    Ok(threshold)
}

pub async fn get_thresholds_by_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Threshold> {
    let default_module = course_modules::get_default_by_course_id(conn, course_id).await?;

    let thresholds = sqlx::query_as!(
        Threshold,
        "
      SELECT id,
      course_module_id,
      duration_seconds,
      created_at,
      updated_at,
      deleted_at
      FROM cheater_thresholds
      WHERE course_module_id = $1
      AND deleted_at IS NULL;
    ",
        default_module.id
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
      WHERE user_id = $1
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
      WHERE user_id = $1
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

pub async fn get_all_suspected_cheaters_in_course(
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

pub async fn insert_thresholds_by_module_id(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    duration_seconds: i32,
) -> ModelResult<Threshold> {
    let threshold = sqlx::query_as!(
        Threshold,
        "
        INSERT INTO cheater_thresholds (
            course_module_id,
            duration_seconds
        )
        VALUES ($1, $2)
        ON CONFLICT (course_module_id)
        DO UPDATE SET
            duration_seconds = EXCLUDED.duration_seconds,
            deleted_at = NULL
        RETURNING *
        ",
        course_module_id,
        duration_seconds,
    )
    .fetch_one(conn)
    .await?;

    Ok(threshold)
}

pub async fn get_thresholds_by_module_id(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> ModelResult<Option<Threshold>> {
    let threshold = sqlx::query_as!(
        Threshold,
        "
      SELECT id,
      course_module_id,
      duration_seconds,
      created_at,
      updated_at,
      deleted_at
      FROM cheater_thresholds
      WHERE course_module_id = $1
      AND deleted_at IS NULL;
    ",
        course_module_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(threshold)
}

pub async fn get_all_thresholds_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Threshold>> {
    let thresholds = sqlx::query_as!(
        Threshold,
        "
      SELECT ct.id,
      ct.course_module_id,
      ct.duration_seconds,
      ct.created_at,
      ct.updated_at,
      ct.deleted_at
      FROM cheater_thresholds ct
      JOIN course_modules cm ON ct.course_module_id = cm.id
      WHERE cm.course_id = $1
      AND ct.deleted_at IS NULL
      AND cm.deleted_at IS NULL;
    ",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(thresholds)
}

pub async fn delete_threshold_for_module(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
        UPDATE cheater_thresholds
        SET deleted_at = NOW()
        WHERE course_module_id = $1
        AND deleted_at IS NULL
        ",
        course_module_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
