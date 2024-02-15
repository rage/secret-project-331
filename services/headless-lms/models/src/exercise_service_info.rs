use std::collections::HashMap;

use futures::future::BoxFuture;
use url::Url;

use crate::{
    exercise_services::{
        get_exercise_service_by_exercise_type, get_exercise_services, ExerciseService,
    },
    prelude::*,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ExerciseServiceInfo {
    pub exercise_service_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user_interface_iframe_path: String,
    pub grade_endpoint_path: String,
    pub public_spec_endpoint_path: String,
    pub model_solution_spec_endpoint_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct PathInfo {
    pub exercise_service_id: Uuid,
    pub user_interface_iframe_path: String,
    pub grade_endpoint_path: String,
    pub public_spec_endpoint_path: String,
    pub model_solution_spec_endpoint_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialExerciseServiceInfo {
    pub exercise_iframe_url: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseServiceInfoApi {
    pub service_name: String,
    pub user_interface_iframe_path: String,
    pub grade_endpoint_path: String,
    pub public_spec_endpoint_path: String,
    pub model_solution_spec_endpoint_path: String,
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
    user_interface_iframe_path,
    grade_endpoint_path,
    public_spec_endpoint_path,
    model_solution_spec_endpoint_path
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
",
        exercise_service_info.exercise_service_id,
        exercise_service_info.user_interface_iframe_path,
        exercise_service_info.grade_endpoint_path,
        exercise_service_info.public_spec_endpoint_path,
        exercise_service_info.model_solution_spec_endpoint_path
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn fetch_and_upsert_service_info(
    conn: &mut PgConnection,
    exercise_service: &ExerciseService,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<ExerciseServiceInfo> {
    let url = match exercise_service
        .internal_url
        .clone()
        .map(|url| Url::parse(&url))
    {
        Some(Ok(url)) => url.to_string(),

        Some(Err(e)) => {
            warn!(
            "Internal_url provided for {} is not a valid url. Using public_url instead. Error: {}",
            exercise_service.name,
            e.to_string()
        );
            exercise_service.public_url.clone()
        }
        None => exercise_service.public_url.clone(),
    };
    let fetched_info = fetch_service_info(url.parse()?).await?;
    let res = upsert_service_info(conn, exercise_service.id, &fetched_info).await?;
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
    user_interface_iframe_path,
    grade_endpoint_path,
    public_spec_endpoint_path,
    model_solution_spec_endpoint_path
  )
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT(exercise_service_id) DO UPDATE
SET user_interface_iframe_path = $2,
  grade_endpoint_path = $3,
  public_spec_endpoint_path = $4,
  model_solution_spec_endpoint_path = $5
RETURNING *
    "#,
        exercise_service_id,
        update.user_interface_iframe_path,
        update.grade_endpoint_path,
        update.public_spec_endpoint_path,
        update.model_solution_spec_endpoint_path
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
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<ExerciseServiceInfo> {
    let exercise_service = get_exercise_service_by_exercise_type(conn, exercise_type).await?;
    let service_info =
        get_service_info_by_exercise_service(conn, &exercise_service, fetch_service_info).await?;
    Ok(service_info)
}

pub async fn get_all_exercise_services_by_type(
    conn: &mut PgConnection,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<HashMap<String, (ExerciseService, ExerciseServiceInfo)>> {
    let mut exercise_services_by_type = HashMap::new();
    for exercise_service in get_exercise_services(conn).await? {
        if let Ok(info) =
            get_service_info_by_exercise_service(conn, &exercise_service, &fetch_service_info).await
        {
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
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
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
        let info =
            get_service_info_by_exercise_service(conn, &exercise_service, &fetch_service_info)
                .await?;
        exercise_services_by_type.insert(exercise_service.slug.clone(), (exercise_service, info));
    }
    Ok(exercise_services_by_type)
}

pub async fn get_service_info_by_exercise_service(
    conn: &mut PgConnection,
    exercise_service: &ExerciseService,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<ExerciseServiceInfo> {
    let res = get_service_info(conn, exercise_service.id).await;
    let service_info = if let Ok(exercise_service_info) = res {
        exercise_service_info
    } else {
        warn!("Could not find service info for {} ({}). This is rare and only should happen when a background worker has not had the opportunity to complete their fetching task yet. Trying the fetching here in this worker so that we can continue.", exercise_service.name, exercise_service.slug);

        fetch_and_upsert_service_info(conn, exercise_service, fetch_service_info).await?
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
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<Option<CourseMaterialExerciseServiceInfo>> {
    if let Ok(exercise_service) = get_exercise_service_by_exercise_type(conn, exercise_type).await {
        let full_service_info =
            get_service_info_by_exercise_service(conn, &exercise_service, fetch_service_info).await;
        let service_info_option = if let Ok(o) = full_service_info {
            // Need to convert relative url to absolute url because
            // otherwise the material won't be able to request the path
            // if the path is in a different domain
            let mut url = Url::parse(&exercise_service.public_url).map_err(|original_err| {
                ModelError::new(
                    ModelErrorType::Generic,
                    original_err.to_string(),
                    Some(original_err.into()),
                )
            })?;
            url.set_path(&o.user_interface_iframe_path);
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
