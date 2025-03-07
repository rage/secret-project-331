use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GlobalStatEntry {
    pub course_name: String,
    pub course_id: Uuid,
    pub organization_id: Uuid,
    pub organization_name: String,
    pub year: String,
    pub value: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GlobalCourseModuleStatEntry {
    pub course_name: String,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub organization_id: Uuid,
    pub organization_name: String,
    pub year: String,
    pub value: i64,
    pub course_module_ects_credits: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct DomainCompletionStats {
    pub email_domain: String,
    pub total_completions: i64,
    pub unique_users: i64,
    pub registered_completion_percentage: Option<f64>,
    pub registered_completions: i64,
    pub not_registered_completions: i64,
    pub users_with_some_registered_completions: i64,
    pub users_with_some_unregistered_completions: i64,
    pub registered_ects_credits: f32,
    pub not_registered_ects_credits: f32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseCompletionStats {
    pub course_id: Uuid,
    pub course_name: String,
    pub total_completions: i64,
    pub unique_users: i64,
    pub registered_completion_percentage: Option<f64>,
    pub registered_completions: i64,
    pub not_registered_completions: i64,
    pub users_with_some_registered_completions: i64,
    pub users_with_some_unregistered_completions: i64,
    pub registered_ects_credits: f32,
    pub not_registered_ects_credits: f32,
}

pub async fn get_number_of_people_completed_a_course(
    conn: &mut PgConnection,
) -> ModelResult<Vec<GlobalStatEntry>> {
    let res = sqlx::query_as!(
        GlobalStatEntry,
        r#"
SELECT c.name AS course_name,
  q.year as "year!",
  q.value as "value!",
  q.course_id as "course_id!",
  o.id as "organization_id",
  o.name as "organization_name"
FROM (
    SELECT course_id,
      EXTRACT(
        'year'
        FROM completion_date
      )::varchar as year,
      COUNT(DISTINCT user_id) as value
    FROM course_module_completions
    WHERE deleted_at IS NULL
    GROUP BY course_id,
      year
    ORDER BY course_id,
      year
  ) q
  JOIN courses c ON q.course_id = c.id
  JOIN organizations o ON c.organization_id = o.id
WHERE c.is_draft = FALSE
  AND c.deleted_at IS NULL
  AND c.is_test_mode = FALSE
"#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_number_of_people_registered_completion_to_study_registry(
    conn: &mut PgConnection,
) -> ModelResult<Vec<GlobalStatEntry>> {
    let res = sqlx::query_as!(
        GlobalStatEntry,
        r#"
SELECT c.name AS course_name,
  q.year as "year!",
  q.value as "value!",
  q.course_id as "course_id!",
  o.id as "organization_id",
  o.name as "organization_name"
FROM (
    SELECT cmcrtsr.course_id,
      EXTRACT(
        'year'
        FROM cms.completion_date
      )::VARCHAR as year,
      COUNT(DISTINCT cmcrtsr.user_id) as value
    FROM course_module_completion_registered_to_study_registries cmcrtsr
      JOIN course_module_completions cms ON cmcrtsr.course_module_completion_id = cms.id
    WHERE cmcrtsr.deleted_at IS NULL
    GROUP BY cmcrtsr.course_id,
      year
    ORDER BY cmcrtsr.course_id,
      year
  ) q
  JOIN courses c ON q.course_id = c.id
  JOIN organizations o ON c.organization_id = o.id
WHERE c.is_draft = FALSE
  AND c.deleted_at IS NULL
  AND c.is_test_mode = FALSE
"#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_number_of_people_done_at_least_one_exercise(
    conn: &mut PgConnection,
) -> ModelResult<Vec<GlobalStatEntry>> {
    let res = sqlx::query_as!(
        GlobalStatEntry,
        r#"
SELECT c.name AS course_name,
  q.year as "year!",
  q.value as "value!",
  q.course_id as "course_id!",
  o.id as "organization_id",
  o.name as "organization_name"
FROM (
    SELECT course_id,
      EXTRACT(
        'year'
        FROM created_at
      )::VARCHAR as year,
      COUNT(DISTINCT user_id) as value
    FROM exercise_slide_submissions ess
    WHERE deleted_at IS NULL
    GROUP BY course_id,
      year
    ORDER BY course_id,
      year
  ) q
  JOIN courses c ON q.course_id = c.id
  JOIN organizations o ON c.organization_id = o.id
WHERE c.is_draft = FALSE
  AND c.deleted_at IS NULL
  AND c.is_test_mode = FALSE
"#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_number_of_people_started_course(
    conn: &mut PgConnection,
) -> ModelResult<Vec<GlobalStatEntry>> {
    let res = sqlx::query_as!(
        GlobalStatEntry,
        r#"
SELECT c.name AS course_name,
  q.year as "year!",
  q.value as "value!",
  q.course_id as "course_id!",
  o.id as "organization_id",
  o.name as "organization_name"
FROM (
    SELECT course_id,
      EXTRACT(
        'year'
        FROM created_at
      )::VARCHAR as year,
      COUNT(DISTINCT user_id) as value
    FROM course_instance_enrollments cie
    WHERE deleted_at IS NULL
    GROUP BY course_id,
      year
    ORDER BY course_id,
      year
  ) q
  JOIN courses c ON q.course_id = c.id
  JOIN organizations o ON c.organization_id = o.id
WHERE c.is_draft = FALSE
  AND c.deleted_at IS NULL
  AND c.is_test_mode = FALSE
"#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_module_stats_by_completions_registered_to_study_registry(
    conn: &mut PgConnection,
) -> ModelResult<Vec<GlobalCourseModuleStatEntry>> {
    let res = sqlx::query_as!(
        GlobalCourseModuleStatEntry,
        r#"
SELECT c.name as course_name,
  q.year as "year!",
  q.value as "value!",
  q.course_module_id as "course_module_id!",
  c.id as "course_id",
  cm.name as "course_module_name",
  cm.ects_credits as "course_module_ects_credits",
  o.id as "organization_id",
  o.name as "organization_name"
FROM (
    SELECT cmcrtsr.course_module_id,
      EXTRACT(
        'year'
        FROM cms.completion_date
      )::VARCHAR as year,
      COUNT(DISTINCT cmcrtsr.user_id) as value
    FROM course_module_completion_registered_to_study_registries cmcrtsr
      JOIN course_module_completions cms ON cmcrtsr.course_module_completion_id = cms.id
    WHERE cmcrtsr.deleted_at IS NULL
    GROUP BY cmcrtsr.course_module_id,
      year
    ORDER BY cmcrtsr.course_module_id,
      year
  ) q
  JOIN course_modules cm ON q.course_module_id = cm.id
  JOIN courses c ON cm.course_id = c.id
  JOIN organizations o ON c.organization_id = o.id
WHERE c.is_draft = FALSE
  AND c.deleted_at IS NULL
  AND c.is_test_mode = FALSE
"#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Produces a summary of course completions grouped by user's email domain.
///
/// The query deduplicates multiple completions of the same (user, course module) by:
/// 1. Preferring any completion that has a registration (exists in course_module_completion_registered_to_study_registries)
/// 2. If no registered completion is found, it picks the completion with the newest created_at timestamp
///
/// The query aggregates the following counts and sums by email domain:
///
/// * `total_completions` - Number of unique completions (after deduplication) for the domain
/// * `unique_users` - Number of distinct users (by user_id) in those completions
/// * `registered_completion_percentage` - Fraction of completions that are registered (multiplied by 100)
/// * `registered_completions` - Number of completions with a matching registration
/// * `not_registered_completions` - Number of completions without a matching registration
/// * `users_with_some_registered_completions` - Count of distinct users with at least one registered completion
/// * `users_with_some_unregistered_completions` - Count of distinct users with at least one unregistered completion
/// * `registered_ects_credits` - Total ECTS credits for registered completions
/// * `not_registered_ects_credits` - Total ECTS credits for unregistered completions
///
/// # Arguments
///
/// * `year` - Optional year to filter completions by
pub async fn get_completion_stats_by_email_domain(
    conn: &mut PgConnection,
    year: Option<i32>,
) -> ModelResult<Vec<DomainCompletionStats>> {
    let res = sqlx::query_as!(
      DomainCompletionStats,
      r#"
WITH deduped_completions AS (
SELECT *
FROM (
    SELECT cmc.*,
      CASE
        WHEN cmr.course_module_completion_id IS NOT NULL THEN 1
        ELSE 0
      END AS is_registered,
      ROW_NUMBER() OVER (
        PARTITION BY cmc.user_id,
        cmc.course_module_id
        ORDER BY CASE
            WHEN cmr.course_module_completion_id IS NOT NULL THEN 1
            ELSE 0
          END DESC,
          cmc.created_at DESC
      ) AS rn
    FROM course_module_completions cmc
      LEFT JOIN course_module_completion_registered_to_study_registries cmr ON cmc.id = cmr.course_module_completion_id
      AND cmr.deleted_at IS NULL
    WHERE cmc.deleted_at IS NULL
      AND (
        $1::int IS NULL
        OR EXTRACT(
          YEAR
          FROM cmc.completion_date
        ) = $1
      )
  ) sub
WHERE rn = 1
),
unique_registrations AS (
SELECT DISTINCT course_module_completion_id
FROM course_module_completion_registered_to_study_registries cmr
WHERE cmr.deleted_at IS NULL
)
SELECT u.email_domain AS "email_domain!",
COUNT(DISTINCT d.id) AS "total_completions!",
COUNT(DISTINCT d.user_id) AS "unique_users!",
ROUND(
  (
    SUM(
      CASE
        WHEN ur.course_module_completion_id IS NOT NULL THEN 1
        ELSE 0
      END
    ) * 100.0
  ) / NULLIF(COUNT(DISTINCT d.id), 0),
  2
)::float8 AS "registered_completion_percentage",
SUM(
  CASE
    WHEN ur.course_module_completion_id IS NOT NULL THEN 1
    ELSE 0
  END
) AS "registered_completions!",
SUM(
  CASE
    WHEN ur.course_module_completion_id IS NULL THEN 1
    ELSE 0
  END
) AS "not_registered_completions!",
COUNT(
  DISTINCT CASE
    WHEN ur.course_module_completion_id IS NOT NULL THEN d.user_id
  END
) AS "users_with_some_registered_completions!",
COUNT(
  DISTINCT CASE
    WHEN ur.course_module_completion_id IS NULL THEN d.user_id
  END
) AS "users_with_some_unregistered_completions!",
COALESCE(
  SUM(
    CASE
      WHEN ur.course_module_completion_id IS NOT NULL THEN cm.ects_credits
      ELSE 0
    END
  ),
  0
) AS "registered_ects_credits!",
COALESCE(
  SUM(
    CASE
      WHEN ur.course_module_completion_id IS NULL THEN cm.ects_credits
      ELSE 0
    END
  ),
  0
) AS "not_registered_ects_credits!"
FROM deduped_completions d
JOIN users u ON d.user_id = u.id
AND u.deleted_at IS NULL
LEFT JOIN unique_registrations ur ON d.id = ur.course_module_completion_id
JOIN courses c ON d.course_id = c.id
AND c.deleted_at IS NULL
JOIN course_modules cm ON d.course_module_id = cm.id
AND cm.deleted_at IS NULL
WHERE d.prerequisite_modules_completed = TRUE
AND c.is_draft = FALSE
AND c.is_test_mode = FALSE
AND cm.enable_registering_completion_to_uh_open_university = TRUE
AND cm.ects_credits IS NOT NULL
AND cm.ects_credits > 0
GROUP BY u.email_domain
ORDER BY "total_completions!" DESC,
email_domain
      "#,
      year
  )
  .fetch_all(conn)
  .await?;
    Ok(res)
}

/// Gets course completion statistics for a specific email domain.
///
/// Similar to get_completion_stats_by_email_domain, but returns per-course statistics
/// for a specific email domain instead of per-domain statistics.
///
/// # Arguments
///
/// * `email_domain` - The email domain to filter by (e.g. "gmail.com")
/// * `year` - Optional year to filter completions by
pub async fn get_course_completion_stats_for_email_domain(
    conn: &mut PgConnection,
    email_domain: String,
    year: Option<i32>,
) -> ModelResult<Vec<CourseCompletionStats>> {
    let res = sqlx::query_as!(
        CourseCompletionStats,
        r#"
WITH deduped_completions AS (
  SELECT *
  FROM (
      SELECT cmc.*,
        CASE
          WHEN cmr.course_module_completion_id IS NOT NULL THEN 1
          ELSE 0
        END AS is_registered,
        ROW_NUMBER() OVER (
          PARTITION BY cmc.user_id,
          cmc.course_module_id
          ORDER BY CASE
              WHEN cmr.course_module_completion_id IS NOT NULL THEN 1
              ELSE 0
            END DESC,
            cmc.created_at DESC
        ) AS rn
      FROM course_module_completions cmc
        LEFT JOIN course_module_completion_registered_to_study_registries cmr ON cmc.id = cmr.course_module_completion_id
        AND cmr.deleted_at IS NULL
      WHERE cmc.deleted_at IS NULL
        AND (
          $2::int IS NULL
          OR EXTRACT(
            YEAR
            FROM cmc.completion_date
          ) = $2
        )
    ) sub
  WHERE rn = 1
),
unique_registrations AS (
  SELECT DISTINCT course_module_completion_id
  FROM course_module_completion_registered_to_study_registries cmr
  WHERE cmr.deleted_at IS NULL
)
SELECT c.id AS "course_id!",
  c.name AS "course_name!",
  COUNT(DISTINCT d.id) AS "total_completions!",
  COUNT(DISTINCT d.user_id) AS "unique_users!",
  ROUND(
    (
      SUM(
        CASE
          WHEN ur.course_module_completion_id IS NOT NULL THEN 1
          ELSE 0
        END
      ) * 100.0
    ) / NULLIF(COUNT(DISTINCT d.id), 0),
    2
  )::float8 AS "registered_completion_percentage",
  SUM(
    CASE
      WHEN ur.course_module_completion_id IS NOT NULL THEN 1
      ELSE 0
    END
  ) AS "registered_completions!",
  SUM(
    CASE
      WHEN ur.course_module_completion_id IS NULL THEN 1
      ELSE 0
    END
  ) AS "not_registered_completions!",
  COUNT(
    DISTINCT CASE
      WHEN ur.course_module_completion_id IS NOT NULL THEN d.user_id
    END
  ) AS "users_with_some_registered_completions!",
  COUNT(
    DISTINCT CASE
      WHEN ur.course_module_completion_id IS NULL THEN d.user_id
    END
  ) AS "users_with_some_unregistered_completions!",
  COALESCE(
    SUM(
      CASE
        WHEN ur.course_module_completion_id IS NOT NULL THEN cm.ects_credits
        ELSE 0
      END
    ),
    0
  ) AS "registered_ects_credits!",
  COALESCE(
    SUM(
      CASE
        WHEN ur.course_module_completion_id IS NULL THEN cm.ects_credits
        ELSE 0
      END
    ),
    0
  ) AS "not_registered_ects_credits!"
FROM deduped_completions d
  JOIN users u ON d.user_id = u.id
  AND u.deleted_at IS NULL
  LEFT JOIN unique_registrations ur ON d.id = ur.course_module_completion_id
  JOIN courses c ON d.course_id = c.id
  AND c.deleted_at IS NULL
  JOIN course_modules cm ON d.course_module_id = cm.id
  AND cm.deleted_at IS NULL
WHERE d.prerequisite_modules_completed = TRUE
  AND c.is_draft = FALSE
  AND c.is_test_mode = FALSE
  AND cm.enable_registering_completion_to_uh_open_university = TRUE
  AND cm.ects_credits IS NOT NULL
  AND cm.ects_credits > 0
  AND u.email_domain = $1
GROUP BY c.id,
  c.name
ORDER BY "total_completions!" DESC,
  c.id
        "#,
        email_domain,
        year
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
