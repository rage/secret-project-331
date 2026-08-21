/*!
Handlers for HTTP requests to `/api/v0/files`.

*/
use super::helpers::file_uploading;
use crate::domain::models_requests::{DownloadClaim, JwtKey};
pub use crate::domain::{authorization::AuthorizationToken, models_requests::UploadClaim};
use crate::prelude::*;
use actix_files::NamedFile;
use std::path::{Component, Path};
use tokio::fs::read;
use utoipa::{OpenApi, PartialSchema, ToSchema};

/// OpenAPI-only representation of an arbitrary multipart binary part.
struct ExerciseUploadBinary;

impl PartialSchema for ExerciseUploadBinary {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::schema::Schema> {
        utoipa::openapi::schema::ObjectBuilder::new()
            .schema_type(utoipa::openapi::schema::Type::String)
            .format(Some(utoipa::openapi::SchemaFormat::KnownFormat(
                utoipa::openapi::KnownFormat::Binary,
            )))
            .into()
    }
}

impl ToSchema for ExerciseUploadBinary {}

#[derive(OpenApi)]
#[openapi(paths(upload_from_exercise_service, upload_answer_files))]
pub(crate) struct FilesApiDoc;
/**

GET `/api/v0/files/\*` Redirects the request to a file storage service.

This is meant for redirecting requests to appropriate storage services.
This approach decouples the storage mechanism from the urls.
Redirection is done with HTTP status 302 Found and it has a max
age of 5 minutes.

Redirects to local file handler in development and to a service in production.


# Example

`GET /api/v0/files/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/nNQbVax81fH4SLCXuQ9NrOWtqfHT6x.jpg`

Response headers:
```text
< HTTP/1.1 302 Found
< Date: Mon, 26 Apr 2021 10:38:09 GMT
< Content-Length: 0
< Connection: keep-alive
< cache-control: max-age=300, private
< location: /api/v0/files/uploads/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/nNQbVax81fH4SLCXuQ9NrOWtqfHT6x.jpg
```

*/
#[instrument(skip(file_store))]
#[allow(clippy::async_yields_async)]
async fn redirect_to_storage_service(
    tail: web::Path<String>,
    file_store: web::Data<dyn FileStore>,
) -> HttpResponse {
    let inner = tail.into_inner();
    let tail_path = Path::new(&inner);

    match file_store.get_direct_download_url(tail_path).await {
        Ok(url) => HttpResponse::Found()
            .append_header(("location", url))
            .append_header(("cache-control", "max-age=300, private"))
            .finish(),
        Err(e) => {
            error!("Could not get file {:?}", e);
            HttpResponse::NotFound()
                .append_header(("cache-control", "max-age=300, private"))
                .finish()
        }
    }
}

/**
GET `/api/v0/files/uploads/\*`
Serve local uploaded file, mostly for development.

# Example

`GET /api/v0/files/uploads/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/nNQbVax81fH4SLCXuQ9NrOWtqfHT6x.jpg`

Result:

The file.
*/
#[instrument(skip(req))]
async fn serve_upload(req: HttpRequest, pool: web::Data<PgPool>) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;

    // TODO: replace this whole function with the actix_files::Files service once it works with the used actix version.
    let base_folder = Path::new("uploads");
    let relative_path = req.match_info().query("tail");
    let requested_path = Path::new(relative_path);
    if requested_path.is_absolute()
        || requested_path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(controller_err!(
            BadRequest,
            "Invalid upload path".to_string()
        ));
    }

    let base_folder = base_folder
        .canonicalize()
        .map_err(|_e| controller_err!(NotFound, "File not found".to_string()))?;
    let path = base_folder
        .join(requested_path)
        .canonicalize()
        .map_err(|_e| controller_err!(NotFound, "File not found".to_string()))?;
    if !path.starts_with(&base_folder) {
        return Err(controller_err!(
            BadRequest,
            "Invalid upload path".to_string()
        ));
    }

    let named_file = NamedFile::open(path).map_err(|_e| {
        ControllerError::new(
            ControllerErrorType::NotFound,
            "File not found".to_string(),
            None,
        )
    })?;
    let path = named_file.path();
    let contents = read(path).await.map_err(|_e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Could not read file".to_string(),
            None,
        )
    })?;

    let extension = path.extension().map(|o| o.to_string_lossy().to_string());
    let mut mime_type = None;
    if let Some(ext_string) = extension {
        mime_type = match ext_string.as_str() {
            "jpg" => Some("image/jpg"),
            "png" => Some("image/png"),
            "svg" => Some("image/svg+xml"),
            "webp" => Some("image/webp"),
            "gif" => Some("image/gif"),
            _ => None,
        };
    }
    let mut response = HttpResponse::Ok();
    if let Some(m) = mime_type {
        response.append_header(("content-type", m));
    }
    if let Some(filename) = models::file_uploads::get_filename(&mut conn, relative_path)
        .await
        .optional()?
    {
        response.append_header(("Content-Disposition", format!("filename=\"{}\"", filename)));
    }

    // this endpoint is only used for development
    let token = skip_authorize();
    token.authorized_ok(response.body(contents))
}

/**
POST `/api/v0/files/:exercise_service_slug`
Used to upload data from exercise service iframes.

# Returns
An ordered list of host-assigned file ids and stored URLs.
*/
#[instrument(skip(payload, file_store, app_conf, upload_claim))]
#[utoipa::path(
    post,
    path = "/{exercise_service_slug}",
    operation_id = "uploadFilesFromExerciseService",
    tag = "files",
    params(
        ("exercise_service_slug" = String, Path, description = "Exercise service slug")
    ),
    request_body(
        content = inline(std::collections::HashMap<String, ExerciseUploadBinary>),
        content_type = "multipart/form-data"
    ),
    responses(
        (status = 200, description = "Uploaded files", body = [file_uploading::ExerciseServiceUploadResultEntry])
    )
)]

async fn upload_from_exercise_service(
    pool: web::Data<PgPool>,
    exercise_service_slug: web::Path<String>,
    payload: Multipart,
    file_store: web::Data<dyn FileStore>,
    user: Option<AuthUser>,
    upload_claim: Result<UploadClaim, ControllerError>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Vec<file_uploading::ExerciseServiceUploadResultEntry>>> {
    let mut conn = pool.acquire().await?;
    // accessed from exercise services, can't authenticate using login,
    // the upload claim is used to verify requests instead
    let token = skip_authorize();

    // the playground uses the special "playground" slug to upload temporary files
    if exercise_service_slug.as_str() != "playground" {
        // non-playground uploads require a valid upload claim or user
        match (&upload_claim, &user) {
            (Ok(upload_claim), _) => {
                if upload_claim.exercise_service_slug() != exercise_service_slug.as_ref() {
                    // upload claim's exercise type doesn't match the upload url
                    return Err(ControllerError::new(
                        ControllerErrorType::BadRequest,
                        "Exercise service slug did not match upload claim".to_string(),
                        None,
                    ));
                }
            }
            (_, Some(_user)) => {
                // TODO: for now, all users are allowed to upload files
            }
            (Err(_), None) => {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "Not logged in or missing upload claim".to_string(),
                    None,
                ));
            }
        }
    }

    let mut uploaded_paths = Vec::new();
    let uploaded_files = match file_uploading::process_exercise_service_upload(
        &mut conn,
        exercise_service_slug.as_str(),
        payload,
        file_store.as_ref(),
        &mut uploaded_paths,
        user.map(|user| user.id),
        &app_conf.base_url,
    )
    .await
    {
        Ok(uploads) => uploads.into_iter().map(|upload| upload.entry).collect(),
        Err(outer_err) => {
            // something went wrong while uploading the files, try to delete leftovers
            for uploaded in uploaded_paths {
                if let Err(err) = file_store.delete(Path::new(&uploaded.path)).await {
                    error!(
                        "Failed to delete file '{}' during cleanup: {err}",
                        uploaded.path
                    );
                }
            }
            return Err(outer_err);
        }
    };

    token.authorized_ok(web::Json(uploaded_files))
}

/**
POST `/api/v0/files/answer-uploads/:exercise_task_id`
Used to upload the files a student is attaching to an answer for the given exercise task.

Unlike `POST /api/v0/files/:exercise_service_slug` this binds every stored file to the uploader and
the task's exercise, which is what lets a later submission verify that the answer only names files
the submitter uploaded for that exercise.

# Returns
An ordered list of `file_uploads` ids and stored URLs, in the order the parts were sent.
*/
#[instrument(skip(payload, file_store, app_conf))]
#[utoipa::path(
    post,
    path = "/answer-uploads/{exercise_task_id}",
    operation_id = "uploadFilesForExerciseAnswer",
    tag = "files",
    params(
        ("exercise_task_id" = Uuid, Path, description = "Exercise task the files are attached to")
    ),
    request_body(
        content = inline(std::collections::HashMap<String, ExerciseUploadBinary>),
        content_type = "multipart/form-data"
    ),
    responses(
        (status = 200, description = "Uploaded files", body = [file_uploading::ExerciseServiceUploadResultEntry])
    )
)]
async fn upload_answer_files(
    pool: web::Data<PgPool>,
    exercise_task_id: web::Path<Uuid>,
    payload: Multipart,
    file_store: web::Data<dyn FileStore>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Vec<file_uploading::ExerciseServiceUploadResultEntry>>> {
    let mut conn = pool.acquire().await?;
    let slide = models::exercise_slides::get_exercise_slide_by_exercise_task_id(
        &mut conn,
        *exercise_task_id,
    )
    .await?
    .ok_or_else(|| controller_err!(NotFound, "Exercise task not found".to_string()))?;
    let exercise_task =
        models::exercise_tasks::get_exercise_task_by_id(&mut conn, *exercise_task_id).await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::ExerciseTask(*exercise_task_id),
    )
    .await?;

    let mut uploaded_paths = Vec::new();
    let stored = store_answer_uploads(
        &mut conn,
        AnswerUploadDestination {
            exercise_id: slide.exercise_id,
            user_id: user.id,
            path_prefix: exercise_task.exercise_type,
        },
        payload,
        file_store.as_ref(),
        &mut uploaded_paths,
        &app_conf.base_url,
    )
    .await;
    let uploads = match stored {
        Ok(uploads) => uploads,
        Err(error) => {
            // Objects reach the store before their rows are committed, so a rollback alone would
            // leave objects behind that no record points at and the reaper cannot see.
            for uploaded in uploaded_paths {
                if let Err(delete_error) = file_store.delete(Path::new(&uploaded.path)).await {
                    error!(
                        "Failed to delete file '{}' during cleanup: {delete_error}",
                        uploaded.path
                    );
                }
            }
            return Err(error);
        }
    };

    let entries = uploads.into_iter().map(|upload| upload.entry).collect();
    token.authorized_ok(web::Json(entries))
}

/// The download claim as it rides in the URL the host puts in a grading request.
#[derive(Debug, Deserialize)]
struct DownloadClaimQuery {
    #[serde(rename = "download-claim")]
    download_claim: String,
}

/**
GET `/api/v0/files/claimed/:file_upload_id?download-claim=:jwt`
Redirects to one host-stored file, authorized by a claim naming that file.

Used by exercise services grading a file-typed answer: the claim, not a session, is the
authorization, and it names a single file so a service cannot reach any other one.
*/
#[instrument(skip(file_store, jwt_key, query))]
async fn redirect_claimed_file(
    file_upload_id: web::Path<Uuid>,
    query: web::Query<DownloadClaimQuery>,
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<HttpResponse> {
    // accessed from exercise services, which cannot authenticate using login
    let token = skip_authorize();
    let claim = DownloadClaim::validate(&query.download_claim, &jwt_key)?;
    if claim.file_upload_id() != *file_upload_id {
        return Err(controller_err!(
            BadRequest,
            "Download claim does not match the requested file".to_string()
        ));
    }

    let mut conn = pool.acquire().await?;
    let file = models::file_uploads::get_many(&mut conn, &[*file_upload_id])
        .await?
        .pop()
        .ok_or_else(|| controller_err!(NotFound, "File not found".to_string()))?;
    let url = file_store
        .get_direct_download_url(Path::new(&file.path))
        .await
        .map_err(|err| controller_err!(NotFound, "File not found".to_string(), err))?;

    token.authorized_ok(
        HttpResponse::Found()
            .append_header(("location", url))
            .append_header(("cache-control", "max-age=300, private"))
            .finish(),
    )
}

/// Who an answer upload is bound to, and where its objects are stored.
struct AnswerUploadDestination {
    exercise_id: Uuid,
    user_id: Uuid,
    /// The task's exercise-service slug, so the stored objects stay laid out the way the slug
    /// route lays them out.
    path_prefix: String,
}

/// Stores the multipart parts and binds them to the exercise and user, so that a failure to record
/// the binding cannot leave uploads the reaper is unable to find.
///
/// The transaction opens only after the last byte has been streamed: the multipart body has no time
/// limit, so opening it first would pin a pool connection `idle in transaction` for the whole
/// upload.
async fn store_answer_uploads(
    conn: &mut PgConnection,
    destination: AnswerUploadDestination,
    payload: Multipart,
    file_store: &dyn FileStore,
    uploaded_paths: &mut Vec<file_uploading::ExerciseServiceUploadCleanup>,
    base_url: &str,
) -> Result<Vec<file_uploading::ExerciseServiceUpload>, ControllerError> {
    let streamed = file_uploading::stream_exercise_service_upload(
        &destination.path_prefix,
        payload,
        file_store,
        uploaded_paths,
        base_url,
    )
    .await?;

    let mut tx = conn.begin().await?;
    let uploads = file_uploading::record_exercise_service_upload(
        &mut tx,
        streamed,
        Some(destination.user_id),
    )
    .await?;
    let file_upload_ids: Vec<Uuid> = uploads.iter().map(|upload| upload.entry.id).collect();
    models::exercise_answer_uploads::insert_many(
        &mut tx,
        destination.exercise_id,
        destination.user_id,
        &file_upload_ids,
        models::exercise_answer_uploads::AnswerUploadOrigin::Iframe,
    )
    .await?;
    tx.commit().await?;
    Ok(uploads)
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/uploads/{tail:.*}", web::get().to(serve_upload))
        .route(
            "/answer-uploads/{exercise_task_id}",
            web::post().to(upload_answer_files),
        )
        .route(
            "/claimed/{file_upload_id}",
            web::get().to(redirect_claimed_file),
        )
        .route(
            "/{exercise_service_slug}",
            web::post().to(upload_from_exercise_service),
        )
        .route("{tail:.*}", web::get().to(redirect_to_storage_service));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exercise_upload_openapi_body_is_a_string_keyed_binary_map() {
        let document = serde_json::to_value(FilesApiDoc::openapi()).unwrap();
        let schema = document
            .pointer("/paths/~1{exercise_service_slug}/post/requestBody/content/multipart~1form-data/schema")
            .unwrap();

        assert_eq!(schema["type"], "object");
        assert_eq!(schema["additionalProperties"]["type"], "string");
        assert_eq!(schema["additionalProperties"]["format"], "binary");
    }
}

#[cfg(test)]
mod answer_upload_tests {
    use super::*;
    use crate::domain::models_requests::JwtKey;
    use crate::test_helper::*;
    use actix_session::{SessionMiddleware, storage::CookieSessionStore};
    use actix_web::cookie::{Cookie, Key, SameSite};
    use actix_web::http::StatusCode;
    use actix_web::{App, test};
    use std::sync::Arc;

    const BOUNDARY: &str = "answeruploadboundary";
    const SESSION_KEY_BYTES: &[u8] =
        b"answer-upload-tests-cookie-signing-key-that-is-long-enough-abcdef";

    /// Puts a user into the session without going through a login flow, so `AuthUser` resolves.
    async fn test_login(user_id: web::Path<Uuid>, session: actix_session::Session) -> HttpResponse {
        let now = Utc::now();
        crate::domain::authorization::remember(
            &session,
            models::users::User {
                id: *user_id,
                created_at: now,
                updated_at: now,
                deleted_at: None,
                upstream_id: None,
                email_domain: None,
            },
        )
        .expect("remember the user");
        HttpResponse::Ok().finish()
    }

    /// The routes under a real actix app, mounted where they are mounted in production so the path
    /// the tests send is the path a browser sends.
    macro_rules! files_app {
        () => {{
            let pool = PgPool::connect(&test_database_url()).await.expect("pool");
            let file_store: Arc<dyn FileStore> = Arc::new(temp_file_store());
            test::init_service(
                App::new()
                    .app_data(web::Data::new(pool))
                    .app_data(web::Data::from(file_store))
                    .app_data(web::Data::new(init_app_conf().expect("app conf")))
                    .app_data(web::Data::new(JwtKey::test_key()))
                    .service(
                        web::resource("/test-login/{user_id}").route(web::post().to(test_login)),
                    )
                    .service(web::scope("/api/v0/files").configure(_add_routes))
                    .wrap(
                        SessionMiddleware::builder(
                            CookieSessionStore::default(),
                            Key::from(SESSION_KEY_BYTES),
                        )
                        .cookie_secure(false)
                        .cookie_same_site(SameSite::Lax)
                        .cookie_path("/".to_string())
                        .build(),
                    ),
            )
            .await
        }};
    }

    macro_rules! login {
        ($app:expr, $user:expr) => {{
            let request = test::TestRequest::post()
                .uri(&format!("/test-login/{}", $user))
                .to_request();
            let response = test::call_service(&$app, request).await;
            assert_eq!(response.status(), StatusCode::OK);
            response
                .response()
                .cookies()
                .next()
                .expect("session cookie")
                .into_owned()
        }};
    }

    fn multipart_body(parts: &[(Uuid, &str, &str)]) -> Vec<u8> {
        let mut body = String::new();
        for (field_name, file_name, contents) in parts {
            body.push_str(&format!("--{BOUNDARY}\r\n"));
            body.push_str(&format!(
                "Content-Disposition: form-data; name=\"{field_name}\"; filename=\"{file_name}\"\r\n"
            ));
            body.push_str("Content-Type: application/octet-stream\r\n\r\n");
            body.push_str(contents);
            body.push_str("\r\n");
        }
        body.push_str(&format!("--{BOUNDARY}--\r\n"));
        body.into_bytes()
    }

    fn upload_request(
        uri: &str,
        session: Option<&Cookie<'static>>,
        parts: &[(Uuid, &str, &str)],
    ) -> test::TestRequest {
        let mut request = test::TestRequest::post()
            .uri(uri)
            .insert_header((
                "Content-Type",
                format!("multipart/form-data; boundary={BOUNDARY}"),
            ))
            .set_payload(multipart_body(parts));
        if let Some(cookie) = session {
            request = request.cookie(cookie.clone());
        }
        request
    }

    fn answer_upload_uri(exercise_task_id: Uuid) -> String {
        format!("/api/v0/files/answer-uploads/{exercise_task_id}")
    }

    #[actix_web::test]
    async fn answer_uploads_reject_anonymous_callers() {
        let app = files_app!();
        let request = upload_request(
            &answer_upload_uri(Uuid::new_v4()),
            None,
            &[(Uuid::new_v4(), "a.txt", "first")],
        )
        .to_request();

        let response = test::call_service(&app, request).await;

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn answer_uploads_to_a_missing_exercise_task_are_not_found() {
        let app = files_app!();
        let cookie = login!(app, Uuid::new_v4());
        let request = upload_request(
            &answer_upload_uri(Uuid::new_v4()),
            Some(&cookie),
            &[(Uuid::new_v4(), "a.txt", "first")],
        )
        .to_request();

        let response = test::call_service(&app, request).await;

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    /// A literal first segment must reach this handler rather than the slug route's wildcard, which
    /// would silently accept the upload without binding it to anyone.
    #[actix_web::test]
    async fn the_answer_upload_path_is_not_shadowed_by_the_slug_route() {
        let app = files_app!();
        let parts = [(Uuid::new_v4(), "a.txt", "first")];

        let bound = test::call_service(
            &app,
            upload_request(&answer_upload_uri(Uuid::new_v4()), None, &parts).to_request(),
        )
        .await;
        let by_slug = test::call_service(
            &app,
            upload_request("/api/v0/files/example-exercise", None, &parts).to_request(),
        )
        .await;

        // The slug route rejects an anonymous caller as unprocessable, this one as unauthorized.
        assert_eq!(bound.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(by_slug.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[actix_web::test]
    async fn answer_uploads_return_bound_database_ids_in_request_order() {
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, exercise: exercise, :slide, task: task);
        tx.commit().await;
        let app = files_app!();
        let cookie = login!(app, user);
        let first_field = Uuid::new_v4();
        let second_field = Uuid::new_v4();
        let request = upload_request(
            &answer_upload_uri(task),
            Some(&cookie),
            &[
                (first_field, "a.tar.zst", "first"),
                (second_field, "b.txt", "second"),
            ],
        )
        .to_request();

        let response = test::call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::OK);
        let entries: Vec<serde_json::Value> = test::read_body_json(response).await;

        let ids: Vec<Uuid> = entries
            .iter()
            .map(|entry| {
                Uuid::parse_str(entry["id"].as_str().expect("an id string")).expect("a uuid id")
            })
            .collect();
        assert_eq!(ids.len(), 2);
        assert!(!ids.contains(&first_field) && !ids.contains(&second_field));

        let mut conn = Conn::init().await;
        let mut check = conn.begin().await;
        let stored = models::file_uploads::get_many(check.as_mut(), &ids)
            .await
            .expect("file uploads");
        let names: Vec<&str> = ids
            .iter()
            .map(|id| {
                stored
                    .iter()
                    .find(|file| &file.id == id)
                    .map(|file| file.name.as_str())
                    .expect("a file upload row for every returned id")
            })
            .collect();
        assert_eq!(names, vec!["a.tar.zst", "b.txt"]);

        let bindings: Vec<(Uuid, Uuid, Uuid, String)> = sqlx::query_as(
            "SELECT file_upload_id, exercise_id, user_id, origin::text
             FROM exercise_answer_uploads
             WHERE file_upload_id = ANY($1)
               AND deleted_at IS NULL",
        )
        .bind(&ids)
        .fetch_all(&mut **check.as_mut())
        .await
        .expect("the bindings");
        assert_eq!(bindings.len(), 2);
        for (file_upload_id, exercise_id, user_id, origin) in bindings {
            assert!(ids.contains(&file_upload_id));
            assert_eq!(exercise_id, exercise);
            assert_eq!(user_id, user);
            assert_eq!(origin, "iframe");
        }
        check.rollback().await;
    }
}

#[cfg(test)]
mod claimed_file_tests {
    use super::*;
    use crate::domain::models_requests::DOWNLOAD_CLAIM_PARAM;
    use crate::test_helper::*;
    use actix_web::http::StatusCode;
    use actix_web::{App, test};
    use std::sync::Arc;

    macro_rules! claimed_files_app {
        ($file_store:expr) => {{
            let pool = PgPool::connect(&test_database_url()).await.expect("pool");
            test::init_service(
                App::new()
                    .app_data(web::Data::new(pool))
                    .app_data(web::Data::from($file_store))
                    .app_data(web::Data::new(JwtKey::test_key()))
                    .service(web::scope("/api/v0/files").configure(_add_routes)),
            )
            .await
        }};
    }

    fn claimed_uri(file_upload_id: Uuid, claim: &str) -> String {
        format!("/api/v0/files/claimed/{file_upload_id}?{DOWNLOAD_CLAIM_PARAM}={claim}")
    }

    fn claim_for(file_upload_id: Uuid) -> String {
        DownloadClaim::expiring_in_1_day(file_upload_id)
            .sign(&JwtKey::test_key())
            .expect("signing should succeed")
    }

    /// A stored object with a `file_uploads` row pointing at it.
    async fn stored_file(store: &Arc<dyn FileStore>) -> (String, Uuid) {
        let path = format!("claimed-file-tests/{}.txt", Uuid::new_v4());
        store
            .upload(Path::new(&path), b"contents".to_vec(), "text/plain")
            .await
            .expect("the stored object");
        let id = insert_file_upload(&path).await;
        (path, id)
    }

    /// Records a stored object, committing so the handler's own connection can see it.
    async fn insert_file_upload(path: &str) -> Uuid {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let id = models::file_uploads::insert(
            tx.as_mut(),
            "answer.txt",
            path,
            "text/plain",
            None,
            Some(8),
        )
        .await
        .expect("the file upload row");
        tx.commit().await;
        id
    }

    async fn soft_delete_file_upload(id: Uuid) {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        models::file_uploads::delete_and_fetch_path(tx.as_mut(), id)
            .await
            .expect("the file upload row");
        tx.commit().await;
    }

    #[actix_web::test]
    async fn a_claimed_file_redirects_to_the_store_url() {
        let store: Arc<dyn FileStore> = Arc::new(temp_file_store());
        let (path, id) = stored_file(&store).await;
        let expected_url = store
            .get_direct_download_url(Path::new(&path))
            .await
            .expect("the store url");
        let app = claimed_files_app!(Arc::clone(&store));

        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&claimed_uri(id, &claim_for(id)))
                .to_request(),
        )
        .await;

        assert_eq!(response.status(), StatusCode::FOUND);
        assert_eq!(
            response
                .headers()
                .get("location")
                .expect("a location header"),
            expected_url.as_str()
        );
    }

    /// Naming a single file is what keeps a service from reaching any other one, so a claim must
    /// not authorize the file the path names.
    #[actix_web::test]
    async fn a_claim_for_another_file_is_rejected() {
        let store: Arc<dyn FileStore> = Arc::new(temp_file_store());
        let (_path, id) = stored_file(&store).await;
        let app = claimed_files_app!(Arc::clone(&store));

        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&claimed_uri(id, &claim_for(Uuid::new_v4())))
                .to_request(),
        )
        .await;

        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[actix_web::test]
    async fn a_tampered_claim_is_rejected() {
        let store: Arc<dyn FileStore> = Arc::new(temp_file_store());
        let app = claimed_files_app!(Arc::clone(&store));
        let id = Uuid::new_v4();
        let mut claim = claim_for(id);
        claim.pop();

        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&claimed_uri(id, &claim))
                .to_request(),
        )
        .await;

        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[actix_web::test]
    async fn a_request_without_a_claim_is_rejected() {
        let store: Arc<dyn FileStore> = Arc::new(temp_file_store());
        let app = claimed_files_app!(Arc::clone(&store));

        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/v0/files/claimed/{}", Uuid::new_v4()))
                .to_request(),
        )
        .await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn a_soft_deleted_file_is_not_found() {
        let store: Arc<dyn FileStore> = Arc::new(temp_file_store());
        let (_path, id) = stored_file(&store).await;
        soft_delete_file_upload(id).await;
        let app = claimed_files_app!(Arc::clone(&store));

        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&claimed_uri(id, &claim_for(id)))
                .to_request(),
        )
        .await;

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    /// A literal first segment must reach this handler rather than the catch-all, which serves any
    /// path with no authorization at all.
    #[actix_web::test]
    async fn the_claimed_file_path_is_not_shadowed_by_the_catch_all() {
        let store: Arc<dyn FileStore> = Arc::new(temp_file_store());
        let path = format!("claimed/{}", Uuid::new_v4());
        store
            .upload(Path::new(&path), b"contents".to_vec(), "text/plain")
            .await
            .expect("the stored object");
        let app = claimed_files_app!(Arc::clone(&store));

        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/v0/files/{path}"))
                .to_request(),
        )
        .await;

        // Reaching the catch-all would redirect to the object that is really there; this handler
        // instead refuses a request carrying no claim.
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
