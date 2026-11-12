/*!
Handlers for HTTP requests to `/api/v0/main-frontend/course-plans/{plan_id}/assistant`: the course
design assistant chatbot on plan pages.
*/

use headless_lms_chatbot::azure_chatbot::events::ChatbotChatStreamEvent;
use headless_lms_chatbot::azure_chatbot::turn::{
    answer_tool_call_and_resume_stream, send_chat_request_and_parse_stream,
};
use headless_lms_chatbot::llm_utils::estimate_tokens;
use headless_lms_chatbot::user_context::ChatbotTurnContext;
use headless_lms_models::chatbot_conversations::{
    self, ChatbotConversation, ChatbotConversationInfo,
};
use headless_lms_models::course_designer_plans::CourseDesignerPlan;
use headless_lms_utils::cache::Cache;
use utoipa::{OpenApi, ToSchema};

use crate::controllers::course_material::chatbot::{
    ChatbotToolResponse, verify_answered_tool_name,
};
use crate::domain::authorization::AuthorizationToken;
use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(
    get_assistant_status,
    post_new_conversation,
    get_current_conversation,
    get_conversation_info,
    post_send_message,
    post_tool_response
))]
pub(crate) struct MainFrontendCourseDesignerAssistantApiDoc;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct CourseDesignerAssistantStatus {
    /// Whether the chatbot backend is configured and a chatbot has been chosen as the assistant.
    pub available: bool,
    /// Whether the assistant belongs to a guide course, so answers can cite guide pages. When
    /// false the assistant answers from the plan and general knowledge only.
    pub has_guide_course: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SendCourseDesignerAssistantMessage {
    pub message: String,
}

/**
GET `/api/v0/main-frontend/course-plans/{plan_id}/assistant`

Whether the assistant can be offered on this plan's pages.
*/
#[utoipa::path(
    get,
    path = "",
    operation_id = "getCourseDesignerAssistantStatus",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Assistant status", body = CourseDesignerAssistantStatus))
)]
#[instrument(skip(pool, app_conf))]
async fn get_assistant_status(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<CourseDesignerAssistantStatus>> {
    let mut conn = pool.acquire().await?;
    let (token, _plan) = authorize_plan_member(&mut conn, *plan_id, user.id).await?;
    let assistant =
        models::chatbot_configurations::get_course_designer_assistant(&mut conn).await?;
    let is_backend_configured = app_conf
        .azure_configuration
        .as_ref()
        .is_some_and(|azure| azure.chatbot_config.is_some());
    token.authorized_ok(web::Json(CourseDesignerAssistantStatus {
        available: is_backend_configured && assistant.is_some(),
        has_guide_course: assistant.is_some_and(|c| c.course_id.is_some()),
    }))
}

/**
POST `/api/v0/main-frontend/course-plans/{plan_id}/assistant/conversations/new`

Starts a new conversation about the plan, which becomes the user's current one.
*/
#[utoipa::path(
    post,
    path = "/conversations/new",
    operation_id = "newCourseDesignerAssistantConversation",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Created conversation", body = ChatbotConversation))
)]
#[instrument(skip(pool))]
async fn post_new_conversation(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConversation>> {
    let mut conn = pool.acquire().await?;
    let (token, _plan) = authorize_plan_member(&mut conn, *plan_id, user.id).await?;
    let configuration = models::chatbot_configurations::get_course_designer_assistant(&mut conn)
        .await?
        .ok_or_else(|| {
            controller_err!(
                NotFound,
                "No chatbot has been chosen as the course design assistant.".to_string()
            )
        })?;
    let mut tx = conn.begin().await?;
    let conversation =
        chatbot_conversations::create_for_course_plan(&mut tx, user.id, configuration.id, *plan_id)
            .await?;
    models::chatbot_conversation_messages::insert_initial_message(
        &mut tx,
        conversation.id,
        &configuration,
        estimate_tokens(&configuration.initial_message),
        Some(user.id),
        None,
    )
    .await?;
    tx.commit().await?;
    token.authorized_ok(web::Json(conversation))
}

/**
GET `/api/v0/main-frontend/course-plans/{plan_id}/assistant/conversations/current`

The user's latest conversation about the plan with the current assistant, or null when there is
none yet.
*/
#[utoipa::path(
    get,
    path = "/conversations/current",
    operation_id = "getCurrentCourseDesignerAssistantConversation",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Current conversation", body = Option<ChatbotConversationInfo>))
)]
#[instrument(skip(pool))]
async fn get_current_conversation(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<ChatbotConversationInfo>>> {
    let mut conn = pool.acquire().await?;
    let (token, _plan) = authorize_plan_member(&mut conn, *plan_id, user.id).await?;
    let Some(configuration) =
        models::chatbot_configurations::get_course_designer_assistant(&mut conn).await?
    else {
        return token.authorized_ok(web::Json(None));
    };
    let Some(conversation) = chatbot_conversations::get_latest_for_course_plan(
        &mut conn,
        user.id,
        configuration.id,
        *plan_id,
    )
    .await?
    else {
        return token.authorized_ok(web::Json(None));
    };
    let info = chatbot_conversations::get_course_plan_conversation_info(
        &mut conn,
        user.id,
        configuration.id,
        *plan_id,
        conversation.id,
    )
    .await?;
    token.authorized_ok(web::Json(Some(info)))
}

/**
GET `/api/v0/main-frontend/course-plans/{plan_id}/assistant/conversations/{conversation_id}/info`
*/
#[utoipa::path(
    get,
    path = "/conversations/{conversation_id}/info",
    operation_id = "getCourseDesignerAssistantConversationInfo",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("conversation_id" = Uuid, Path, description = "Conversation id")
    ),
    responses((status = 200, description = "Conversation", body = ChatbotConversationInfo))
)]
#[instrument(skip(pool))]
async fn get_conversation_info(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConversationInfo>> {
    let (plan_id, conversation_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let (token, conversation, _plan) =
        authorize_plan_conversation(&mut conn, plan_id, conversation_id, user.id).await?;
    let info = chatbot_conversations::get_course_plan_conversation_info(
        &mut conn,
        user.id,
        conversation.chatbot_configuration_id,
        plan_id,
        conversation_id,
    )
    .await?;
    token.authorized_ok(web::Json(info))
}

/**
POST `/api/v0/main-frontend/course-plans/{plan_id}/assistant/conversations/{conversation_id}/send-message`

Sends the user's message and streams the assistant's turn, as the course material chatbot's
`send-message` does.
*/
#[utoipa::path(
    post,
    path = "/conversations/{conversation_id}/send-message",
    operation_id = "sendCourseDesignerAssistantMessage",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("conversation_id" = Uuid, Path, description = "Conversation id")
    ),
    request_body = SendCourseDesignerAssistantMessage,
    responses(
        (
            status = 200,
            description = "Chatbot response stream",
            body = ChatbotChatStreamEvent,
            content_type = "application/x-ndjson"
        )
    )
)]
// The payload is not recorded: it carries what the user wrote.
#[instrument(skip(pool, cache, app_conf, payload))]
async fn post_send_message(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    cache: web::Data<Cache>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<SendCourseDesignerAssistantMessage>,
) -> ControllerResult<HttpResponse> {
    let (plan_id, conversation_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let (token, conversation, plan) =
        authorize_plan_conversation(&mut conn, plan_id, conversation_id, user.id).await?;
    let turn_context = plan_turn_context(&mut conn, &conversation, plan, user.id).await?;
    let response_stream = send_chat_request_and_parse_stream(
        pool.get_ref().clone(),
        &app_conf,
        cache.get_ref().clone(),
        conversation.chatbot_configuration_id,
        conversation_id,
        &payload.message,
        None,
        turn_context,
    )
    .await?;
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type("application/x-ndjson")
            .streaming(response_stream),
    )
}

/**
POST `/api/v0/main-frontend/course-plans/{plan_id}/assistant/conversations/{conversation_id}/tool-response`

Answers a tool call the turn suspended on, such as applying or discarding a proposed change, and
streams the resumed turn, as the course material chatbot's `tool-response` does.
*/
#[utoipa::path(
    post,
    path = "/conversations/{conversation_id}/tool-response",
    operation_id = "sendCourseDesignerAssistantToolResponse",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
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
#[instrument(skip(pool, cache, app_conf, payload))]
async fn post_tool_response(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    cache: web::Data<Cache>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<ChatbotToolResponse>,
) -> ControllerResult<HttpResponse> {
    let (plan_id, conversation_id) = path.into_inner();
    let ChatbotToolResponse {
        tool_call_id,
        tool_name,
        answer,
    } = payload.into_inner();
    let mut conn = pool.acquire().await?;
    let (token, conversation, plan) =
        authorize_plan_conversation(&mut conn, plan_id, conversation_id, user.id).await?;
    verify_answered_tool_name(&mut conn, conversation_id, &tool_call_id, tool_name).await?;
    let turn_context = plan_turn_context(&mut conn, &conversation, plan, user.id).await?;
    let response_stream = answer_tool_call_and_resume_stream(
        pool.get_ref().clone(),
        &app_conf,
        cache.get_ref().clone(),
        conversation.chatbot_configuration_id,
        conversation_id,
        &tool_call_id,
        &answer,
        turn_context,
    )
    .await?;
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type("application/x-ndjson")
            .streaming(response_stream),
    )
}

async fn authorize_plan_member(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> Result<(AuthorizationToken, CourseDesignerPlan), ControllerError> {
    let plan = models::course_designer_plan_members::get_plan_for_user(conn, plan_id, user_id)
        .await
        .optional()?
        .ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::Forbidden,
                "You are not a member of this plan.".to_string(),
                None,
            )
        })?;
    Ok((skip_authorize(), plan))
}

/// Checks that the user is a plan member and that the conversation is theirs and about this plan.
/// Every endpoint that continues a conversation must go through here.
async fn authorize_plan_conversation(
    conn: &mut PgConnection,
    plan_id: Uuid,
    conversation_id: Uuid,
    user_id: Uuid,
) -> Result<(AuthorizationToken, ChatbotConversation, CourseDesignerPlan), ControllerError> {
    let (token, plan) = authorize_plan_member(conn, plan_id, user_id).await?;
    let conversation = chatbot_conversations::get_by_id(conn, conversation_id).await?;
    if conversation.user_id != Some(user_id)
        || conversation.course_designer_plan_id != Some(plan_id)
    {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "Conversation does not belong to the user and plan".to_string(),
            None,
        ));
    }
    Ok((token, conversation, plan))
}

/// `plan` must come from [authorize_plan_conversation] in the same request: plan tools trust it as
/// proof of membership.
async fn plan_turn_context(
    conn: &mut PgConnection,
    conversation: &ChatbotConversation,
    plan: CourseDesignerPlan,
    user_id: Uuid,
) -> Result<ChatbotTurnContext, ControllerError> {
    let configuration =
        models::chatbot_configurations::get_by_id(conn, conversation.chatbot_configuration_id)
            .await?;
    let course_name = match configuration.course_id {
        Some(course_id) => Some(models::courses::get_course(conn, course_id).await?.name),
        None => None,
    };
    Ok(ChatbotTurnContext::new_for_course_plan(
        user_id,
        course_name,
        conversation.id,
        &configuration,
        plan,
    ))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_assistant_status))
        .route("/conversations/new", web::post().to(post_new_conversation))
        .route(
            "/conversations/current",
            web::get().to(get_current_conversation),
        )
        .route(
            "/conversations/{conversation_id}/info",
            web::get().to(get_conversation_info),
        )
        .route(
            "/conversations/{conversation_id}/send-message",
            web::post().to(post_send_message),
        )
        .route(
            "/conversations/{conversation_id}/tool-response",
            web::post().to(post_tool_response),
        );
}
