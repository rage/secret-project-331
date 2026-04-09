//! Controllers for requests starting with `/api/v0/main-frontend/chatbot-models/`.
use crate::prelude::*;
use utoipa::OpenApi;

use models::chatbot_configurations_models::ChatbotConfigurationModel;

#[derive(OpenApi)]
#[openapi(paths(get_model, get_all_models))]
pub(crate) struct MainFrontendChatbotModelsApiDoc;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]

pub struct CourseInfo {
    course_id: Uuid,
}

/// GET `/api/v0/main-frontend/chatbot-models/{chatbot_configuration_id}`
#[utoipa::path(
    get,
    path = "/{chatbot_model_id}",
    operation_id = "getChatbotModel",
    tag = "chatbot-models",
    params(
        ("chatbot_model_id" = Uuid, Path, description = "Chatbot model id")
    ),
    request_body(
        content = Uuid,
        content_type = "application/json"
    ),
    responses(
        (status = 200, description = "Chatbot model", body = ChatbotConfigurationModel)
    )
)]
#[instrument(skip(pool))]
async fn get_model(
    chatbot_model_id: web::Path<Uuid>,
    payload: web::Json<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfigurationModel>> {
    let mut conn = pool.acquire().await?;
    let model =
        models::chatbot_configurations_models::get_by_id(&mut conn, *chatbot_model_id).await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*payload)).await?;

    token.authorized_ok(web::Json(model))
}

/// GET `/api/v0/main-frontend/chatbot-models?course_id={course_id}`
#[utoipa::path(
    get,
    path = "/",
    operation_id = "getChatbotModels",
    tag = "chatbot-models",
    params(
        ("course_id" = Uuid, Query, description = "Course id")
    ),
    responses(
        (status = 200, description = "Chatbot models", body = Vec<ChatbotConfigurationModel>)
    )
)]
#[instrument(skip(pool))]
async fn get_all_models(
    course_info: web::Query<CourseInfo>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ChatbotConfigurationModel>>> {
    let mut conn = pool.acquire().await?;
    let models = models::chatbot_configurations_models::get_all(&mut conn).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(course_info.course_id),
    )
    .await?;

    token.authorized_ok(web::Json(models))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/{chatbot_model_id}", web::get().to(get_model))
        .route("/", web::get().to(get_all_models));
}
