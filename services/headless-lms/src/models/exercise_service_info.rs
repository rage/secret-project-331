use super::ModelResult;
use chrono::{DateTime, Utc};
use reqwest::IntoUrl;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use std::time::Duration;
use ts_rs::TS;
use uuid::Uuid;

use crate::models::{exercise_services::get_exercise_service_by_exercise_type, ModelError};

use super::exercise_services::ExerciseService;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ExerciseServiceInfo {
    pub exercise_service_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub editor_iframe_path: String,
    pub exercise_iframe_path: String,
    pub submission_iframe_path: String,
    pub grade_endpoint_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct CourseMaterialExerciseServiceInfo {
    pub exercise_iframe_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct FetchedExerciseServiceInfo {
    pub service_name: String,
    pub editor_iframe_path: String,
    pub exercise_iframe_path: String,
    pub submission_iframe_path: String,
    pub grade_endpoint_path: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_service_id: Uuid,
    editor_iframe_path: &str,
    exercise_iframe_path: &str,
    grade_endpoint_path: &str,
    submission_iframe_path: &str,
) -> ModelResult<ExerciseServiceInfo> {
    let res = sqlx::query_as!(
        ExerciseServiceInfo,
        "
INSERT INTO exercise_service_info (
    exercise_service_id,
    editor_iframe_path,
    exercise_iframe_path,
    grade_endpoint_path,
    submission_iframe_path
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
",
        exercise_service_id,
        editor_iframe_path,
        exercise_iframe_path,
        grade_endpoint_path,
        submission_iframe_path
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn fetch_and_upsert_service_info(
    conn: &mut PgConnection,
    exercise_service: &ExerciseService,
) -> ModelResult<ExerciseServiceInfo> {
    let url = if let Some(internal_url) = &exercise_service.internal_url {
        internal_url
    } else {
        &exercise_service.public_url
    };
    let fetched_info = fetch_service_info(url).await?;
    let res = upsert_service_info(conn, exercise_service.id, &fetched_info).await?;
    Ok(res)
}

pub async fn fetch_service_info(url: impl IntoUrl) -> ModelResult<FetchedExerciseServiceInfo> {
    let client = reqwest::Client::new();
    let res = client
        .get(url) // e.g. http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info
        .timeout(Duration::from_secs(120))
        .send()
        .await?;
    let status = res.status();
    if !status.is_success() {
        return Err(ModelError::Generic("Could not fetch service info."));
    }
    let res = res.json::<FetchedExerciseServiceInfo>().await?;
    Ok(res)
}

pub async fn upsert_service_info(
    conn: &mut PgConnection,
    exercise_service_id: Uuid,
    update: &FetchedExerciseServiceInfo,
) -> ModelResult<ExerciseServiceInfo> {
    let res = sqlx::query_as!(
        ExerciseServiceInfo,
        r#"
INSERT INTO exercise_service_info(
    exercise_service_id,
    editor_iframe_path,
    exercise_iframe_path,
    submission_iframe_path,
    grade_endpoint_path
  )
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT(exercise_service_id) DO UPDATE
SET editor_iframe_path = $2,
  exercise_iframe_path = $3,
  submission_iframe_path = $4,
  grade_endpoint_path = $5
RETURNING *
    "#,
        exercise_service_id,
        update.editor_iframe_path,
        update.exercise_iframe_path,
        update.submission_iframe_path,
        update.grade_endpoint_path
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_service_info(
    conn: &mut PgConnection,
    exercise_service_id: Uuid,
) -> ModelResult<ExerciseServiceInfo> {
    let res = sqlx::query_as!(
        ExerciseServiceInfo,
        r#"
SELECT *
FROM exercise_service_info
WHERE exercise_service_id = $1
    "#,
        exercise_service_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_service_info_by_exercise_type(
    conn: &mut PgConnection,
    exercise_type: &str,
) -> ModelResult<ExerciseServiceInfo> {
    let service = get_exercise_service_by_exercise_type(conn, exercise_type).await?;
    let res = get_service_info(conn, service.id).await;
    let service_info = if let Ok(exercise_service_info) = res {
        exercise_service_info
    } else {
        warn!("Could not find service info for service. This is rare and only should happen when a background worker has not had the opportunity to complete their fetching task yet. Trying the fetching here in this worker so that we can continue.");
        let fetched_service_info = fetch_and_upsert_service_info(conn, &service).await?;
        fetched_service_info
    };
    Ok(service_info)
}

/**
Returns service info meant for the course material. If no service info is found and fetching it fails, we return None to
indicate that the service info is unavailable.
*/
pub async fn get_course_material_service_info_by_exercise_type(
    conn: &mut PgConnection,
    exercise_type: &str,
) -> Option<CourseMaterialExerciseServiceInfo> {
    let full_service_info = get_service_info_by_exercise_type(conn, exercise_type).await;
    full_service_info
        .ok()
        .map(|o| CourseMaterialExerciseServiceInfo {
            exercise_iframe_path: o.exercise_iframe_path,
        })
}
