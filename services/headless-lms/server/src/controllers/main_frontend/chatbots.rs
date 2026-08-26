//! Controllers for requests starting with `/api/v0/main-frontend/chatbots/`.
use crate::prelude::*;
use headless_lms_models::{
    application_task_default_language_models::ApplicationTask,
    chatbot_configurations::CreateChatbotRequest,
};
use utoipa::OpenApi;

use models::chatbot_configurations::{ChatbotConfiguration, NewChatbotConf};

#[derive(OpenApi)]
#[openapi(paths(
    get_chatbot,
    edit_chatbot,
    delete_chatbot,
    get_all_chatbots,
    create_chatbot
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

    let token = if let Some(course_id) = configuration.course_id {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?
    } else {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?
    };

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
    let token = if let Some(course_id) = chatbot.course_id {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?
    } else {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?
    };

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
    let token = if let Some(course_id) = chatbot.course_id {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?
    } else {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?
    };
    models::chatbot_configurations::delete(&mut conn, *chatbot_configuration_id).await?;

    token.authorized_ok(web::Json(()))
}

/// GET `/api/v0/main-frontend/chatbots`
#[utoipa::path(
    get,
    path = "/",
    operation_id = "getAllChatbots",
    tag = "chatbots",
    responses(
        (status = 200, description = "All chatbots", body = Vec<ChatbotConfiguration>)
    )
)]
#[instrument(skip(pool))]
async fn get_all_chatbots(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ChatbotConfiguration>>> {
    let mut conn = pool.acquire().await?;
    let all_chatbots = models::chatbot_configurations::get_all_chatbots(&mut conn).await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::GlobalPermissions).await?;
    token.authorized_ok(web::Json(all_chatbots))
}

/// POST `/api/v0/main-frontend/chatbots/create`
#[utoipa::path(
    post,
    path = "/create",
    operation_id = "createChatbot",
    tag = "chatbots",
    request_body(
        content = CreateChatbotRequest,
        description = "JSON object with chatbot name and optional course id, e.g. \"name: 'Chatbot 1', course_id: null, purpose: 'This chatbot will help students learn.'\".",
        content_type = "application/json"
    ),
    responses(
        (status = 200, description = "Created chatbot", body = ChatbotConfiguration)
    )
)]
#[instrument(skip(pool, payload, app_conf))]
async fn create_chatbot(
    payload: web::Json<CreateChatbotRequest>,
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let course_id = payload.course_id;
    let token = if let Some(course_id) = course_id {
        let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;
        let course = models::courses::get_course(&mut conn, course_id).await?;

        if !course.can_add_chatbot {
            return Err(controller_err!(
                BadRequest,
                "Course doesn't allow creating chatbots.".to_string()
            ));
        }
        token
    } else {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?
    };
    let mut tx = conn.begin().await?;

    let model = models::chatbot_configurations_models::get_default(&mut tx)
        .await
        .map_err(|e| {
            controller_err!(
                BadRequest,
                "No default chatbot model configured. Ask an admin to set one.".to_string(),
                e
            )
        })?;

    let configuration = models::chatbot_configurations::insert(
        &mut tx,
        PKeyPolicy::Generate,
        NewChatbotConf {
            chatbot_name: payload.name.clone(),
            course_id,
            model_id: model.id,
            publicly_accessible: course_id.is_none(),
            ..Default::default()
        },
    )
    .await?;
    tx.commit().await?;

    // commit before using Azure LLM so failure there won't ruin the otherwise
    // valid insert
    let task_llm = models::application_task_default_language_models::get_for_task(
        &mut conn,
        ApplicationTask::MessageSuggestion,
    )
    .await?;

    let lol = headless_lms_chatbot::prompt_creator::generate_prompt(
        app_conf.as_ref(),
        task_llm,
        &configuration,
    )
    .await?;
    token.authorized_ok(web::Json(configuration))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/{chatbot_configuration_id}", web::get().to(get_chatbot))
        .route("/create", web::post().to(create_chatbot))
        .route("/{chatbot_configuration_id}", web::post().to(edit_chatbot))
        .route(
            "/{chatbot_configuration_id}",
            web::delete().to(delete_chatbot),
        )
        .route("/", web::get().to(get_all_chatbots));
}
