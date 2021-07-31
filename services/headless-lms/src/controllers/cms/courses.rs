//! Controllers for requests starting with `/api/v0/cms/courses`.

use crate::controllers::helpers::media::upload_media_for_course;
use crate::controllers::{ControllerResult, UploadResult};
use crate::domain::authorization::AuthUser;
use crate::utils::file_store::FileStore;
use crate::ApplicationConfiguration;
use actix_multipart as mp;
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use actix_web::HttpRequest;
use sqlx::PgPool;
use uuid::Uuid;

/**
POST `/api/v0/cms/courses/:course_id/upload` - Uploads a media (image, audio, file) for the course from Gutenberg page edit.

Put the the contents of the media in a form and add a content type header multipart/form-data.
# Example

Request:
```http
POST /api/v0/cms/pages/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/upload HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```

Response:
```json
{
    "url": "http://project-331.local/api/v0/files/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png"
}

```
*/
#[instrument(skip(payload, request, pool, file_store, app_conf))]
async fn add_media_for_course<T: FileStore>(
    request_course_id: web::Path<Uuid>,
    payload: mp::Multipart,
    request: HttpRequest,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<T>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;

    let media_path =
        upload_media_for_course(request.headers(), payload, &course, file_store.as_ref()).await?;
    let download_url = file_store.get_download_url(media_path.as_path(), app_conf.as_ref());

    Ok(Json(UploadResult { url: download_url }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_id}/upload",
        web::post().to(add_media_for_course::<T>),
    );
}
