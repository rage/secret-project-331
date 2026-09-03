use std::collections::HashMap;

use futures::future::BoxFuture;
use url::Url;
use utoipa::ToSchema;

use crate::{
    exercise_services::{
        ExerciseService, get_exercise_service_by_exercise_type, get_exercise_services,
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
    //#[serde(skip_serializing_if = "Option::is_none")]
    pub has_custom_view: bool,
    pub csv_export_definitions_endpoint_path: Option<String>,
    pub csv_export_answers_endpoint_path: Option<String>,
    pub supports_native_client: bool,
    pub produces_file_answers: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct PathInfo {
    pub exercise_service_id: Uuid,
    pub user_interface_iframe_path: String,
    pub grade_endpoint_path: String,
    pub public_spec_endpoint_path: String,
    pub model_solution_spec_endpoint_path: String,
    // #[serde(skip_serializing_if = "Option::is_none")]
    pub has_custom_view: bool,
    pub supports_native_client: bool,
    pub produces_file_answers: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]

pub struct CourseMaterialExerciseServiceInfo {
    pub exercise_iframe_url: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct ExerciseServiceInfoApi {
    pub service_name: String,
    pub user_interface_iframe_path: String,
    pub grade_endpoint_path: String,
    pub public_spec_endpoint_path: String,
    pub model_solution_spec_endpoint_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_custom_view: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub csv_export_definitions_endpoint_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub csv_export_answers_endpoint_path: Option<String>,
    /// Whether the service can be answered from a native (non-browser) client. Declaring it is
    /// what makes the service visible to the exercise-services client API.
    #[serde(default)]
    pub supports_native_client: bool,
    /// Whether this service's answers consist of uploaded files rather than JSON. Unrelated to
    /// `supports_native_client`, which is about the client that answers, not the answer's shape.
    #[serde(default)]
    pub produces_file_answers: bool,
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
    model_solution_spec_endpoint_path,
    has_custom_view,
    supports_native_client,
    produces_file_answers
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *
",
        exercise_service_info.exercise_service_id,
        exercise_service_info.user_interface_iframe_path,
        exercise_service_info.grade_endpoint_path,
        exercise_service_info.public_spec_endpoint_path,
        exercise_service_info.model_solution_spec_endpoint_path,
        exercise_service_info.has_custom_view,
        exercise_service_info.supports_native_client,
        exercise_service_info.produces_file_answers
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
    model_solution_spec_endpoint_path,
    has_custom_view,
    csv_export_definitions_endpoint_path,
    csv_export_answers_endpoint_path,
    supports_native_client,
    produces_file_answers
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT(exercise_service_id) DO UPDATE
SET user_interface_iframe_path = $2,
  grade_endpoint_path = $3,
  public_spec_endpoint_path = $4,
  model_solution_spec_endpoint_path = $5,
  has_custom_view = $6,
  csv_export_definitions_endpoint_path = $7,
  csv_export_answers_endpoint_path = $8,
  supports_native_client = $9,
  produces_file_answers = $10
RETURNING *
    "#,
        exercise_service_id,
        update.user_interface_iframe_path,
        update.grade_endpoint_path,
        update.public_spec_endpoint_path,
        update.model_solution_spec_endpoint_path,
        update.has_custom_view.unwrap_or_else(|| false),
        update.csv_export_definitions_endpoint_path.as_deref(),
        update.csv_export_answers_endpoint_path.as_deref(),
        update.supports_native_client,
        update.produces_file_answers
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
        get_upsert_service_info_by_exercise_service(conn, &exercise_service, fetch_service_info)
            .await?;
    Ok(service_info)
}

pub async fn get_all_exercise_services_by_type(
    conn: &mut PgConnection,
) -> ModelResult<HashMap<String, (ExerciseService, ExerciseServiceInfo)>> {
    let mut exercise_services_by_type = HashMap::new();
    for exercise_service in get_exercise_services(conn).await? {
        match get_service_info_by_exercise_service(conn, &exercise_service).await {
            Ok(Some(info)) => {
                exercise_services_by_type
                    .insert(exercise_service.slug.clone(), (exercise_service, info));
            }
            _ => {
                tracing::error!(
                    "No corresponding service info found for {} ({})",
                    exercise_service.name,
                    exercise_service.id
                );
            }
        }
    }
    Ok(exercise_services_by_type)
}

pub async fn get_upsert_all_exercise_services_by_type(
    conn: &mut PgConnection,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<HashMap<String, (ExerciseService, ExerciseServiceInfo)>> {
    let mut exercise_services_by_type = HashMap::new();
    for exercise_service in get_exercise_services(conn).await? {
        match get_upsert_service_info_by_exercise_service(
            conn,
            &exercise_service,
            &fetch_service_info,
        )
        .await
        {
            Ok(info) => {
                exercise_services_by_type
                    .insert(exercise_service.slug.clone(), (exercise_service, info));
            }
            _ => {
                tracing::error!(
                    "No corresponding service info found for {} ({})",
                    exercise_service.name,
                    exercise_service.id
                );
            }
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
        let info = get_upsert_service_info_by_exercise_service(
            conn,
            &exercise_service,
            &fetch_service_info,
        )
        .await?;
        exercise_services_by_type.insert(exercise_service.slug.clone(), (exercise_service, info));
    }
    Ok(exercise_services_by_type)
}

pub async fn get_upsert_service_info_by_exercise_service(
    conn: &mut PgConnection,
    exercise_service: &ExerciseService,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<ExerciseServiceInfo> {
    let res = get_service_info(conn, exercise_service.id).await;
    let service_info = match res {
        Ok(exercise_service_info) => exercise_service_info,
        _ => {
            warn!(
                "Could not find service info for {} ({}). This is rare and only should happen when a background worker has not had the opportunity to complete their fetching task yet. Trying the fetching here in this worker so that we can continue.",
                exercise_service.name, exercise_service.slug
            );

            fetch_and_upsert_service_info(conn, exercise_service, fetch_service_info).await?
        }
    };
    Ok(service_info)
}

pub async fn get_service_info_by_exercise_service(
    conn: &mut PgConnection,
    exercise_service: &ExerciseService,
) -> ModelResult<Option<ExerciseServiceInfo>> {
    let res = get_service_info(conn, exercise_service.id).await;
    let service_info = match res {
        Ok(exercise_service_info) => exercise_service_info,
        _ => {
            warn!(
                "Could not find service info for {} ({}). This is rare and only should happen when a background worker has not had the opportunity to complete their fetching task yet.",
                exercise_service.name, exercise_service.slug
            );
            return Ok(None);
        }
    };
    Ok(Some(service_info))
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
    match get_exercise_service_by_exercise_type(conn, exercise_type).await {
        Ok(exercise_service) => {
            let full_service_info = get_upsert_service_info_by_exercise_service(
                conn,
                &exercise_service,
                fetch_service_info,
            )
            .await;
            let service_info_option = match full_service_info {
                Ok(o) => {
                    // Need to convert relative url to absolute url because
                    // otherwise the material won't be able to request the path
                    // if the path is in a different domain
                    let mut url =
                        Url::parse(&exercise_service.public_url).map_err(|original_err| {
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
                }
                _ => None,
            };

            Ok(service_info_option)
        }
        _ => Ok(None),
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::exercise_services::{ExerciseServiceNewOrUpdate, insert_exercise_service};
    use crate::test_helper::*;

    fn service_info_body(produces_file_answers: Option<bool>) -> serde_json::Value {
        let mut body = serde_json::json!({
            "service_name": "File answers",
            "user_interface_iframe_path": "/iframe",
            "grade_endpoint_path": "/grade",
            "public_spec_endpoint_path": "/public-spec",
            "model_solution_spec_endpoint_path": "/model-solution",
        });
        if let Some(declared) = produces_file_answers {
            body["produces_file_answers"] = serde_json::json!(declared);
        }
        body
    }

    /// Services deployed before the field existed omit it, and their service info must still
    /// deserialize instead of failing wholesale.
    #[test]
    fn a_service_info_body_declares_file_answers_or_defaults_to_not_producing_them() {
        let omitted: ExerciseServiceInfoApi =
            serde_json::from_value(service_info_body(None)).unwrap();
        assert!(!omitted.produces_file_answers);

        let declared: ExerciseServiceInfoApi =
            serde_json::from_value(service_info_body(Some(true))).unwrap();
        assert!(declared.produces_file_answers);
    }

    /// What a service declares is what the teacher UI offers an answer-file download for, and the
    /// declaration only reaches it by being stored on the fetch hop.
    #[tokio::test]
    async fn a_declared_file_answer_capability_survives_the_fetch_and_store_hop() {
        insert_data!(:tx);
        let slug = format!("file-answers-{}", Uuid::new_v4());
        let service = insert_exercise_service(
            tx.as_mut(),
            &ExerciseServiceNewOrUpdate {
                name: slug.clone(),
                slug: slug.clone(),
                public_url: "http://example.com/api/service".to_string(),
                internal_url: None,
                max_reprocessing_submissions_at_once: 1,
            },
        )
        .await
        .unwrap();
        let declared: ExerciseServiceInfoApi =
            serde_json::from_value(service_info_body(Some(true))).unwrap();

        let fetched = get_service_info_by_exercise_type(tx.as_mut(), &slug, |_url| {
            let declared = declared.clone();
            Box::pin(async move { Ok(declared) })
        })
        .await
        .unwrap();

        assert!(fetched.produces_file_answers);
        assert!(
            get_service_info(tx.as_mut(), service.id)
                .await
                .unwrap()
                .produces_file_answers
        );
        tx.rollback().await;
    }
}
