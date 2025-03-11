use crate::prelude::*;
use chrono::NaiveDateTime;
use uuid::Uuid;

// Shared struct for queries returning a single count
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct TotalCount {
    pub total_users: i64,
}

// Shared struct for queries returning a time period and a user count
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct TimeCount {
    pub period_start: NaiveDateTime,
    pub user_count: i64,
}

// Average time (in seconds) from course start to first exercise submission
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AvgTimeSubmission {
    pub period_start: NaiveDateTime,
    // average time in seconds; can be None if no data is available
    pub avg_time_to_first_submission: Option<f64>,
}

// Wekly cohort activity
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CohortWeeklyActivity {
    pub cohort_week: NaiveDateTime,
    pub period_start: NaiveDateTime,
    pub active_users: i64,
}

// Daily cohort activity (day offset from cohort start)
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CohortDailyActivity {
    pub cohort_day: NaiveDateTime,
    pub day_offset: i32,
    pub active_users: i64,
}

/// Total unique users in the course settings table.
pub async fn get_total_users_in_course_settings(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<TotalCount> {
    let res = sqlx::query_as!(
        TotalCount,
        r#"
SELECT COUNT(DISTINCT user_id) AS "total_users!"
FROM user_course_settings
WHERE current_course_id = $1
  AND deleted_at IS NULL;
        "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Total unique users who have completed the course.
pub async fn get_total_users_completed_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<TotalCount> {
    let res = sqlx::query_as!(
        TotalCount,
        r#"
SELECT COUNT(DISTINCT user_id) AS "total_users!"
FROM course_module_completions
WHERE course_id = $1
  AND deleted_at IS NULL;
        "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Weekly count of unique users starting the course.
pub async fn get_weekly_unique_users_starting(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('week', created_at) AS "period_start!",
  COUNT(DISTINCT user_id) AS "user_count!"
FROM user_course_settings
WHERE current_course_id = $1
  AND deleted_at IS NULL
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Monthly count of unique users who started the course.
pub async fn get_monthly_unique_users_starting(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('month', created_at) AS "period_start!",
  COUNT(DISTINCT user_id) AS "user_count!"
FROM user_course_settings
WHERE current_course_id = $1
  AND deleted_at IS NULL
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id
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
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('day', created_at) AS "period_start!",
  COUNT(DISTINCT user_id) AS "user_count!"
FROM user_course_settings
WHERE current_course_id = $1
  AND created_at >= NOW() - ($2 || ' days')::INTERVAL
  AND deleted_at IS NULL
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id,
        days_limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Monthly count of users who submitted their first exercise.
pub async fn get_monthly_first_exercise_submissions(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('month', first_submission) AS "period_start!",
COUNT(user_id) AS "user_count!"
FROM (
    SELECT user_id,
      MIN(created_at) AS first_submission
    FROM exercise_slide_submissions
    WHERE course_id = $1
      AND deleted_at IS NULL
    GROUP BY user_id
  ) AS first_submissions
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id
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
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('day', first_submission) AS "period_start!",
  COUNT(user_id) AS "user_count!"
FROM (
    SELECT user_id,
      MIN(created_at) AS first_submission
    FROM exercise_slide_submissions
    WHERE course_id = $1
      AND created_at >= NOW() - ($2 || ' days')::INTERVAL
      AND deleted_at IS NULL
    GROUP BY user_id
  ) AS first_submissions
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id,
        days_limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Monthly count of users returning exercises (any submission).
pub async fn get_monthly_users_returning_exercises(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('month', created_at) AS "period_start!",
  COUNT(DISTINCT user_id) AS "user_count!"
FROM exercise_slide_submissions
WHERE course_id = $1
  AND deleted_at IS NULL
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Daily count of users returning exercises within specified days.
pub async fn get_daily_users_returning_exercises_last_n_days(
    conn: &mut PgConnection,
    course_id: Uuid,
    days_limit: i32,
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('day', created_at) AS "period_start!",
  COUNT(DISTINCT user_id) AS "user_count!"
FROM exercise_slide_submissions
WHERE course_id = $1
  AND created_at >= NOW() - ($2 || ' days')::INTERVAL
  AND deleted_at IS NULL
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id,
        days_limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Monthly count of users who have completed the course.
pub async fn get_monthly_course_completions(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('month', created_at) AS "period_start!",
  COUNT(DISTINCT user_id) AS "user_count!"
FROM course_module_completions
WHERE course_id = $1
  AND prerequisite_modules_completed = TRUE
  AND (
    needs_to_be_reviewed = FALSE
    OR needs_to_be_reviewed IS NULL
  )
  AND passed = TRUE
  AND deleted_at IS NULL
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Daily count of users who have completed the course within specified days.
pub async fn get_daily_course_completions_last_60_days(
    conn: &mut PgConnection,
    course_id: Uuid,
    days_limit: i32,
) -> ModelResult<Vec<TimeCount>> {
    let res = sqlx::query_as!(
        TimeCount,
        r#"
SELECT DATE_TRUNC('day', created_at) AS "period_start!",
COUNT(DISTINCT user_id) AS "user_count!"
FROM course_module_completions
WHERE course_id = $1
  AND prerequisite_modules_completed = TRUE
  AND (
    needs_to_be_reviewed = FALSE
    OR needs_to_be_reviewed IS NULL
  )
  AND created_at >= NOW() - ($2 || ' days')::INTERVAL
  AND deleted_at IS NULL
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id,
        days_limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Average time from course start to first exercise submission, grouped by month.
/// Returns the average time in seconds.
pub async fn get_avg_time_to_first_submission_by_month(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<AvgTimeSubmission>> {
    let res = sqlx::query_as!(
        AvgTimeSubmission,
        r#"
SELECT DATE_TRUNC('month', user_start) AS "period_start!",
AVG(
  EXTRACT(
    EPOCH
    FROM (first_submission - user_start)
  )
) AS "avg_time_to_first_submission"
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
    GROUP BY u.user_id
  ) AS timings
GROUP BY period_start
ORDER BY period_start;
        "#,
        course_id,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Cohort Analysis: Weekly activity by users who started the course within specified months.
pub async fn get_cohort_weekly_activity(
    conn: &mut PgConnection,
    course_id: Uuid,
    months_limit: i32,
) -> ModelResult<Vec<CohortWeeklyActivity>> {
    let res = sqlx::query_as!(
        CohortWeeklyActivity,
        r#"
WITH cohort AS (
  SELECT user_id,
    DATE_TRUNC('week', created_at) AS cohort_week
  FROM user_course_settings
  WHERE current_course_id = $1
    AND created_at >= NOW() - ($3 || ' months')::INTERVAL
    AND deleted_at IS NULL
)
SELECT c.cohort_week,
  DATE_TRUNC('week', s.created_at) AS "period_start!",
  COUNT(DISTINCT s.user_id) AS "active_users!"
FROM cohort c
  JOIN exercise_slide_submissions s ON c.user_id = s.user_id
  AND s.course_id = $2
  AND s.deleted_at IS NULL
GROUP BY c.cohort_week,
  period_start
ORDER BY c.cohort_week,
  period_start;
        "#,
        course_id,
        course_id,
        months_limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Cohort Analysis: Daily activity tracking for 1 week (day 0 to day 6), limited to specified number of days.
pub async fn get_cohort_daily_activity(
    conn: &mut PgConnection,
    course_id: Uuid,
    days_limit: i32,
) -> ModelResult<Vec<CohortDailyActivity>> {
    let res = sqlx::query_as!(
        CohortDailyActivity,
        r#"
WITH cohort AS (
  SELECT user_id,
    DATE_TRUNC('day', created_at) AS cohort_day
  FROM user_course_settings
  WHERE current_course_id = $1
    AND created_at >= NOW() - ($3 || ' days')::INTERVAL
    AND deleted_at IS NULL
)
SELECT c.cohort_day,
  EXTRACT(
    DAY
    FROM (DATE_TRUNC('day', s.created_at) - c.cohort_day)
  )::int AS "day_offset!",
  COUNT(DISTINCT s.user_id) AS "active_users!"
FROM cohort c
  JOIN exercise_slide_submissions s ON c.user_id = s.user_id
  AND s.course_id = $2
  AND s.deleted_at IS NULL
WHERE DATE_TRUNC('day', s.created_at) < c.cohort_day + INTERVAL '7 days'
GROUP BY c.cohort_day,
  day_offset
ORDER BY c.cohort_day,
  day_offset;
        "#,
        course_id,
        course_id,
        days_limit
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
