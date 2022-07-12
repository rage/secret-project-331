//! Controllers for requests starting with `/api/v0/study-registry/completion-registered-to-study-registry`
//!
//! The study registry provides an access to student completion records. It is generally only available
//! to authorized study registries, meaning that most endpoints will require a valid authorization token
//! to access.
//!
//! When accessing study registry, the authorization token should be given as the following header:
//! ```http
//! Authorization: Basic documentationOnlyExampleSecretKey-12345
//! ```
//!
//! For more details, please view the individual functions.

use models::course_module_completion_registered_to_study_registries::RegisteredCompletion;

use crate::controllers::prelude::*;

/**
POST `/api/v0/completion-registered-to-study-registry` - Posts an array of registered completions to be
marked as registered.

This endpoint is only available to authorized study registries, and requires a valid authorization token
to access.

# Example request:

```http
POST /api/v0/completion-registered-to-study-registry HTTP/1.1
Authorization: Basic documentationOnlyExampleSecretKey-12345
Content-Type: application/json

[
  {
    "completion_id": "d8e0e1b3-af5f-412d-86e4-0ec51966ecdd",
    "student_number": "012345678",
    "registration_date": "2022-06-21T00:00:00Z"
  }
]
```
*/
#[instrument(skip(req, pool))]
async fn post_completions(
    req: HttpRequest,
    payload: web::Json<Vec<RegisteredCompletion>>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let secret_key = parse_secret_key_from_header(&req)?;
    let token = authorize(
        &mut conn,
        Act::View,
        None,
        Res::StudyRegistry(secret_key.to_string()),
    )
    .await?;
    let registrar =
        models::study_registry_registrars::get_by_secret_key(&mut conn, secret_key).await?;
    models::course_module_completion_registered_to_study_registries::insert_completions(
        &mut conn,
        payload.0,
        registrar.id,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
#[doc(hidden)]
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_completions));
}
