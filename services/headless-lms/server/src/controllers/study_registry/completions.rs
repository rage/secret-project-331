//! Controllers for requests starting with `/api/v0/study-registry/completions`
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

use actix_web::http::header::ContentType;
use bytes::Bytes;

use futures::{future, StreamExt};
use models::course_modules::CourseModule;
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::{
    controllers::prelude::*,
    domain::csv_export::{
        make_authorized_streamable, serializable_sqlx_result_stream_to_json_stream,
    },
};

/**
GET `/api/v0/study-registry/completions/:course_id`

GET `/api/v0/study-registry/completions/:uh_course_code`

GET `/api/v0/study-registry/completions/:course_slug`

Gets all course completions for a given course. The course identifier can either be its University of
Helsinki course code, or a system-local slug or hash id.

This endpoint is only available to authorized study registries, and requires a valid authorization token
to access. Results are also streamed rather than included in the response body. In case of an error
during transmission, an error message will be appended to the end of the broken stream output.

This endpoints returns an array of [StudyRegistryCompletion](models::course_module_completions::StudyRegistryCompletion) structs.

# Example requests

Using University of Helsinki course code:
```http
GET /api/v0/study-registry/completions/BSCS1001 HTTP/1.1
Authorization: Basic documentationOnlyExampleSecretKey-12345
```

Using course slug:
```http
GET /api/v0/study-registry/completions/introduction-to-programming HTTP/1.1
Authorization: Basic documentationOnlyExampleSecretKey-12345
```

Using course id:
```http
GET /api/v0/study-registry/completions/b3e9575b-fa13-492c-bd14-10cb27df4eec HTTP/1.1
Authorization: Basic documentationOnlyExampleSecretKey-12345
```
*/
#[cfg_attr(doc, doc = generated_docs!(Vec<StudyRegistryCompletion>))]
#[instrument(skip(req, pool))]
async fn get_completions(
    req: HttpRequest,
    course_id_slug_or_code: web::Path<String>,
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

    // Try to parse the param as UUID to know whether the completions should be from a distinct or
    // multiple modules.
    let course_modules = if let Ok(course_id) = Uuid::parse_str(&course_id_slug_or_code) {
        let module = models::course_modules::get_default_by_course_id(&mut conn, course_id).await?;
        vec![module.id]
    } else {
        // The param is either a course slug or non-unique UH course code.
        models::course_modules::get_ids_by_course_slug_or_uh_course_code(
            &mut conn,
            course_id_slug_or_code.as_str(),
        )
        .await?
    };

    // Duplicated below but `spawn` requires static lifetime.
    // TODO: Create a macro instead.
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let stream = models::course_module_completions::stream_by_course_module_id(
            &mut handle_conn,
            &course_modules,
        );
        let fut = serializable_sqlx_result_stream_to_json_stream(stream).for_each(|message| {
            let token = skip_authorize().expect("Always succeeds");
            let message = match message {
                Ok(message) => message,
                Err(err) => {
                    error!("Error received from sqlx result stream: {}", err);
                    Bytes::from(format!("Streaming error. Details: {:?}", err))
                }
            };
            if let Err(err) = sender.send(token.authorized_ok(message)) {
                error!("Failed to send data to UnboundedReceiver: {}", err);
            }
            future::ready(())
        });
        fut.await;
    });
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .streaming(make_authorized_streamable(UnboundedReceiverStream::new(
                receiver,
            ))),
    )
}

/**
GET `/api/v0/study-registry/completions/:course_id/:course_module_id`

GET `/api/v0/study-registry/completions/:uh_course_code/:course_module_id`

GET `/api/v0/study-registry/completions/:course_slug/:course_module_id`

Gets all course completions for a submodule of a given course. The course identifier can either be its
University of Helsinki course code, or a system-local slug or hash id. For module identifier,
only the hash id is supported.

This endpoint is only available to authorized study registries, and requires a valid authorization token
to access. Results are also streamed rather than included in the response body. In case of an error
during transmission, an error message will be appended to the end of the broken stream output.

This endpoints returns an array of [StudyRegistryCompletion](models::course_module_completions::StudyRegistryCompletion) structs.

# Example requests

Using University of Helsinki course code:
```http
GET /api/v0/study-registry/completions/BSCS1001 HTTP/1.1
Authorization: Basic documentationOnlyExampleSecretKey-12345
Content-Type: application/json
```

Using course slug:
```http
GET /api/v0/study-registry/completions/introduction-to-programming HTTP/1.1
Authorization: Basic documentationOnlyExampleSecretKey-12345
Content-Type: application/json
```

Using course id:
```http
GET /api/v0/study-registry/completions/b3e9575b-fa13-492c-bd14-10cb27df4eec HTTP/1.1
Authorization: Basic documentationOnlyExampleSecretKey-12345
Content-Type: application/json
```
*/
#[cfg_attr(doc, doc = generated_docs!(Vec<StudyRegistryCompletion>))]
#[instrument(skip(req, pool))]
async fn get_module_completions(
    req: HttpRequest,
    path: web::Path<(String, Uuid)>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let (course_id_slug_or_code, module_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let secret_key = parse_secret_key_from_header(&req)?;
    let token = authorize(
        &mut conn,
        Act::View,
        None,
        Res::StudyRegistry(secret_key.to_string()),
    )
    .await?;

    let module = models::course_modules::get_by_id(&mut conn, module_id).await?;
    if !module_belongs_to_course(&mut conn, &module, &course_id_slug_or_code).await? {
        return Err(ControllerError::NotFound(
            "No such module in a given course.".to_string(),
        ));
    }

    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let modules = vec![module.id];
        let stream = models::course_module_completions::stream_by_course_module_id(
            &mut handle_conn,
            &modules,
        );
        let fut = serializable_sqlx_result_stream_to_json_stream(stream).for_each(|message| {
            let token = skip_authorize().expect("Always succeeds");
            let message = match message {
                Ok(message) => message,
                Err(err) => {
                    error!("Error received from sqlx result stream: {}", err);
                    Bytes::from(format!("Streaming error. Details: {:?}", err))
                }
            };
            if let Err(err) = sender.send(token.authorized_ok(message)) {
                error!("Failed to send data to UnboundedReceiver: {}", err);
            }
            future::ready(())
        });
        fut.await;
    });
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .streaming(make_authorized_streamable(UnboundedReceiverStream::new(
                receiver,
            ))),
    )
}

#[doc(hidden)]
async fn module_belongs_to_course(
    conn: &mut PgConnection,
    module: &CourseModule,
    course_id_slug_or_code: &str,
) -> anyhow::Result<bool> {
    if module.uh_course_code.as_deref() == Some(course_id_slug_or_code) {
        Ok(true)
    } else if let Ok(course_id) = Uuid::parse_str(course_id_slug_or_code) {
        Ok(module.course_id == course_id)
    } else {
        let course = models::courses::get_course_by_slug(conn, course_id_slug_or_code).await?;
        Ok(module.course_id == course.id)
    }
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
#[doc(hidden)]
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id_slug_or_code}", web::get().to(get_completions))
        .route(
            "/{course_id_slug_or_code}/{module_id}",
            web::get().to(get_module_completions),
        );
}
