//! Controllers for requests starting with `/api/v0/study-registry/completions`

use actix_web::http::header::ContentType;
use bytes::Bytes;

use tokio_stream::{wrappers::UnboundedReceiverStream, StreamExt};

use crate::{
    controllers::prelude::*,
    domain::csv_export::{make_authorized_streamable, JsonStreamer},
};

/**
GET `/api/v0/main-frontend/study-registry/completions/:course_id`
GET `/api/v0/main-frontend/study-registry/completions/:uh_course_code`
GET `/api/v0/main-frontend/study-registry/completions/:course_slug`

Streams completions for the given course.

This endpoint is only available to study registry authorities.

TODO: Example (can't automatically generate, see https://github.com/rage/secret-project-331/issues/834)
 */
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

    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let streamer = JsonStreamer::from_sender(sender, token);
        let res = stream_completions(&mut handle_conn, streamer, &course_modules).await;
        if let Err(err) = res {
            tracing::error!("Failed to stream completions: {}", err);
        }
    });
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .streaming(make_authorized_streamable(UnboundedReceiverStream::new(
                receiver,
            ))),
    )
}

// I tired to have most of this in JsonStreamer where you pass a stream but it broke and I don't know why :(
async fn stream_completions(
    conn: &mut PgConnection,
    streamer: JsonStreamer,
    course_module_ids: &[Uuid],
) -> anyhow::Result<()> {
    let mut stream =
        models::course_module_completions::stream_by_course_module_id(conn, course_module_ids);
    streamer.stream_array_start()?;
    if let Some(completion) = stream.try_next().await? {
        streamer.stream_object(&completion)?;
    }
    while let Some(completion) = stream.try_next().await? {
        streamer.stream_array_separator()?;
        streamer.stream_object(&completion)?;
    }
    streamer.stream_array_end()?;
    Ok(())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id_slug_or_code}", web::get().to(get_completions));
}
