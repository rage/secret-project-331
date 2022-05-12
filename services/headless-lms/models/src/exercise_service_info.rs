use std::{collections::HashMap, time::Duration};

use reqwest::IntoUrl;
use url::Url;

use crate::{
    exercise_services::{
        get_exercise_service_by_exercise_type, get_exercise_services, ExerciseService,
    },
    prelude::*,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ExerciseServiceInfo {
    pub exercise_service_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub exercise_type_specific_user_interface_iframe: String,
    pub grade_endpoint_path: String,
    pub public_spec_endpoint_path: String,
    pub model_solution_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct PathInfo {
    pub exercise_service_id: Uuid,
    pub exercise_type_specific_user_interface_iframe: String,
    pub grade_endpoint_path: String,
    pub public_spec_endpoint_path: String,
    pub model_solution_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialExerciseServiceInfo {
    pub exercise_iframe_url: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseServiceInfoApi {
    pub service_name: String,
    pub exercise_type_specific_user_interface_iframe: String,
    pub grade_endpoint_path: String,
    pub public_spec_endpoint_path: String,
    pub model_solution_path: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_service_info: &PathInfo,
) -> ModelResult<ExerciseServiceInfo> {
    let res = sqlx::query_as!(
        ExerciseServiceInfo,
        "
INSERT INTO exercise_service_info (
    exercise_service_id,
    exercise_type_specific_user_interface_iframe,
    grade_endpoint_path,
    public_spec_endpoint_path,
    model_solution_path
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
",
        exercise_service_info.exercise_service_id,
        exercise_service_info.exercise_type_specific_user_interface_iframe,
        exercise_service_info.grade_endpoint_path,
        exercise_service_info.public_spec_endpoint_path,
        exercise_service_info.model_solution_path
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

pub async fn fetch_service_info(url: impl IntoUrl) -> ModelResult<ExerciseServiceInfoApi> {
    let client = reqwest::Client::new();
    let res = client
        .get(url) // e.g. http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info
        .timeout(Duration::from_secs(120))
        .send()
        .await?;
    let status = res.status();
    if !status.is_success() {
        let response_url = res.url().to_string();
        let body = res.text().await?;
        warn!(url=?response_url, status=?status, body=?body, "Could not fetch service info.");
        return Err(ModelError::Generic(
            "Could not fetch service info.".to_string(),
        ));
    }
    let res = res.json::<ExerciseServiceInfoApi>().await?;
    Ok(res)
}

pub async fn upsert_service_info(
    conn: &mut PgConnection,
    exercise_service_id: Uuid,
    update: &ExerciseServiceInfoApi,
) -> ModelResult<ExerciseServiceInfo> {
    let res = sqlx::query_as!(
        ExerciseServiceInfo,
        r#"
INSERT INTO exercise_service_info(
    exercise_service_id,
    exercise_type_specific_user_interface_iframe,
    grade_endpoint_path,
    public_spec_endpoint_path,
    model_solution_path
  )
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT(exercise_service_id) DO UPDATE
SET exercise_type_specific_user_interface_iframe = $2,
  grade_endpoint_path = $3,
  public_spec_endpoint_path = $4,
  model_solution_path = $5
RETURNING *
    "#,
        exercise_service_id,
        update.exercise_type_specific_user_interface_iframe,
        update.grade_endpoint_path,
        update.public_spec_endpoint_path,
        update.model_solution_path
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
    let exercise_service = get_exercise_service_by_exercise_type(conn, exercise_type).await?;
    let service_info = get_service_info_by_exercise_service(conn, &exercise_service).await?;
    Ok(service_info)
}

pub async fn get_all_exercise_services_by_type(
    conn: &mut PgConnection,
) -> ModelResult<HashMap<String, (ExerciseService, ExerciseServiceInfo)>> {
    let mut exercise_services_by_type = HashMap::new();
    for exercise_service in get_exercise_services(conn).await? {
        if let Ok(info) = get_service_info_by_exercise_service(conn, &exercise_service).await {
            exercise_services_by_type
                .insert(exercise_service.slug.clone(), (exercise_service, info));
        } else {
            tracing::error!(
                "No corresponding service info found for {} ({})",
                exercise_service.name,
                exercise_service.id
            );
        }
    }
    Ok(exercise_services_by_type)
}

pub async fn get_selected_exercise_services_by_type(
    conn: &mut PgConnection,
    slugs: &[String],
) -> ModelResult<HashMap<String, (ExerciseService, ExerciseServiceInfo)>> {
    let selected_services = sqlx::query_as!(
        ExerciseService,
        "
SELECT *
FROM exercise_services
WHERE slug = ANY($1);",
        slugs,
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut exercise_services_by_type = HashMap::new();
    for exercise_service in selected_services {
        let info = get_service_info_by_exercise_service(conn, &exercise_service).await?;
        exercise_services_by_type.insert(exercise_service.slug.clone(), (exercise_service, info));
    }
    Ok(exercise_services_by_type)
}

pub async fn get_service_info_by_exercise_service(
    conn: &mut PgConnection,
    exercise_service: &ExerciseService,
) -> ModelResult<ExerciseServiceInfo> {
    let res = get_service_info(conn, exercise_service.id).await;
    let service_info = if let Ok(exercise_service_info) = res {
        exercise_service_info
    } else {
        warn!("Could not find service info for {} ({}). This is rare and only should happen when a background worker has not had the opportunity to complete their fetching task yet. Trying the fetching here in this worker so that we can continue.", exercise_service.name, exercise_service.slug);
        let fetched_service_info = fetch_and_upsert_service_info(conn, exercise_service).await?;
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
) -> ModelResult<Option<CourseMaterialExerciseServiceInfo>> {
    if let Ok(exercise_service) = get_exercise_service_by_exercise_type(conn, exercise_type).await {
        let full_service_info = get_service_info_by_exercise_service(conn, &exercise_service).await;
        let service_info_option = if let Ok(o) = full_service_info {
            // Need to convert relative url to absolute url because
            // otherwise the material won't be able to request the path
            // if the path is in a different domain
            let mut url = Url::parse(&exercise_service.public_url)
                .map_err(|original_err| ModelError::Generic(original_err.to_string()))?;
            url.set_path(&o.exercise_type_specific_user_interface_iframe);
            url.set_query(None);
            url.set_fragment(None);

            Some(CourseMaterialExerciseServiceInfo {
                exercise_iframe_url: url.to_string(),
            })
        } else {
            None
        };

        Ok(service_info_option)
    } else {
        Ok(None)
    }
}
