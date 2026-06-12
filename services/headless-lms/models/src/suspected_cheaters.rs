use crate::prelude::*;
use crate::{course_module_completions, course_modules};
use utoipa::ToSchema;

/// 3 hours, in seconds. Default threshold used when a course has no explicit threshold
/// configured but cheater detection is enabled.
pub const DEFAULT_CHEATER_THRESHOLD_SECONDS: i32 = 3 * 60 * 60;
/// Teachers cannot configure a threshold below this (3 hours).
pub const MINIMUM_CHEATER_THRESHOLD_SECONDS: i32 = 3 * 60 * 60;
/// Modules with at most this many exercises are exempt from the minimum threshold; for them any
/// duration >= 0 is allowed, where 0 turns the duration check off.
pub const SMALL_MODULE_MAX_EXERCISES: i64 = 5;
/// Modules with at most this many chapters are exempt from the minimum threshold; for them any
/// duration >= 0 is allowed, where 0 turns the duration check off.
pub const SMALL_MODULE_MAX_CHAPTERS: i64 = 1;

/// Review state of a suspected cheater.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type, ToSchema)]
#[sqlx(type_name = "suspected_cheater_status", rename_all = "kebab-case")]
pub enum SuspectedCheaterStatus {
    /// Auto-flagged by the system (completed faster than the threshold), awaiting teacher review.
    Flagged,
    /// A teacher confirmed the student cheated. The student is failed as a consequence.
    ConfirmedCheating,
    /// A teacher decided the suspicion was a false alarm.
    Dismissed,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct SuspectedCheaters {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub total_duration_seconds: Option<i32>,
    pub total_points: i32,
    pub status: SuspectedCheaterStatus,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]

pub struct ThresholdData {
    pub duration_seconds: i32,
}

#[derive(Debug, Serialize, Deserialize)]

pub struct DeletedSuspectedCheater {
    pub id: i32,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]

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
) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
    INSERT INTO suspected_cheaters (
      user_id,
      total_duration_seconds,
      total_points,
      course_id
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, course_id) WHERE deleted_at IS NULL
    DO UPDATE SET
      total_duration_seconds = EXCLUDED.total_duration_seconds,
      total_points = EXCLUDED.total_points
    RETURNING *
      ",
        user_id,
        total_duration_seconds,
        total_points,
        course_id
    )
    .fetch_one(&mut *conn)
    .await?;
    // A suspicion is "active" (still needs review) unless it has been dismissed as a false
    // alarm. A new row defaults to Flagged; an existing row keeps its status on conflict.
    Ok(res.status != SuspectedCheaterStatus::Dismissed)
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
            duration_seconds = EXCLUDED.duration_seconds,
            deleted_at = NULL
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
      SELECT *
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

pub async fn get_by_user_id_and_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<SuspectedCheaters> {
    let cheater = sqlx::query_as!(
        SuspectedCheaters,
        "
SELECT *
FROM suspected_cheaters
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL;
    ",
        user_id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(cheater)
}

/// Dismisses the suspicion against a student (marks it a false alarm) and clears the
/// "needs to be reviewed" flag on their completions.
pub async fn dismiss_by_user_id_and_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<SuspectedCheaters> {
    let cheater = sqlx::query_as!(
        SuspectedCheaters,
        r#"
UPDATE suspected_cheaters
SET status = 'dismissed'
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
RETURNING *
        "#,
        user_id,
        course_id
    )
    .fetch_one(&mut *conn)
    .await?;
    course_module_completions::update_needs_to_be_reviewed_by_course_and_user_ids(
        conn, course_id, user_id, false,
    )
    .await?;
    Ok(cheater)
}

/// Confirms that a student cheated. The caller is responsible for the consequence of
/// failing the student's completion.
pub async fn confirm_cheater_by_user_id_and_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<SuspectedCheaters> {
    let cheater = sqlx::query_as!(
        SuspectedCheaters,
        r#"
UPDATE suspected_cheaters
SET status = 'confirmed-cheating'
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
RETURNING *
        "#,
        user_id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(cheater)
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
    status: SuspectedCheaterStatus,
) -> ModelResult<Vec<SuspectedCheaters>> {
    let cheaters = sqlx::query_as!(
        SuspectedCheaters,
        r#"
SELECT *
FROM suspected_cheaters
WHERE course_id = $1
    AND status = $2
    AND deleted_at IS NULL;
    "#,
        course_id,
        status as SuspectedCheaterStatus
    )
    .fetch_all(conn)
    .await?;
    Ok(cheaters)
}

/// Counts the suspected cheaters in a given review state for a course.
pub async fn get_count_in_course_by_status(
    conn: &mut PgConnection,
    course_id: Uuid,
    status: SuspectedCheaterStatus,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM suspected_cheaters
WHERE course_id = $1
  AND status = $2
  AND deleted_at IS NULL
        "#,
        course_id,
        status as SuspectedCheaterStatus
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
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
      SELECT *
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
