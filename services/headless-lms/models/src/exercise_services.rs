use url::Url;
use utoipa::ToSchema;

use crate::{
    exercise_service_info::{ExerciseServiceInfo, get_all_exercise_services_by_type},
    prelude::*,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

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

/// Exercise service definition that the CMS can use to render the editor view.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct ExerciseServiceIframeRenderingInfo {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub public_iframe_url: String,
    // #[serde(skip_serializing_if = "Option::is_none")]
    pub has_custom_view: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct ExerciseServiceNewOrUpdate {
    pub name: String,
    pub slug: String,
    pub public_url: String,
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

pub async fn update_exercise_service(
    conn: &mut PgConnection,
    id: Uuid,
    exercise_service_update: &ExerciseServiceNewOrUpdate,
) -> ModelResult<ExerciseService> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
UPDATE exercise_services
    SET name=$1, slug=$2, public_url=$3, internal_url=$4, max_reprocessing_submissions_at_once=$5
WHERE id=$6
    RETURNING *
        "#,
        exercise_service_update.name,
        exercise_service_update.slug,
        exercise_service_update.public_url,
        exercise_service_update.internal_url,
        exercise_service_update.max_reprocessing_submissions_at_once,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete_exercise_service(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ExerciseService> {
    let deleted = sqlx::query_as!(
        ExerciseService,
        r#"
UPDATE exercise_services
    SET deleted_at = now()
WHERE id = $1
AND deleted_at IS NULL
    RETURNING *
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
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
AND deleted_at IS NULL
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
    get_exercise_service_internally_preferred_baseurl(&exercise_service)
}

pub fn get_exercise_service_internally_preferred_baseurl(
    exercise_service: &ExerciseService,
) -> ModelResult<Url> {
    let stored_url_str = exercise_service
        .internal_url
        .as_ref()
        .unwrap_or(&exercise_service.public_url);
    let mut url = Url::parse(stored_url_str).map_err(|original_error| {
        ModelError::new(
            ModelErrorType::Generic,
            original_error.to_string(),
            Some(original_error.into()),
        )
    })?;
    // remove the path because all relative urls in service info assume
    // that the base url prefix has no path
    url.set_path("");
    Ok(url)
}

pub fn get_exercise_service_externally_preferred_baseurl(
    exercise_service: &ExerciseService,
) -> ModelResult<Url> {
    let stored_url_str = &exercise_service.public_url;
    let mut url = Url::parse(stored_url_str).map_err(|original_error| {
        ModelError::new(
            ModelErrorType::Generic,
            original_error.to_string(),
            Some(original_error.into()),
        )
    })?;
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

/**
Returns a url that can be used to ask this exercise service to turn host-stored uploaded
files into its own `UserAnswer`. `None` when the service does not declare the endpoint,
which is also what marks it unable to serve a native client.
*/
pub fn get_internal_build_user_answer_url(
    exercise_service: &ExerciseService,
    exercise_service_info: &ExerciseServiceInfo,
) -> ModelResult<Option<Url>> {
    let Some(path) = exercise_service_info
        .build_user_answer_endpoint_path
        .as_deref()
    else {
        return Ok(None);
    };
    let mut url = get_exercise_service_internally_preferred_baseurl(exercise_service)?;
    url.set_path(path);
    Ok(Some(url))
}

/**
Returns a url that can be used to ask this exercise service which files one of its answers
consists of. `None` when the service does not declare the endpoint, which leaves answers made
in its IFrame with no files for the host to record.
*/
pub fn get_internal_answer_files_url(
    exercise_service: &ExerciseService,
    exercise_service_info: &ExerciseServiceInfo,
) -> ModelResult<Option<Url>> {
    let Some(path) = exercise_service_info.answer_files_endpoint_path.as_deref() else {
        return Ok(None);
    };
    let mut url = get_exercise_service_internally_preferred_baseurl(exercise_service)?;
    url.set_path(path);
    Ok(Some(url))
}

/**
Slugs of the exercise services that can serve a native (non-browser) client, i.e. those
declaring a `build_user_answer_endpoint_path`.

Reads the `exercise_service_info` cache that `service-info-fetcher` refreshes about once a
minute. Callers must not fetch service info live instead: that would fan a single request
out to every exercise service.
*/
pub async fn get_native_client_capable_slugs(conn: &mut PgConnection) -> ModelResult<Vec<String>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT es.slug
FROM exercise_services AS es
  JOIN exercise_service_info AS esi ON esi.exercise_service_id = es.id
WHERE es.deleted_at IS NULL
  AND esi.build_user_answer_endpoint_path IS NOT NULL
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub fn get_model_solution_url(
    exercise_service: &ExerciseService,
    exercise_service_info: &ExerciseServiceInfo,
) -> ModelResult<Url> {
    let mut url = get_exercise_service_internally_preferred_baseurl(exercise_service)?;
    url.set_path(&exercise_service_info.model_solution_spec_endpoint_path);
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

pub async fn get_all_exercise_services_iframe_rendering_infos(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ExerciseServiceIframeRenderingInfo>> {
    let services = get_exercise_services(conn).await?;
    let service_infos = get_all_exercise_services_by_type(conn).await?;
    let res = services
        .into_iter()
        .filter_map(|exercise_service| {
            if let Some((_, service_info)) = service_infos.get(&exercise_service.slug) {
                match get_exercise_service_externally_preferred_baseurl(&exercise_service) { Ok(mut url) => {
                    url.set_path(&service_info.user_interface_iframe_path);
                    Some(ExerciseServiceIframeRenderingInfo {
                        id: exercise_service.id,
                        name: exercise_service.name,
                        slug: exercise_service.slug,
                        public_iframe_url: url.to_string(),
                        has_custom_view: service_info.has_custom_view,
                    })
                } _ => {
                    warn!(exercise_service_id = ?exercise_service.id, "Skipping exercise service from the list because it has an invalid base url");
                    None
                }}

            } else {
                warn!(exercise_service_id = ?exercise_service.id, "Skipping exercise service from the list because it doesn't have a service info");
                None
            }
        })
        .collect::<Vec<_>>();
    Ok(res)
}

pub async fn insert_exercise_service(
    conn: &mut PgConnection,
    exercise_service_update: &ExerciseServiceNewOrUpdate,
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
        exercise_service_update.name,
        exercise_service_update.slug,
        exercise_service_update.public_url,
        exercise_service_update.internal_url,
        exercise_service_update.max_reprocessing_submissions_at_once
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::exercise_service_info::{self, ExerciseServiceInfo, PathInfo};
    use crate::test_helper::*;

    async fn insert_service(
        tx: &mut PgConnection,
        slug: &str,
        build_user_answer_endpoint_path: Option<&str>,
    ) -> (ExerciseService, ExerciseServiceInfo) {
        let service = insert_exercise_service(
            tx,
            &ExerciseServiceNewOrUpdate {
                name: slug.to_string(),
                slug: slug.to_string(),
                public_url: "https://example.com".to_string(),
                internal_url: Some("http://internal.example.com".to_string()),
                max_reprocessing_submissions_at_once: 1,
            },
        )
        .await
        .unwrap();
        let info = exercise_service_info::insert(
            tx,
            &PathInfo {
                exercise_service_id: service.id,
                user_interface_iframe_path: "/iframe".to_string(),
                grade_endpoint_path: "/grade".to_string(),
                public_spec_endpoint_path: "/public-spec".to_string(),
                model_solution_spec_endpoint_path: "/model-solution".to_string(),
                has_custom_view: false,
                build_user_answer_endpoint_path: build_user_answer_endpoint_path
                    .map(ToString::to_string),
                answer_files_endpoint_path: None,
            },
        )
        .await
        .unwrap();
        (service, info)
    }

    #[tokio::test]
    async fn only_services_declaring_a_build_user_answer_path_are_native_client_capable() {
        insert_data!(:tx);
        insert_service(tx.as_mut(), "capable", Some("/api/build-user-answer")).await;
        insert_service(tx.as_mut(), "not-capable", None).await;

        // Asserted by membership rather than equality: a seeded database has services of its own.
        let slugs = get_native_client_capable_slugs(tx.as_mut()).await.unwrap();
        assert!(slugs.contains(&"capable".to_string()), "{slugs:?}");
        assert!(!slugs.contains(&"not-capable".to_string()), "{slugs:?}");
        tx.rollback().await;
    }

    #[tokio::test]
    async fn a_deleted_service_is_not_native_client_capable() {
        insert_data!(:tx);
        let (service, _) = insert_service(tx.as_mut(), "deleted-capable", Some("/build")).await;
        delete_exercise_service(tx.as_mut(), service.id)
            .await
            .unwrap();
        assert!(
            !get_native_client_capable_slugs(tx.as_mut())
                .await
                .unwrap()
                .contains(&"deleted-capable".to_string())
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn a_service_without_service_info_is_not_native_client_capable() {
        insert_data!(:tx);
        insert_exercise_service(
            tx.as_mut(),
            &ExerciseServiceNewOrUpdate {
                name: "no-info".to_string(),
                slug: "no-info".to_string(),
                public_url: "https://example.com".to_string(),
                internal_url: None,
                max_reprocessing_submissions_at_once: 1,
            },
        )
        .await
        .unwrap();
        assert!(
            !get_native_client_capable_slugs(tx.as_mut())
                .await
                .unwrap()
                .contains(&"no-info".to_string())
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn build_user_answer_url_resolves_against_the_internal_base_url() {
        insert_data!(:tx);
        let (capable, capable_info) =
            insert_service(tx.as_mut(), "capable", Some("/api/build-user-answer")).await;
        assert_eq!(
            get_internal_build_user_answer_url(&capable, &capable_info)
                .unwrap()
                .map(|url| url.to_string()),
            Some("http://internal.example.com/api/build-user-answer".to_string())
        );

        let (plain, plain_info) = insert_service(tx.as_mut(), "not-capable", None).await;
        assert!(
            get_internal_build_user_answer_url(&plain, &plain_info)
                .unwrap()
                .is_none()
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn answer_files_url_resolves_against_the_internal_base_url() {
        insert_data!(:tx);
        let (service, info) = insert_service(tx.as_mut(), "enumerating", None).await;
        assert!(
            get_internal_answer_files_url(&service, &info)
                .unwrap()
                .is_none()
        );

        let updated = crate::exercise_service_info::upsert_service_info(
            tx.as_mut(),
            service.id,
            &crate::exercise_service_info::ExerciseServiceInfoApi {
                service_name: "enumerating".to_string(),
                user_interface_iframe_path: info.user_interface_iframe_path.clone(),
                grade_endpoint_path: info.grade_endpoint_path.clone(),
                public_spec_endpoint_path: info.public_spec_endpoint_path.clone(),
                model_solution_spec_endpoint_path: info.model_solution_spec_endpoint_path.clone(),
                has_custom_view: Some(false),
                csv_export_definitions_endpoint_path: None,
                csv_export_answers_endpoint_path: None,
                build_user_answer_endpoint_path: None,
                answer_files_endpoint_path: Some("/api/answer-files".to_string()),
            },
        )
        .await
        .unwrap();
        assert_eq!(
            get_internal_answer_files_url(&service, &updated)
                .unwrap()
                .map(|url| url.to_string()),
            Some("http://internal.example.com/api/answer-files".to_string())
        );
        tx.rollback().await;
    }
}
