use super::{exercise_service_info::ExerciseServiceInfo, ModelError, ModelResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use url::Url;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ExerciseService {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub name: String,
    pub slug: String,
    pub public_url: String,
    /// This is needed because connecting to services directly inside the cluster with a special url is much for efficient than connecting to the same service with a url that would get routed though the internet. If not defined, use we can reach the service with the public url.
    pub internal_url: Option<String>,
    pub max_reprocessing_submissions_at_once: i32,
}

pub async fn get_exercise_service(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ExerciseService> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
SELECT *
FROM exercise_services
WHERE id = $1
  "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_service_by_exercise_type(
    conn: &mut PgConnection,
    exercise_type: &str,
) -> ModelResult<ExerciseService> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
SELECT *
FROM exercise_services
WHERE slug = $1
  "#,
        exercise_type
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_service_internally_preferred_baseurl_by_exercise_type(
    conn: &mut PgConnection,
    exercise_type: &str,
) -> ModelResult<Url> {
    let exercise_service = get_exercise_service_by_exercise_type(conn, exercise_type).await?;
    Ok(get_exercise_service_internally_preferred_baseurl(
        &exercise_service,
    )?)
}

pub fn get_exercise_service_internally_preferred_baseurl(
    exercise_service: &ExerciseService,
) -> ModelResult<Url> {
    let stored_url_str = exercise_service
        .internal_url
        .as_ref()
        .unwrap_or(&exercise_service.public_url);
    let mut url = Url::parse(stored_url_str)
        .map_err(|original_error| ModelError::Generic(original_error.to_string()))?;
    // remove the path because all relative urls in service info assume
    // that the base url prefix has no path
    url.set_path("");
    Ok(url)
}

/**
Returns a url that can be used to grade a submission for this exercise service.
*/
pub async fn get_internal_grade_url(
    exercise_service: &ExerciseService,
    exercise_service_info: &ExerciseServiceInfo,
) -> ModelResult<Url> {
    let mut url = get_exercise_service_internally_preferred_baseurl(exercise_service)?;
    url.set_path(&exercise_service_info.grade_endpoint_path);
    Ok(url)
}

/**
Returns a url that can be used to generate a public version of a private spec.
*/
pub fn get_internal_public_spec_url(
    exercise_service: &ExerciseService,
    exercise_service_info: &ExerciseServiceInfo,
) -> ModelResult<Url> {
    let mut url = get_exercise_service_internally_preferred_baseurl(exercise_service)?;
    url.set_path(&exercise_service_info.public_spec_endpoint_path);
    Ok(url)
}

pub fn get_model_solution_url(
    exercise_service: &ExerciseService,
    exercise_service_info: &ExerciseServiceInfo,
) -> ModelResult<Url> {
    let mut url = get_exercise_service_internally_preferred_baseurl(exercise_service)?;
    url.set_path(&exercise_service_info.model_solution_path);
    Ok(url)
}

pub async fn get_exercise_services(conn: &mut PgConnection) -> ModelResult<Vec<ExerciseService>> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
SELECT *
FROM exercise_services
WHERE deleted_at IS NULL
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn insert_exercise_service(
    conn: &mut PgConnection,
    name: &str,
    slug: &str,
    public_url: &str,
    internal_url: &str,
    max_reprocessing_submissions_at_once: i32,
) -> ModelResult<ExerciseService> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
INSERT INTO exercise_services (
    name,
    slug,
    public_url,
    internal_url,
    max_reprocessing_submissions_at_once
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
  "#,
        name,
        slug,
        public_url,
        internal_url,
        max_reprocessing_submissions_at_once
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
