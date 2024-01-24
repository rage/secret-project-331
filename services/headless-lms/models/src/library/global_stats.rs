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
