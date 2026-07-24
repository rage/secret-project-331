use actix_web::http::header::ContentType;
use chrono::Utc;

use headless_lms_chatbot::azure_chatbot::{
    ChatbotChatStreamEvent, ChatbotUserContext, send_chat_request_and_parse_stream,
};
use headless_lms_chatbot::llm_utils::estimate_tokens;
use headless_lms_models::application_task_default_language_models::ApplicationTask;
use headless_lms_models::chatbot_conversation_message_messages::{
    ChatbotConversationMessageMessage, MessageRole,
};
use headless_lms_models::chatbot_conversation_messages::Message;
use headless_lms_models::chatbot_conversations::{
    self, ChatbotConversation, ChatbotConversationInfo,
};
use headless_lms_models::{chatbot_configurations, courses};
use rand::seq::IndexedRandom;
use utoipa::OpenApi;

use crate::{domain::authorization::authorize_access_to_course_material, prelude::*};

#[derive(OpenApi)]
#[openapi(paths(
    get_default_chatbot_configuration_for_course,
    send_message,
    new_conversation,
    current_conversation_info
))]
pub(crate) struct CourseMaterialChatbotApiDoc;

/**
GET `/api/v0/course-material/course-modules/chatbot/default-for-course/:course-id`

Returns the default chatbot configuration id for a course if the default chatbot is enabled to students.
*/
#[utoipa::path(
    get,
    path = "/default-for-course/{course_id}",
    operation_id = "getDefaultChatbotConfigurationForCourse",
    tag = "course-material-chatbot",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Default chatbot configuration id", body = Option<Uuid>)
    )
)]
#[instrument(skip(pool))]
async fn get_default_chatbot_configuration_for_course(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Option<Uuid>>> {
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    let chatbot_configurations =
        models::chatbot_configurations::get_for_course(&mut conn, *course_id).await?;

    let res = chatbot_configurations
        .into_iter()
        .filter(|c| c.enabled_to_students)
        .find(|c| c.default_chatbot)
        .map(|c| c.id);

    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/course-material/chatbot/:chatbot_configuration_id/conversations/:conversation_id/send-message`

Sends a new chat message to the chatbot.
*/
#[utoipa::path(
    post,
    path = "/{chatbot_configuration_id}/conversations/{conversation_id}/send-message",
    operation_id = "sendChatbotMessage",
    tag = "course-material-chatbot",
    params(
        ("chatbot_configuration_id" = Uuid, Path, description = "Chatbot configuration id"),
        ("conversation_id" = Uuid, Path, description = "Conversation id")
    ),
    request_body(
        content = String,
        content_type = "application/json"
    ),
    responses(
        (
            status = 200,
            description = "Chatbot response stream",
            body = ChatbotChatStreamEvent,
            content_type = "text/event-stream"
        )
    )
)]
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
    let chatbot_configuration =
        chatbot_configurations::get_by_id(&mut conn, chatbot_configuration_id).await?;
    let token = authorize_access_to_course_material(
        &mut conn,
        Some(user.id),
        chatbot_configuration.course_id,
    )
    .await?;
    let conversation = chatbot_conversations::get_by_id(&mut conn, conversation_id).await?;
    if conversation.user_id != user.id
        || conversation.chatbot_configuration_id != chatbot_configuration_id
        || conversation.course_id != chatbot_configuration.course_id
    {
        return Err(controller_err!(
            Forbidden,
            "Conversation does not belong to the authenticated user and chatbot configuration"
                .to_string()
        ));
    }

    let course_name = courses::get_course(&mut conn, chatbot_configuration.course_id)
        .await?
        .name;
    let chatbot_user = ChatbotUserContext {
        user_id: Some(user.id.to_owned()),
        course_id: Some(chatbot_configuration.course_id),
        course_name: Some(course_name),
    };

    let response_stream = send_chat_request_and_parse_stream(
        // An Arc, cheap to clone.
        pool.get_ref().clone(),
        &app_conf,
        chatbot_configuration_id,
        conversation_id,
        &message,
        chatbot_user,
    )
    .await?;

    token.authorized_ok(
        HttpResponse::Ok()
            .content_type(ContentType(mime::TEXT_EVENT_STREAM))
            .streaming(response_stream),
    )
}

/**
POST `/api/v0/course-material/course-modules/chatbot/:chatbot_configuration_id/conversations/new`

Sends a new chat message to the chatbot.
*/
#[utoipa::path(
    post,
    path = "/{chatbot_configuration_id}/conversations/new",
    operation_id = "newChatbotConversation",
    tag = "course-material-chatbot",
    params(
        ("chatbot_configuration_id" = Uuid, Path, description = "Chatbot configuration id")
    ),
    responses(
        (status = 200, description = "Created chatbot conversation", body = ChatbotConversation)
    )
)]
#[instrument(skip(pool))]
async fn new_conversation(
    pool: web::Data<PgPool>,
    user: AuthUser,
    params: web::Path<Uuid>,
) -> ControllerResult<web::Json<ChatbotConversation>> {
    let mut conn = pool.acquire().await?;

    let configuration = models::chatbot_configurations::get_by_id(&mut conn, *params).await?;
    let token =
        authorize_access_to_course_material(&mut conn, Some(user.id), configuration.course_id)
            .await?;

    let conversation = models::chatbot_conversations::create_for_user_and_configuration(
        &mut conn,
        PKeyPolicy::Generate,
        user.id,
        configuration.id,
    )
    .await?;

    let _first_message =
        models::chatbot_conversation_messages::insert_for_conversation_user_and_configuration(
            &mut conn,
            models::chatbot_conversation_messages::ChatbotConversationMessage {
                id: Uuid::new_v4(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                conversation_id: conversation.id,
                order_number: 0,
                message: Message::Text(ChatbotConversationMessageMessage {
                    text: configuration.initial_message.clone(),
                    message_role: MessageRole::Assistant,
                    message_is_complete: true,
                    used_tokens: estimate_tokens(&configuration.initial_message),
                    response_id: Some("initial-message".to_string()),
                    ..Default::default()
                }),
            },
            user.id,
            configuration.id,
        )
        .await?;

    token.authorized_ok(web::Json(conversation))
}

/**
POST `/api/v0/course-material/course-modules/chatbot/:chatbot_configuration_id/conversations/current`

Returns the current conversation for the user.
*/
#[utoipa::path(
    get,
    path = "/{chatbot_configuration_id}/conversations/current",
    operation_id = "getChatbotCurrentConversationInfo",
    tag = "course-material-chatbot",
    params(
        ("chatbot_configuration_id" = Uuid, Path, description = "Chatbot configuration id")
    ),
    responses(
        (
            status = 200,
            description = "Current chatbot conversation info",
            body = ChatbotConversationInfo
        )
    )
)]
#[instrument(skip(pool, app_conf))]
async fn current_conversation_info(
    pool: web::Data<PgPool>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
    params: web::Path<Uuid>,
) -> ControllerResult<web::Json<ChatbotConversationInfo>> {
    let mut conn = pool.acquire().await?;
    let chatbot_configuration =
        models::chatbot_configurations::get_by_id(&mut conn, *params).await?;
    let token = authorize_access_to_course_material(
        &mut conn,
        Some(user.id),
        chatbot_configuration.course_id,
    )
    .await?;
    let res = chatbot_conversations::get_current_conversation_info(
        &mut conn,
        user.id,
        chatbot_configuration.id,
    )
    .await?;

    if chatbot_configuration.suggest_next_messages
        // suggested_messages is None if suggest_next_messages=false
        && let Some(suggested_messages) = &res.suggested_messages
        && suggested_messages.is_empty()
        && let Some(current_conversation_messages) = &res.current_conversation_messages
        && let Some(last_message) = current_conversation_messages.last()
    {
        let initial_suggested_messages = if last_message.order_number == 1 {
            // for the first message, get initial_suggested_messages
            let initial_suggested_messages = chatbot_configuration
                .initial_suggested_messages
                .unwrap_or(vec![]);
            // take 3 random elements
            if initial_suggested_messages.len() > 3 {
                let mut rng = rand::rng();
                initial_suggested_messages
                    .sample(&mut rng, 3)
                    .cloned()
                    .collect()
            } else {
                initial_suggested_messages
            }
        } else {
            // for other messages, generate suggested messages
            let course_description =
                models::courses::get_course(&mut conn, chatbot_configuration.course_id)
                    .await?
                    .description;
            let message_suggest_llm =
                models::application_task_default_language_models::get_for_task(
                    &mut conn,
                    ApplicationTask::MessageSuggestion,
                )
                .await?;
            headless_lms_chatbot::message_suggestion::generate_suggested_messages(
                &app_conf,
                message_suggest_llm,
                current_conversation_messages,
                chatbot_configuration.initial_suggested_messages,
                &res.course_name,
                course_description,
            )
            .await?
        };

        if !initial_suggested_messages.is_empty() {
            headless_lms_models::chatbot_conversation_suggested_messages::insert_batch(
                &mut conn,
                &last_message.id,
                initial_suggested_messages,
            )
            .await?;
        }

        let res = chatbot_conversations::get_current_conversation_info(
            &mut conn,
            user.id,
            chatbot_configuration.id,
        )
        .await?;
        return token.authorized_ok(web::Json(res));
    }

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
        "/default-for-course/{course_id}",
        web::get().to(get_default_chatbot_configuration_for_course),
    );
}
