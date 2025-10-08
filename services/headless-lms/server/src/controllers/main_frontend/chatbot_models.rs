//! Controllers for requests starting with `/api/v0/main-frontend/chatbot-models/`.
use crate::prelude::*;

use models::chatbot_configurations_models::ChatbotConfigurationModel;

/// GET `/api/v0/main-frontend/chatbot-models/{chatbot_configuration_id}`
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

/// GET `/api/v0/main-frontend/chatbot-models/`
#[instrument(skip(pool))]
async fn get_all_models(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ChatbotConfigurationModel>>> {
    let mut conn = pool.acquire().await?;
    let model = models::chatbot_configurations_models::get_all(&mut conn).await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    token.authorized_ok(web::Json(model))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/{id}", web::get().to(get_model))
        .route("/", web::get().to(get_all_models));
}
