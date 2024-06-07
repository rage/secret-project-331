use actix_web::http::header::ContentType;
use domain::chatbot::{send_chat_request_and_parse_stream, ChatMessage, ChatRequest};

use crate::prelude::*;

/**
POST `/api/v0/course-material/course-modules/chatbot/send-message`

Sends a new chat message to the chatbot.
*/
#[instrument(skip(pool, app_conf))]
async fn send_message(
    pool: web::Data<PgPool>,
    // user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let chat_request = ChatRequest {
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }],
        temperature: 0.7,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        max_tokens: 1000,
        stop: None,
        stream: true,
    };
    let response_stream = send_chat_request_and_parse_stream(&chat_request, &app_conf).await?;
    let token = skip_authorize();
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .streaming(response_stream),
    )
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/send-message", web::post().to(send_message));
}
