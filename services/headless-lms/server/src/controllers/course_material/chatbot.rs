use actix_web::http::header::ContentType;
use chrono::Utc;

use headless_lms_chatbot::azure_chatbot::{estimate_tokens, send_chat_request_and_parse_stream};
use headless_lms_models::chatbot_conversations::{
    self, ChatbotConversation, ChatbotConversationInfo,
};

use crate::prelude::*;

/**
GET `/api/v0/course-material/course-modules/chatbot/for-course/:course-id`

Returns one chatbot configuration id for a course that students can use.
*/
#[instrument(skip(pool))]
async fn get_chatbot_configuration_for_course(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Option<Uuid>>> {
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    let chatbot_configurations =
        models::chatbot_configurations::get_for_course(&mut conn, *course_id).await?;

    let res = chatbot_configurations
        .into_iter()
        .find(|c| c.enabled_to_students)
        .map(|c| c.id);

    token.authorized_ok(web::Json(res))
}

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

    let response_stream = send_chat_request_and_parse_stream(
        &mut tx,
        // An Arc, cheap to clone.
        pool.get_ref().clone(),
        &app_conf,
        chatbot_configuration_id,
        conversation_id,
        &message,
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
            order_number: 0,
        },
    )
    .await?;

    tx.commit().await?;

    token.authorized_ok(web::Json(conversation))
}

/**
POST `/api/v0/course-material/course-modules/chatbot/:chatbot_configuration_id/conversations/current`

Returns the current conversation for the user.
*/
#[instrument(skip(pool))]
async fn current_conversation_info(
    pool: web::Data<PgPool>,
    user: AuthUser,
    params: web::Path<Uuid>,
) -> ControllerResult<web::Json<ChatbotConversationInfo>> {
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    let chatbot_configuration =
        models::chatbot_configurations::get_by_id(&mut conn, *params).await?;
    let res = chatbot_conversations::get_current_conversation_info(
        &mut conn,
        user.id,
        chatbot_configuration.id,
    )
    .await?;

    token.authorized_ok(web::Json(res))
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
        "/{chatbot_configuration_id}/conversations/current",
        web::get().to(current_conversation_info),
    )
    .route(
        "/{chatbot_configuration_id}/conversations/new",
        web::post().to(new_conversation),
    )
    .route(
        "/for-course/{course_id}",
        web::get().to(get_chatbot_configuration_for_course),
    );
}
