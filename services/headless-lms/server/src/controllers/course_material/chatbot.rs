use actix_web::http::header::ContentType;
use chrono::Utc;
use domain::chatbot::{send_chat_request_and_parse_stream, ChatMessage, ChatRequest};
use headless_lms_models::chatbot_conversations::ChatbotConversation;

use crate::prelude::*;

/**
POST `/api/v0/course-material/chatbot/:chatbot_configuration_id/conversations/:conversation_id/send-message`

Sends a new chat message to the chatbot.
*/
#[instrument(skip(pool, app_conf))]
async fn send_message(
    pool: web::Data<PgPool>,
    params: web::Path<(Uuid, Uuid)>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut messages = Vec::new();

    let chat_request = ChatRequest {
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "Hello, how do I program a for loop in Haskell?".to_string(),
        }],
        temperature: 0.7,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        max_tokens: 100,
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
POST `/api/v0/course-material/course-modules/chatbot/:chatbot_configuration_id/conversations/new`

Sends a new chat message to the chatbot.
*/
#[instrument(skip(pool))]
async fn new_conversation(
    pool: web::Data<PgPool>,
    user: AuthUser,
    params: web::Path<Uuid>,
) -> ControllerResult<web::Json<ChatbotConversation>> {
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;

    let configuration = models::chatbot_configurations::get_by_id(&mut tx, *params).await?;

    let conversation = models::chatbot_conversations::insert(
        &mut tx,
        ChatbotConversation {
            id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            course_id: configuration.course_id,
            user_id: user.id,
            chatbot_configuration_id: configuration.id,
        },
    )
    .await?;

    tx.commit().await?;

    token.authorized_ok(web::Json(conversation))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{chatbot_configuration_id}/conversations/{conversation_id}/send-message",
        web::post().to(send_message),
    )
    .route(
        "/course-modules/chatbot/{chatbot_configuration_id}/conversations/new",
        web::post().to(new_conversation),
    );
}
