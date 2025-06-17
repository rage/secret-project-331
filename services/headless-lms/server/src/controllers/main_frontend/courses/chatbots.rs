//! Controllers for requests starting with `/api/v0/main-frontend/{course_id}/chatbots`.
use crate::prelude::*;

use models::chatbot_configurations::ChatbotConfiguration;

/// GET `/api/v0/main-frontend/courses/{course_id}/chatbots`
#[instrument(skip(pool))]
async fn get_chatbots(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ChatbotConfiguration>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let configurations =
        models::chatbot_configurations::get_for_course(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(configurations))
}

/// POST `/api/v0/main-frontend/courses/{course_id}/chatbots`
#[instrument(skip(pool, payload))]
async fn create_chatbot(
    course_id: web::Path<Uuid>,
    payload: web::Json<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let configuration = models::chatbot_configurations::insert(
        &mut conn,
        ChatbotConfiguration {
            chatbot_name: payload.into_inner(),
            course_id: *course_id,
            ..Default::default()
        },
    )
    .await?;
    token.authorized_ok(web::Json(configuration))
}

/// POST `/api/v0/main-frontend/courses/{course_id}/chatbots/default`
#[instrument(skip(pool, payload))]
async fn set_default_chatbot(
    course_id: web::Path<Uuid>,
    payload: web::Json<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let chatbot_id = payload.into_inner();
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let mut tx = conn.begin().await?;

    models::chatbot_configurations::remove_default_chatbot_from_course(&mut tx, *course_id).await?;

    let configuration =
        models::chatbot_configurations::set_default_chatbot_for_course(&mut tx, chatbot_id).await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(configuration))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("", web::get().to(get_chatbots))
        .route("", web::post().to(create_chatbot))
        .route("/default", web::post().to(set_default_chatbot));
}
