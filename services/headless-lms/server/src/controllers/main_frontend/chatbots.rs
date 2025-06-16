use crate::prelude::*;

use models::chatbot_configurations::{ChatbotConfiguration, NewChatbotConf};

/// GET `/api/v0/main-frontend/chatbots/{chatbot_id}`
#[instrument(skip(pool))]
async fn get_chatbot(
    chatbot_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let configuration = models::chatbot_configurations::get_by_id(&mut conn, *chatbot_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(configuration.course_id),
    )
    .await?;

    token.authorized_ok(web::Json(configuration))
}

/// POST `/api/v0/main-frontend/chatbots/{chatbot_id}`
#[instrument(skip(pool, payload))]
async fn edit_chatbot(
    chatbot_id: web::Path<Uuid>,
    payload: web::Json<NewChatbotConf>, // are the fields correct???
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let chatbot = models::chatbot_configurations::get_by_id(&mut conn, *chatbot_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(chatbot.course_id),
    )
    .await?;

    let configuration =
        models::chatbot_configurations::edit(&mut conn, payload.into_inner(), *chatbot_id).await?;
    token.authorized_ok(web::Json(configuration))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/{id}", web::get().to(get_chatbot))
        .route("/{id}", web::post().to(edit_chatbot));
}
