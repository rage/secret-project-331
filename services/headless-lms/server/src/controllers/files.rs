/*!
Handlers for HTTP requests to `/api/v0/files`.

*/
use super::helpers::file_uploading;
pub use crate::domain::{authorization::AuthorizationToken, models_requests::UploadClaim};
use crate::prelude::*;
use actix_files::NamedFile;
use std::{collections::HashMap, path::Path};
use tokio::fs::read;
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
    let path = base_folder.join(relative_path);

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
    let token = skip_authorize()?;
    token.authorized_ok(response.body(contents))
}

/**
POST `/api/v0/files/:exercise_service_slug`
Used to upload data from exercise service iframes.

# Returns
The randomly generated paths to each uploaded file in a `file_name => file_path` hash map.
*/
#[instrument(skip(payload, file_store, upload_claim, app_conf))]
#[generated_doc]
async fn upload_from_exercise_service(
    pool: web::Data<PgPool>,
    exercise_service_slug: web::Path<String>,
    payload: Multipart,
    file_store: web::Data<dyn FileStore>,
    user: Option<AuthUser>,
    upload_claim: Result<UploadClaim<'static>, ControllerError>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<HashMap<String, String>>> {
    let mut conn = pool.acquire().await?;
    // accessed from exercise services, can't authenticate using login,
    // the upload claim is used to verify requests instead
    let token = skip_authorize()?;

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
                ))
            }
        }
    }

    let mut paths = HashMap::new();
    if let Err(outer_err) = file_uploading::process_exercise_service_upload(
        &mut conn,
        exercise_service_slug.as_str(),
        payload,
        file_store.as_ref(),
        &mut paths,
        user.as_ref(),
        &app_conf.base_url,
    )
    .await
    {
        // something went wrong while uploading the files, try to delete leftovers
        for path in paths.values() {
            if let Err(err) = file_store.delete(Path::new(path)).await {
                error!("Failed to delete file '{path}' during cleanup: {err}")
            }
        }
        return Err(outer_err);
    }

    token.authorized_ok(web::Json(paths))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/uploads/{tail:.*}", web::get().to(serve_upload))
        .route(
            "/{exercise_service_slug}",
            web::post().to(upload_from_exercise_service),
        )
        .route("{tail:.*}", web::get().to(redirect_to_storage_service));
}
