use headless_lms_chatbot::azure_chatbot::events::ChatbotChatStreamEvent;
use headless_lms_chatbot::azure_chatbot::turn::{
    answer_tool_call_and_resume_stream, send_chat_request_and_parse_stream,
};
use headless_lms_chatbot::chatbot_tools::{ClientToolAnswer, ClientToolName};
use headless_lms_chatbot::conversation_context::ChatbotPageContext;
use headless_lms_chatbot::llm_utils::estimate_tokens;
use headless_lms_chatbot::user_context::ChatbotUserContext;
use headless_lms_models::application_task_default_language_models::ApplicationTask;
use headless_lms_models::chatbot_conversation_message_messages::MessageRole;
use headless_lms_models::chatbot_conversation_message_tool_calls;
use headless_lms_models::chatbot_conversations::{
    self, ChatbotConversation, ChatbotConversationInfo,
};
use headless_lms_models::{chatbot_configurations, courses};
use rand::seq::IndexedRandom;
use utoipa::{OpenApi, ToSchema};

use crate::{
    domain::{
        authentication::handle_anonymous_token,
        authorization::{AuthorizationToken, authorize_access_to_chatbot},
    },
    prelude::*,
};
use rand::distr::{Alphanumeric, SampleString};

#[derive(OpenApi)]
#[openapi(paths(
    get_default_chatbot_configuration_for_course,
    send_message,
    tool_response,
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

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct SendChatbotMessage {
    /// What the learner wrote.
    pub message: String,
    /// The course material page the learner has open, when they are on one.
    pub page_context: Option<ChatbotPageContext>,
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
    request_body = SendChatbotMessage,
    responses(
        (
            status = 200,
            description = "Chatbot response stream",
            body = ChatbotChatStreamEvent,
            content_type = "application/x-ndjson"
        )
    )
)]
// Neither the payload nor the request is recorded: the payload carries the learner's message, and
// `HttpRequest`'s Debug is a multi-line dump of every header.
#[instrument(
    skip(pool, app_conf, payload, req),
    fields(has_page_context = payload.page_context.is_some())
)]
async fn send_message(
    pool: web::Data<PgPool>,
    params: web::Path<(Uuid, Uuid)>,
    user: Option<AuthUser>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<SendChatbotMessage>,
    req: HttpRequest,
) -> ControllerResult<HttpResponse> {
    let SendChatbotMessage {
        message,
        page_context,
    } = payload.into_inner();
    let chatbot_configuration_id = params.0;
    let conversation_id = params.1;
    let mut conn = pool.acquire().await?;

    let (token, chatbot_user) = authorize_access_to_conversation(
        &mut conn,
        chatbot_configuration_id,
        conversation_id,
        user,
        req,
    )
    .await?;

    let response_stream = send_chat_request_and_parse_stream(
        // An Arc, cheap to clone.
        pool.get_ref().clone(),
        &app_conf,
        chatbot_configuration_id,
        conversation_id,
        &message,
        page_context,
        chatbot_user,
    )
    .await?;

    token.authorized_ok(
        HttpResponse::Ok()
            .content_type("application/x-ndjson")
            .streaming(response_stream),
    )
}

/// Checks that the caller may use this chatbot and that the conversation is theirs, and collects
/// the context a turn of it needs.
///
/// Every endpoint that continues a conversation has to go through here: without the ownership
/// comparison a caller could send messages into, or answer tool calls of, someone else's
/// conversation by guessing its id.
async fn authorize_access_to_conversation(
    conn: &mut PgConnection,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
    user: Option<AuthUser>,
    req: HttpRequest,
) -> Result<(AuthorizationToken, ChatbotUserContext), ControllerError> {
    let chatbot_configuration =
        chatbot_configurations::get_by_id(conn, chatbot_configuration_id).await?;

    let token =
        authorize_access_to_chatbot(conn, user.map(|u| u.id), &chatbot_configuration).await?;

    let conversation = chatbot_conversations::get_by_id(conn, conversation_id).await?;

    let anonymous_token = handle_anonymous_token(&req, user);

    if conversation.user_id != user.map(|u| u.id)
        || conversation.chatbot_configuration_id != chatbot_configuration_id
        || conversation.course_id != chatbot_configuration.course_id
        || conversation.anonymous_token != anonymous_token
    {
        return Err(controller_err!(
            Forbidden,
            "Conversation does not belong to the authenticated user and chatbot configuration"
                .to_string()
        ));
    }

    let course_name = if let Some(course_id) = chatbot_configuration.course_id {
        Some(courses::get_course(conn, course_id).await?.name)
    } else {
        None
    };

    let chatbot_user = ChatbotUserContext::new(
        user.map(|u| u.id),
        chatbot_configuration.course_id,
        course_name,
        conversation_id,
    );

    Ok((token, chatbot_user))
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ChatbotToolResponse {
    /// The call being answered, as its `tool_call_id` arrived in the `ToolCall` stream event.
    pub tool_call_id: String,
    /// The tool the caller believes `tool_call_id` belongs to, checked against the call's
    /// recorded name so a client answering the wrong bubble fails clearly instead of being
    /// silently accepted as whatever tool the call actually was.
    pub tool_name: ClientToolName,
    pub answer: ClientToolAnswer,
}

/**
POST `/api/v0/course-material/chatbot/:chatbot_configuration_id/conversations/:conversation_id/tool-response`

Answers a tool call the chatbot suspended its turn on, which resumes the turn once nothing else
is outstanding. Responds with the same stream `send-message` does, carrying either the resumed
turn or a lone `Suspended` event when the turn is still waiting for another answer.
*/
#[utoipa::path(
    post,
    path = "/{chatbot_configuration_id}/conversations/{conversation_id}/tool-response",
    operation_id = "sendChatbotToolResponse",
    tag = "course-material-chatbot",
    params(
        ("chatbot_configuration_id" = Uuid, Path, description = "Chatbot configuration id"),
        ("conversation_id" = Uuid, Path, description = "Conversation id")
    ),
    request_body = ChatbotToolResponse,
    responses(
        (
            status = 200,
            description = "Chatbot response stream",
            body = ChatbotChatStreamEvent,
            content_type = "application/x-ndjson"
        )
    )
)]
// Neither the payload nor the request is recorded: the answer can carry what the learner wrote,
// and `HttpRequest`'s Debug prints every header, including the anonymous chatbot bearer token that
// `handle_anonymous_token` reads.
#[instrument(skip(pool, app_conf, payload, req))]
async fn tool_response(
    pool: web::Data<PgPool>,
    params: web::Path<(Uuid, Uuid)>,
    user: Option<AuthUser>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<ChatbotToolResponse>,
    req: HttpRequest,
) -> ControllerResult<HttpResponse> {
    let ChatbotToolResponse {
        tool_call_id,
        tool_name,
        answer,
    } = payload.into_inner();
    let chatbot_configuration_id = params.0;
    let conversation_id = params.1;
    let mut conn = pool.acquire().await?;

    let (token, chatbot_user) = authorize_access_to_conversation(
        &mut conn,
        chatbot_configuration_id,
        conversation_id,
        user,
        req,
    )
    .await?;

    let recorded_call =
        chatbot_conversation_message_tool_calls::get_by_conversation_and_tool_call_id(
            &mut conn,
            conversation_id,
            &tool_call_id,
        )
        .await?;
    if recorded_call.is_none_or(|call| call.tool_name != tool_name.as_str()) {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "tool_name does not match the tool call being answered".to_string(),
            None,
        ));
    }

    let response_stream = answer_tool_call_and_resume_stream(
        // An Arc, cheap to clone.
        pool.get_ref().clone(),
        &app_conf,
        chatbot_configuration_id,
        conversation_id,
        &tool_call_id,
        &answer,
        chatbot_user,
    )
    .await?;

    token.authorized_ok(
        HttpResponse::Ok()
            .content_type("application/x-ndjson")
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
    user: Option<AuthUser>,
    params: web::Path<Uuid>,
) -> ControllerResult<web::Json<ChatbotConversation>> {
    let mut conn = pool.acquire().await?;

    let configuration = models::chatbot_configurations::get_by_id(&mut conn, *params).await?;

    let token = authorize_access_to_chatbot(&mut conn, user.map(|u| u.id), &configuration).await?;

    let anonymous_token = if let Some(_user) = user {
        None
    } else {
        Some(Alphanumeric.sample_string(&mut rand::rng(), 128))
    };

    let conversation = models::chatbot_conversations::create_for_user_and_configuration(
        &mut conn,
        PKeyPolicy::Generate,
        user.map(|u| u.id),
        anonymous_token.as_ref().map(|a| a.to_owned()),
        configuration.id,
    )
    .await?;

    let _first_message =
        models::chatbot_conversation_messages::insert_for_conversation_user_and_configuration(
            &mut conn,
            models::chatbot_conversation_messages::ChatbotConversationMessage::text(
                conversation.id,
                MessageRole::Assistant,
                configuration.initial_message.clone(),
                estimate_tokens(&configuration.initial_message),
                Some("initial-message".to_string()),
            ),
            user.map(|u| u.id),
            anonymous_token,
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
#[instrument(skip(pool, app_conf, req))]
async fn current_conversation_info(
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    app_conf: web::Data<ApplicationConfiguration>,
    params: web::Path<Uuid>,
    req: HttpRequest,
) -> ControllerResult<web::Json<ChatbotConversationInfo>> {
    let mut conn = pool.acquire().await?;
    let chatbot_configuration =
        models::chatbot_configurations::get_by_id(&mut conn, *params).await?;

    let token =
        authorize_access_to_chatbot(&mut conn, user.map(|u| u.id), &chatbot_configuration).await?;

    let anonymous_token = handle_anonymous_token(&req, user);

    let res = chatbot_conversations::get_current_conversation_info(
        &mut conn,
        user.map(|u| u.id),
        anonymous_token.as_ref().map(|a| a.to_owned()),
        chatbot_configuration.id,
    )
    .await?;

    // A None means no suggestion belongs here at all, which includes a turn suspended on a question
    // to the learner, so the generation below is skipped for those without a check of its own.
    if chatbot_configuration.suggest_next_messages
        && let Some(suggested_messages) = &res.suggested_messages
        && suggested_messages.is_empty()
        && let Some(current_conversation_messages) = &res.current_conversation_messages
        && let Some(last_message) = current_conversation_messages.last()
        && let Some(course_name) = &res.course_name
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
            let course_description = if let Some(course_id) = chatbot_configuration.course_id {
                models::courses::get_course(&mut conn, course_id)
                    .await?
                    .description
            } else {
                None
            };
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
                course_name,
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
            user.map(|u| u.id),
            anonymous_token,
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
        "/{chatbot_configuration_id}/conversations/{conversation_id}/tool-response",
        web::post().to(tool_response),
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
