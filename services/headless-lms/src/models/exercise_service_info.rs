use anyhow::Result;
use chrono::{DateTime, Utc};
use reqwest::IntoUrl;
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, Pool, Postgres};
use std::time::Duration;
use uuid::Uuid;

use crate::models::exercise_services::get_exercise_service_by_exercise_type;

use super::exercise_services::ExerciseService;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ExerciseServiceInfo {
    pub exercise_service_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub editor_iframe_path: String,
    pub exercise_iframe_path: String,
    pub grade_endpoint_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct FetchedExerciseServiceInfo {
    pub service_name: String,
    pub editor_iframe_path: String,
    pub exercise_iframe_path: String,
    pub grade_endpoint_path: String,
}

pub async fn fetch_and_upsert_service_info(
    conn: &mut PgConnection,
    exercise_service: &ExerciseService,
) -> Result<ExerciseServiceInfo> {
    let url = if let Some(internal_url) = &exercise_service.internal_url {
        internal_url
    } else {
        &exercise_service.public_url
    };
    let fetched_info = fetch_service_info(url).await?;
    let res = upsert_service_info(conn, exercise_service.id, &fetched_info).await?;
    Ok(res)
}

pub async fn fetch_service_info(url: impl IntoUrl) -> Result<FetchedExerciseServiceInfo> {
    let client = reqwest::Client::new();
    let res = client
        .get(url) // e.g. http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info
        .timeout(Duration::from_secs(120))
        .send()
        .await?;
    let status = res.status();
    if !status.is_success() {
        anyhow::bail!("Could not fetch service info.")
    }
    let res = res.json::<FetchedExerciseServiceInfo>().await?;
    Ok(res)
}

pub async fn upsert_service_info(
    conn: &mut PgConnection,
    exercise_service_id: Uuid,
    update: &FetchedExerciseServiceInfo,
) -> Result<ExerciseServiceInfo> {
    let res = sqlx::query_as!(
        ExerciseServiceInfo,
        r#"
INSERT INTO exercise_service_info(
    exercise_service_id,
    editor_iframe_path,
    exercise_iframe_path,
    grade_endpoint_path
  )
VALUES ($1, $2, $3, $4)
ON CONFLICT(exercise_service_id) DO UPDATE
SET editor_iframe_path = $2,
  exercise_iframe_path = $3,
  grade_endpoint_path = $4
RETURNING *
    "#,
        exercise_service_id,
        update.editor_iframe_path,
        update.exercise_iframe_path,
        update.grade_endpoint_path
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_service_info(
    conn: &mut PgConnection,
    exercise_service_id: Uuid,
) -> Result<ExerciseServiceInfo> {
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
) -> Result<ExerciseServiceInfo> {
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
