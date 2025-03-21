use crate::library::TimeGranularity;
use crate::{prelude::*, roles::UserRole};

/// A generic result representing a count metric over a time period.
/// When the time period is not applicable (for overall totals), `period` will be `None`.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CountResult {
    /// The start of the time period (e.g., day, week, month) associated with this count.
    /// For overall totals, this will be `None`.
    pub period: Option<DateTime<Utc>>,
    /// The count (for example, the number of users).
    pub count: i64,
}

/// A generic result representing an average metric over a time period.
/// The average value (e.g. average time in seconds) may be absent if no data is available.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AverageMetric {
    /// The start of the time period (e.g., day, week, month) associated with this metric.
    pub period: Option<DateTime<Utc>>,
    /// The average value. For example, the average time (in seconds) from course start to first submission.
    pub average: Option<f64>,
}

/// Represents cohort activity metrics for both weekly and daily cohorts.
/// For daily cohorts, `offset` will be populated (and `activity_period` may be computed from it);
/// for weekly cohorts, `offset` will be `None` and `activity_period` indicates the week start.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CohortActivity {
    /// The start date of the cohort (either day or week).
    pub cohort_start: Option<DateTime<Utc>>,
    /// The activity period (for example, the start of the week or the computed activity day).
    pub activity_period: Option<DateTime<Utc>>,
    /// The day offset from the cohort start (only applicable for daily cohorts).
    pub offset: Option<i32>,
    /// The number of active users in this cohort for the given period.
    pub active_users: i64,
}

/// Gets user IDs to exclude from course statistics for a single course.
/// Excludes users with any role other than MaterialViewer in the course, its organization, or globally.
async fn get_user_ids_to_exclude_from_course_stats(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let roles = crate::roles::get_course_related_roles(conn, course_id).await?;
    let user_ids: Vec<_> = roles
        .iter()
        .filter(|role| role.role != UserRole::MaterialViewer)
        .map(|role| role.user_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    Ok(user_ids)
}

/// Gets user IDs to exclude from course language group statistics.
/// Uses a single query to get all roles and filters out MaterialViewer roles.
async fn get_user_ids_to_exclude_from_course_language_group_stats(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let roles =
        crate::roles::get_course_language_group_related_roles(conn, course_language_group_id)
            .await?;
    let user_ids: Vec<_> = roles
        .iter()
        .filter(|role| role.role != UserRole::MaterialViewer)
        .map(|role| role.user_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    Ok(user_ids)
}

/// Total unique users in the course settings table.
pub async fn get_total_users_started_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CountResult> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT NULL::timestamptz AS "period",
       COUNT(DISTINCT user_id) AS "count!"
FROM user_course_settings
WHERE current_course_id = $1
  AND deleted_at IS NULL
  AND user_id != ALL($2);
        "#,
        course_id,
        &exclude_user_ids
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Total unique users who have completed the course.
pub async fn get_total_users_completed_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CountResult> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT NULL::timestamptz AS "period",
       COUNT(DISTINCT user_id) AS "count!"
FROM course_module_completions
WHERE course_id = $1
  AND deleted_at IS NULL
  AND user_id != ALL($2);
        "#,
        course_id,
        &exclude_user_ids
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Total unique users who have completed the course in all language versions
pub async fn get_total_users_completed_all_language_versions_of_a_course(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
) -> ModelResult<CountResult> {
    let exclude_user_ids =
        get_user_ids_to_exclude_from_course_language_group_stats(conn, course_language_group_id)
            .await?;

    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT NULL::timestamptz AS "period",
  COUNT(DISTINCT user_id) AS "count!"
FROM course_module_completions
WHERE course_id IN (
    SELECT id
    FROM courses
    WHERE course_language_group_id = $1
      AND deleted_at IS NULL
  )
  AND deleted_at IS NULL
  AND user_id != ALL($2);
    "#,
        course_language_group_id,
        &exclude_user_ids
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Total unique users who have started the course in all language versions
pub async fn get_total_users_started_all_language_versions_of_a_course(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
) -> ModelResult<CountResult> {
    let exclude_user_ids =
        get_user_ids_to_exclude_from_course_language_group_stats(conn, course_language_group_id)
            .await?;

    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT NULL::timestamptz AS "period",
  COUNT(DISTINCT user_id) AS "count!"
FROM user_course_settings
WHERE current_course_id IN (
    SELECT id
    FROM courses
    WHERE course_language_group_id = $1
      AND deleted_at IS NULL
  )
  AND deleted_at IS NULL
  AND user_id != ALL($2);
    "#,
        course_language_group_id,
        &exclude_user_ids
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Weekly count of unique users starting the course.
pub async fn get_weekly_unique_users_starting(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC('week', created_at) AS "period",
       COUNT(DISTINCT user_id) AS "count!"
FROM user_course_settings
WHERE current_course_id = $1
  AND deleted_at IS NULL
  AND user_id != ALL($2)
GROUP BY "period"
ORDER BY "period";
        "#,
        course_id,
        &exclude_user_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Monthly count of unique users who started the course.
pub async fn get_monthly_unique_users_starting(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC('month', created_at) AS "period",
       COUNT(DISTINCT user_id) AS "count!"
FROM user_course_settings
WHERE current_course_id = $1
  AND deleted_at IS NULL
  AND user_id != ALL($2)
GROUP BY "period"
ORDER BY "period"
        "#,
        course_id,
        &exclude_user_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Daily count of unique users who started the course within specified days.
pub async fn get_daily_unique_users_starting_last_n_days(
    conn: &mut PgConnection,
    course_id: Uuid,
    days_limit: i32,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC('day', created_at) AS "period",
  COUNT(DISTINCT user_id) AS "count!"
FROM user_course_settings
WHERE current_course_id = $1
  AND created_at >= NOW() - ($2 || ' days')::INTERVAL
  AND deleted_at IS NULL
  AND user_id != ALL($3)
GROUP BY "period"
ORDER BY "period"
        "#,
        course_id,
        &days_limit.to_string(),
        &exclude_user_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Monthly count of users who submitted their first exercise.
pub async fn get_monthly_first_exercise_submissions(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC('month', first_submission) AS "period",
COUNT(user_id) AS "count!"
FROM (
    SELECT user_id,
      MIN(created_at) AS first_submission
    FROM exercise_slide_submissions
    WHERE course_id = $1
      AND deleted_at IS NULL
      AND user_id != ALL($2)
    GROUP BY user_id
  ) AS first_submissions
GROUP BY "period"
ORDER BY "period"
        "#,
        course_id,
        &exclude_user_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Daily count of users who submitted their first exercise within specified days.
pub async fn get_daily_first_exercise_submissions_last_n_days(
    conn: &mut PgConnection,
    course_id: Uuid,
    days_limit: i32,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC('day', first_submission) AS "period",
  COUNT(user_id) AS "count!"
FROM (
    SELECT user_id,
      MIN(created_at) AS first_submission
    FROM exercise_slide_submissions
    WHERE course_id = $1
      AND created_at >= NOW() - ($2 || ' days')::INTERVAL
      AND deleted_at IS NULL
      AND user_id != ALL($3)
    GROUP BY user_id
  ) AS first_submissions
GROUP BY "period"
ORDER BY "period"
        "#,
        course_id,
        &days_limit.to_string(),
        &exclude_user_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Get users returning exercises counts with specified time granularity.
///
/// The time_window parameter controls how far back to look:
/// - For Year granularity: number of years
/// - For Month granularity: number of months
/// - For Day granularity: number of days
pub async fn users_returning_exercises_history(
    conn: &mut PgConnection,
    course_id: Uuid,
    granularity: TimeGranularity,
    time_window: i32,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let (interval_unit, time_unit) = granularity.get_sql_units();

    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC($5, created_at) AS "period",
  COUNT(DISTINCT user_id) AS "count!"
FROM exercise_slide_submissions
WHERE course_id = $1
  AND deleted_at IS NULL
  AND NOT user_id = ANY($2)
  AND created_at >= NOW() - ($3 || ' ' || $4)::INTERVAL
GROUP BY "period"
ORDER BY "period"
        "#,
        course_id,
        &exclude_user_ids,
        &time_window.to_string(),
        interval_unit,
        time_unit,
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

/// Total unique users who have returned at least one exercise.
pub async fn get_total_users_returned_at_least_one_exercise(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CountResult> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT NULL::timestamptz AS "period",
       COUNT(DISTINCT user_id) AS "count!"
FROM exercise_slide_submissions
WHERE course_id = $1
  AND deleted_at IS NULL
  AND user_id != ALL($2);
        "#,
        course_id,
        &exclude_user_ids
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Average time from course start to first exercise submission, grouped by month.
/// Returns the average time in seconds.
pub async fn get_avg_time_to_first_submission_by_month(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<AverageMetric>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let res = sqlx::query_as!(
        AverageMetric,
        r#"
SELECT DATE_TRUNC('month', user_start) AS "period",
AVG(
  EXTRACT(
    EPOCH
    FROM (first_submission - user_start)
  )
)::float8 AS "average"
FROM (
    SELECT u.user_id,
      MIN(u.created_at) AS user_start,
      MIN(e.created_at) AS first_submission
    FROM user_course_settings u
      JOIN exercise_slide_submissions e ON u.user_id = e.user_id
      AND e.course_id = $1
      AND e.deleted_at IS NULL
    WHERE u.current_course_id = $1
      AND u.deleted_at IS NULL
      AND u.user_id != ALL($2)
    GROUP BY u.user_id
  ) AS timings
GROUP BY "period"
ORDER BY "period"
        "#,
        course_id,
        &exclude_user_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Get cohort activity statistics with specified time granularity.
///
/// Parameters:
/// - history_window: How far back to look for cohorts
/// - tracking_window: How long to track activity after each cohort's start
///
/// For each granularity:
/// - Year: windows in years, tracking monthly activity
/// - Month: windows in months, tracking weekly activity
/// - Day: windows in days, tracking daily activity
///
/// Cohorts are defined by when users first submitted an exercise.
pub async fn get_cohort_activity_history(
    conn: &mut PgConnection,
    course_id: Uuid,
    granularity: TimeGranularity,
    history_window: i32,
    tracking_window: i32,
) -> ModelResult<Vec<CohortActivity>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let (interval_unit, time_unit) = granularity.get_sql_units();

    Ok(sqlx::query_as!(
        CohortActivity,
        r#"
WITH first_activity AS (
  SELECT user_id,
    MIN(DATE_TRUNC($6, created_at)) AS first_active_at
  FROM exercise_slide_submissions
  WHERE course_id = $1
    AND created_at >= NOW() - ($3 || ' ' || $4)::INTERVAL
    AND deleted_at IS NULL
    AND NOT user_id = ANY($2)
  GROUP BY user_id
),
cohort AS (
  SELECT user_id,
    first_active_at AS cohort_start
  FROM first_activity
)
SELECT c.cohort_start AS "cohort_start",
  DATE_TRUNC($6, s.created_at) AS "activity_period",
  CASE
    WHEN $6 = 'day' THEN EXTRACT(
      DAY
      FROM (DATE_TRUNC('day', s.created_at) - c.cohort_start)
    )::integer
    WHEN $6 = 'week' THEN EXTRACT(
      WEEK
      FROM (
          DATE_TRUNC('week', s.created_at) - c.cohort_start
        )
    )::integer
    WHEN $6 = 'month' THEN (
      EXTRACT(
        YEAR
        FROM s.created_at
      ) - EXTRACT(
        YEAR
        FROM c.cohort_start
      )
    )::integer * 12 + (
      EXTRACT(
        MONTH
        FROM s.created_at
      ) - EXTRACT(
        MONTH
        FROM c.cohort_start
      )
    )::integer
    ELSE NULL::integer
  END AS "offset",
  COUNT(DISTINCT s.user_id) AS "active_users!"
FROM cohort c
  JOIN exercise_slide_submissions s ON (
    c.user_id = s.user_id
    AND s.course_id = $1
  )
  AND s.created_at >= c.cohort_start
  AND s.created_at < c.cohort_start + ($5 || ' ' || $4)::INTERVAL
  AND s.deleted_at IS NULL
GROUP BY c.cohort_start,
  "activity_period",
  "offset"
ORDER BY c.cohort_start,
  "offset"
        "#,
        course_id,
        &exclude_user_ids,
        &history_window.to_string(),
        interval_unit,
        &tracking_window.to_string(),
        time_unit,
    )
    .fetch_all(conn)
    .await?)
}

/// Get course completion counts with specified time granularity.
///
/// The time_window parameter controls how far back to look:
/// - For Year granularity: number of years
/// - For Month granularity: number of months
/// - For Day granularity: number of days
pub async fn course_completions_history(
    conn: &mut PgConnection,
    course_id: Uuid,
    granularity: TimeGranularity,
    time_window: i32,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids = get_user_ids_to_exclude_from_course_stats(conn, course_id).await?;
    let (interval_unit, time_unit) = granularity.get_sql_units();

    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC($5, created_at) AS "period",
  COUNT(DISTINCT user_id) AS "count!"
FROM course_module_completions
WHERE course_id = $1
  AND prerequisite_modules_completed = TRUE
  AND needs_to_be_reviewed = FALSE
  AND passed = TRUE
  AND deleted_at IS NULL
  AND NOT user_id = ANY($2)
  AND created_at >= NOW() - ($3 || ' ' || $4)::INTERVAL
GROUP BY "period"
ORDER BY "period"
        "#,
        course_id,
        &exclude_user_ids,
        &time_window.to_string(),
        interval_unit,
        time_unit,
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

/// Get completion counts for all language versions of a course with specified time granularity.
///
/// The time_window parameter controls how far back to look:
/// - For Year granularity: number of years
/// - For Month granularity: number of months
/// - For Day granularity: number of days
pub async fn course_completions_history_all_language_versions(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    granularity: TimeGranularity,
    time_window: i32,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids =
        get_user_ids_to_exclude_from_course_language_group_stats(conn, course_language_group_id)
            .await?;
    let (interval_unit, time_unit) = granularity.get_sql_units();

    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC($5, created_at) AS "period",
COUNT(DISTINCT user_id) AS "count!"
FROM course_module_completions
WHERE course_id IN (
    SELECT id
    FROM courses
    WHERE course_language_group_id = $1
      AND deleted_at IS NULL
  )
  AND prerequisite_modules_completed = TRUE
  AND needs_to_be_reviewed = FALSE
  AND passed = TRUE
  AND deleted_at IS NULL
  AND NOT user_id = ANY($2)
  AND created_at >= NOW() - ($3 || ' ' || $4)::INTERVAL
GROUP BY "period"
ORDER BY "period"
        "#,
        course_language_group_id,
        &exclude_user_ids,
        &time_window.to_string(),
        interval_unit,
        time_unit,
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

/// Get unique users starting counts for all language versions with specified time granularity.
///
/// The time_window parameter controls how far back to look:
/// - For Year granularity: number of years
/// - For Month granularity: number of months
/// - For Day granularity: number of days
pub async fn unique_users_starting_history_all_language_versions(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    granularity: TimeGranularity,
    time_window: i32,
) -> ModelResult<Vec<CountResult>> {
    let exclude_user_ids =
        get_user_ids_to_exclude_from_course_language_group_stats(conn, course_language_group_id)
            .await?;
    let (interval_unit, time_unit) = granularity.get_sql_units();

    let res = sqlx::query_as!(
        CountResult,
        r#"
SELECT DATE_TRUNC($5, created_at) AS "period",
  COUNT(DISTINCT user_id) AS "count!"
FROM user_course_settings
WHERE current_course_id IN (
    SELECT id
    FROM courses
    WHERE course_language_group_id = $1
      AND deleted_at IS NULL
  )
  AND deleted_at IS NULL
  AND NOT user_id = ANY($2)
  AND created_at >= NOW() - ($3 || ' ' || $4)::INTERVAL
GROUP BY "period"
ORDER BY "period"
        "#,
        course_language_group_id,
        &exclude_user_ids,
        &time_window.to_string(),
        interval_unit,
        time_unit,
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}
