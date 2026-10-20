//! Controllers for requests starting with `/api/v0/main-frontend/chatbot-embed/`.
use crate::prelude::*;
use utoipa::OpenApi;

use models::chatbot_configurations::ChatbotConfiguration;

#[derive(OpenApi)]
#[openapi(paths(get_chatbot))]
pub(crate) struct MainFrontendChatbotEmbedApiDoc;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]

pub struct CourseInfo {
    course_id: Option<Uuid>,
}

/// GET `/api/v0/main-frontend/chatbot-embed/{chatbot_configuration_id}`
#[utoipa::path(
    get,
    path = "/{chatbot_id}",
    operation_id = "getChatbotEmbedConf",
    tag = "chatbot-embed",
    params(
        ("chatbot_id" = Uuid, Path, description = "Chatbot id")
    ),
    responses(
        (status = 200, description = "Chatbot configuration", body = ChatbotConfiguration)
    )
)]
#[instrument(skip(pool))]
async fn get_chatbot(
    chatbot_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let chatbot = models::chatbot_configurations::get_by_id(&mut conn, *chatbot_id).await?;
    let token = skip_authorize();
    if !chatbot.embeddable {
        return Err(controller_err!(
            Forbidden,
            "Chatbot is not embeddable".to_string()
        ));
    }
    token.authorized_ok(web::Json(chatbot))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/{chatbot_id}", web::get().to(get_chatbot));
}
