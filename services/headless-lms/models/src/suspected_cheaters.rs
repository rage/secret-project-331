use crate::prelude::*;
use crate::{cheating_confirmation_grade_snapshots, course_module_completions, course_modules};
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

/// Whether a module of the given size is exempt from the minimum cheater threshold. Small modules
/// can legitimately be completed fast, so for them any duration >= 0 is allowed (0 disables the
/// duration check). This is the single source of truth for the exemption rule -- both the save-time
/// validation and the configuration UI derive their behaviour from it (the latter via
/// [`get_threshold_info_for_course`]).
pub fn module_exempt_from_minimum(chapters: i64, exercises: i64) -> bool {
    exercises <= SMALL_MODULE_MAX_EXERCISES || chapters <= SMALL_MODULE_MAX_CHAPTERS
}

/// The smallest threshold (in seconds) a teacher may configure for a module of the given size:
/// `0` for small (exempt) modules, otherwise [`MINIMUM_CHEATER_THRESHOLD_SECONDS`].
pub fn minimum_threshold_seconds(chapters: i64, exercises: i64) -> i32 {
    if module_exempt_from_minimum(chapters, exercises) {
        0
    } else {
        MINIMUM_CHEATER_THRESHOLD_SECONDS
    }
}

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

/// A user's suspected-cheater record in one course, paired with that course's duration threshold.
/// Read-only, for the cross-course "Completion review" list on the user-details page.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct UserSuspectedCheaterInfo {
    pub course_id: Uuid,
    pub status: SuspectedCheaterStatus,
    pub total_duration_seconds: Option<i32>,
    pub total_points: i32,
    /// When first flagged in this course (record `created_at`, unchanged on re-flag).
    pub first_flagged_at: DateTime<Utc>,
    /// Duration threshold (seconds) for this course; student was flagged for completing faster.
    pub threshold_seconds: i32,
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

/// Per-module threshold configuration plus the policy-derived limits the configuration UI needs to
/// render and validate the threshold form. Computed server-side so the exemption rule and the
/// minimum/default values live in one place instead of being duplicated in the frontend.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseModuleThresholdInfo {
    pub course_module_id: Uuid,
    /// The explicitly configured threshold in seconds, or `None` when the module has no threshold
    /// row and [`Self::default_duration_seconds`] applies.
    pub configured_duration_seconds: Option<i32>,
    /// The smallest threshold a teacher may save for this module: `0` for small (exempt) modules,
    /// otherwise [`MINIMUM_CHEATER_THRESHOLD_SECONDS`].
    pub minimum_duration_seconds: i32,
    /// The threshold applied when none is configured.
    pub default_duration_seconds: i32,
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
    validate_threshold_duration(duration_seconds)?;
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

/// Dismisses the suspicion against a student (marks it a false alarm), clears the
/// "needs to be reviewed" flag on their completions, and restores any grade that a prior cheating
/// confirmation had failed (a no-op if the student was never confirmed). Atomic.
pub async fn dismiss_by_user_id_and_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<SuspectedCheaters> {
    let mut tx = conn.begin().await?;
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
    .fetch_one(&mut *tx)
    .await?;
    course_module_completions::update_needs_to_be_reviewed_by_course_and_user_ids(
        &mut tx, course_id, user_id, false,
    )
    .await?;
    cheating_confirmation_grade_snapshots::restore_and_clear_for_user_course(
        &mut tx, course_id, user_id,
    )
    .await?;
    tx.commit().await?;
    Ok(cheater)
}

/// Confirms that a student cheated and applies the consequence: their completions in the course are
/// failed (passed = false, grade = 0), with the previous values snapshotted so the confirmation can
/// be undone by [`dismiss_by_user_id_and_course_id`]. Atomic.
pub async fn confirm_cheater_by_user_id_and_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<SuspectedCheaters> {
    let mut tx = conn.begin().await?;
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
    .fetch_one(&mut *tx)
    .await?;
    cheating_confirmation_grade_snapshots::snapshot_and_fail_completions(
        &mut tx, course_id, user_id,
    )
    .await?;
    tx.commit().await?;
    Ok(cheater)
}

/// All non-deleted suspected-cheater records for a user across courses. A user can be flagged in
/// more than one course, hence a list.
pub async fn get_all_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<SuspectedCheaters>> {
    let cheaters = sqlx::query_as!(
        SuspectedCheaters,
        r#"
SELECT *
FROM suspected_cheaters
WHERE user_id = $1
  AND deleted_at IS NULL
        "#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(cheaters)
}

/// Duration threshold (seconds) shown for a course in the review UI: the DEFAULT module's configured
/// threshold, or [`DEFAULT_CHEATER_THRESHOLD_SECONDS`] if unset.
///
/// Known limitation: flagging (`library/progressing.rs`) uses the *completed* module's threshold, so
/// for a non-default module with its own threshold this can differ from the value that triggered the
/// flag. The `suspected_cheaters` row doesn't record which module triggered it, so this is a
/// best-effort display figure.
pub async fn get_applicable_threshold_seconds(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<i32> {
    let default_module = course_modules::get_default_by_course_id(conn, course_id).await?;
    let threshold = get_thresholds_by_module_id(conn, default_module.id)
        .await?
        .map(|t| t.duration_seconds)
        .unwrap_or(DEFAULT_CHEATER_THRESHOLD_SECONDS);
    Ok(threshold)
}

/// Each course where the user has a non-deleted suspected-cheater record, paired with its duration threshold.
pub async fn get_suspected_cheater_info_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<UserSuspectedCheaterInfo>> {
    let rows = get_all_by_user_id(conn, user_id).await?;
    let mut info = Vec::with_capacity(rows.len());
    for row in rows {
        let threshold_seconds = get_applicable_threshold_seconds(conn, row.course_id).await?;
        info.push(UserSuspectedCheaterInfo {
            course_id: row.course_id,
            status: row.status,
            total_duration_seconds: row.total_duration_seconds,
            total_points: row.total_points,
            first_flagged_at: row.created_at,
            threshold_seconds,
        });
    }
    Ok(info)
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

/// Guards the invariant that a stored threshold is never negative. `progressing.rs` treats a
/// stored value of `<= 0` as "duration check disabled", so a stray negative write would silently
/// turn off cheater detection; rejecting it here protects every writer, not just the HTTP handler.
fn validate_threshold_duration(duration_seconds: i32) -> ModelResult<()> {
    if duration_seconds < 0 {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Cheater threshold duration cannot be negative.".to_string(),
            None,
        ));
    }
    Ok(())
}

pub async fn insert_thresholds_by_module_id(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    duration_seconds: i32,
) -> ModelResult<Threshold> {
    validate_threshold_duration(duration_seconds)?;
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

/// Returns the configured threshold (if any) and the policy-derived minimum/default for every
/// non-deleted module in the course. The exemption rule is applied here so the configuration UI
/// does not have to recompute module sizes or duplicate the threshold constants.
pub async fn get_threshold_info_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseModuleThresholdInfo>> {
    let rows = sqlx::query!(
        r#"
SELECT cm.id AS "course_module_id!",
  ct.duration_seconds AS "configured_duration_seconds?",
  COUNT(DISTINCT c.id) AS "chapters!",
  COUNT(e.id) AS "exercises!"
FROM course_modules cm
  LEFT JOIN cheater_thresholds ct ON ct.course_module_id = cm.id
  AND ct.deleted_at IS NULL
  LEFT JOIN chapters c ON c.course_module_id = cm.id
  AND c.deleted_at IS NULL
  LEFT JOIN exercises e ON e.chapter_id = c.id
  AND e.deleted_at IS NULL
WHERE cm.course_id = $1
  AND cm.deleted_at IS NULL
GROUP BY cm.id, ct.duration_seconds
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    let info = rows
        .into_iter()
        .map(|row| CourseModuleThresholdInfo {
            course_module_id: row.course_module_id,
            configured_duration_seconds: row.configured_duration_seconds,
            minimum_duration_seconds: minimum_threshold_seconds(row.chapters, row.exercises),
            default_duration_seconds: DEFAULT_CHEATER_THRESHOLD_SECONDS,
        })
        .collect();
    Ok(info)
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
