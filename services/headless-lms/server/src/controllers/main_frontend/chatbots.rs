//! Controllers for requests starting with `/api/v0/main-frontend/chatbots/`.
use crate::prelude::*;
use headless_lms_models::chatbot_configurations::ChatbotCommandCenterData;
use utoipa::OpenApi;

use models::chatbot_configurations::{ChatbotConfiguration, NewChatbotConf};

#[derive(OpenApi)]
#[openapi(paths(
    get_chatbot,
    edit_chatbot,
    delete_chatbot,
    get_chatbot_command_center_data
))]
pub(crate) struct MainFrontendChatbotsApiDoc;

/// GET `/api/v0/main-frontend/chatbots/{chatbot_configuration_id}`
#[utoipa::path(
    get,
    path = "/{chatbot_configuration_id}",
    operation_id = "getChatbotConfiguration",
    tag = "chatbots",
    params(
        ("chatbot_configuration_id" = Uuid, Path, description = "Chatbot configuration id")
    ),
    responses(
        (status = 200, description = "Chatbot configuration", body = ChatbotConfiguration)
    )
)]
#[instrument(skip(pool))]
async fn get_chatbot(
    chatbot_configuration_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let configuration =
        models::chatbot_configurations::get_by_id(&mut conn, *chatbot_configuration_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(configuration.course_id),
    )
    .await?;

    token.authorized_ok(web::Json(configuration))
}

/// POST `/api/v0/main-frontend/chatbots/{chatbot_configuration_id}`
#[utoipa::path(
    post,
    path = "/{chatbot_configuration_id}",
    operation_id = "configureChatbot",
    tag = "chatbots",
    params(
        ("chatbot_configuration_id" = Uuid, Path, description = "Chatbot configuration id")
    ),
    request_body = NewChatbotConf,
    responses(
        (status = 200, description = "Updated chatbot configuration", body = ChatbotConfiguration)
    )
)]
#[instrument(skip(pool, payload))]
async fn edit_chatbot(
    chatbot_configuration_id: web::Path<Uuid>,
    payload: web::Json<NewChatbotConf>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let chatbot =
        models::chatbot_configurations::get_by_id(&mut conn, *chatbot_configuration_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(chatbot.course_id),
    )
    .await?;

    let configuration: ChatbotConfiguration = models::chatbot_configurations::edit(
        &mut conn,
        payload.into_inner(),
        *chatbot_configuration_id,
    )
    .await?;
    token.authorized_ok(web::Json(configuration))
}

/// DELETE `/api/v0/main-frontend/chatbots/{chatbot_configuration_id}`
#[utoipa::path(
    delete,
    path = "/{chatbot_configuration_id}",
    operation_id = "deleteChatbotConfiguration",
    tag = "chatbots",
    params(
        ("chatbot_configuration_id" = Uuid, Path, description = "Chatbot configuration id")
    ),
    responses(
        (status = 200, description = "Deleted chatbot configuration")
    )
)]
#[instrument(skip(pool))]
async fn delete_chatbot(
    chatbot_configuration_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let chatbot =
        models::chatbot_configurations::get_by_id(&mut conn, *chatbot_configuration_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(chatbot.course_id),
    )
    .await?;
    models::chatbot_configurations::delete(&mut conn, *chatbot_configuration_id).await?;

    token.authorized_ok(web::Json(()))
}

/// GET `/api/v0/main-frontend/chatbots`
#[utoipa::path(
    get,
    path = "/",
    operation_id = "getChatbotCommandCenterData",
    tag = "chatbots",
    responses(
        (status = 200, description = "Chatbot command center data", body = Vec<ChatbotCommandCenterData>)
    )
)]
#[instrument(skip(pool))]
async fn get_chatbot_command_center_data(
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<ChatbotCommandCenterData>>> {
    let mut conn = pool.acquire().await?;
    let chatbot_command_center_data =
        models::chatbot_configurations::get_chatbot_command_center_data(&mut conn).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(chatbot_command_center_data))
}

// get_chatbot_command_center_data
pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/{chatbot_configuration_id}", web::get().to(get_chatbot))
        .route("/{chatbot_configuration_id}", web::post().to(edit_chatbot))
        .route(
            "/{chatbot_configuration_id}",
            web::delete().to(delete_chatbot),
        )
        .route("/", web::get().to(get_chatbot_command_center_data));
}
