use actix_web::http::header::ContentType;
use chrono::Utc;
use domain::chatbot::{
    self, estimate_tokens, send_chat_request_and_parse_stream, ApiChatMessage, ChatRequest,
};
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
    payload: web::Json<String>,
) -> ControllerResult<HttpResponse> {
    let message = payload.into_inner();
    let chatbot_configuration_id = params.0;
    let conversation_id = params.1;
    let mut conn = pool.acquire().await?;
    let mut tx: sqlx::Transaction<Postgres> = conn.begin().await?;
    let token = skip_authorize();

    let configuration =
        models::chatbot_configurations::get_by_id(&mut tx, chatbot_configuration_id).await?;
    let _new_message = models::chatbot_conversation_messages::insert(
        &mut tx,
        models::chatbot_conversation_messages::ChatbotConversationMessage {
            id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            conversation_id: conversation_id,
            message: Some(message.clone()),
            is_from_chatbot: false,
            message_is_complete: true,
            used_tokens: estimate_tokens(&message),
        },
    )
    .await?;
    let mut conversation_messages: Vec<ApiChatMessage> =
        models::chatbot_conversation_messages::get_by_conversation_id(&mut *tx, conversation_id)
            .await?
            .into_iter()
            .map(Into::into)
            .collect();

    conversation_messages.insert(
        0,
        ApiChatMessage {
            role: "system".to_string(),
            content: configuration.prompt.clone(),
        },
    );

    let chat_request = ChatRequest {
        messages: conversation_messages,
        temperature: 0.7,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        max_tokens: 100,
        stop: None,
        stream: true,
    };

    let response_stream = send_chat_request_and_parse_stream(
        &mut tx,
        // An Arc, cheap to clone.
        pool.clone(),
        &chat_request,
        &app_conf,
        conversation_id,
    )
    .await?;

    tx.commit().await?;

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

    let _first_message = models::chatbot_conversation_messages::insert(
        &mut tx,
        models::chatbot_conversation_messages::ChatbotConversationMessage {
            id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            conversation_id: conversation.id,
            message: Some(configuration.initial_message.clone()),
            is_from_chatbot: true,
            message_is_complete: true,
            used_tokens: estimate_tokens(&configuration.initial_message),
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
        "/{chatbot_configuration_id}/conversations/new",
        web::post().to(new_conversation),
    );
}
