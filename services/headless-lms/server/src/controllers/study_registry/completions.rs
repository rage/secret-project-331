//! Controllers for requests starting with `/api/v0/study-registry/completions`

use actix_web::http::header::ContentType;
use bytes::Bytes;

use tokio::sync::mpsc::UnboundedSender;
use tokio_stream::{wrappers::UnboundedReceiverStream, StreamExt};

use crate::{controllers::prelude::*, domain::csv_export::JsonStreamer};

#[instrument(skip(pool))]
async fn get_completions(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let course_module =
        models::course_modules::get_default_by_course_id(&mut conn, *course_id).await?;
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let res = stream_completions(&mut handle_conn, sender, course_module.id).await;
        if let Err(err) = res {
            tracing::error!("Failed to stream completions: {}", err);
        }
    });
    Ok(HttpResponse::Ok()
        .content_type(ContentType::json())
        .streaming(UnboundedReceiverStream::new(receiver)))
}

// I tired to have most of this in JsonStreamer where you pass a stream but it broke and I don't know why :(
async fn stream_completions(
    conn: &mut PgConnection,
    sender: UnboundedSender<ControllerResult<Bytes>>,
    course_module_id: Uuid,
) -> anyhow::Result<()> {
    let mut stream =
        models::course_module_completions::stream_by_course_module_id(conn, course_module_id);
    let streamer = JsonStreamer::from_sender(sender);
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
    cfg.route("/{course_id}", web::get().to(get_completions));
}
