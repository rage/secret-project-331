//! Controllers for requests starting with `/api/v0/main-frontend/{course_id}/chatbots`.
use crate::prelude::*;

use headless_lms_models::chatbot_configurations::NewChatbotConf;
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
    let mut tx = conn.begin().await?;

    let course = models::courses::get_course(&mut tx, *course_id).await?;

    if !course.can_add_chatbot {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Course doesn't allow creating chatbots.".to_string(),
            None,
        ));
    }

    let configuration = models::chatbot_configurations::insert(
        &mut tx,
        NewChatbotConf {
            chatbot_name: payload.into_inner(),
            course_id: *course_id,
            ..Default::default()
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(configuration))
}

/// POST `/api/v0/main-frontend/courses/{course_id}/chatbots/{chatbot_configuration_id}/set-as-default`
#[instrument(skip(pool))]
async fn set_default_chatbot(
    ids: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChatbotConfiguration>> {
    let mut conn = pool.acquire().await?;
    let (course_id, chatbot_configuration_id) = *ids;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;
    let mut tx = conn.begin().await?;

    models::chatbot_configurations::remove_default_chatbot_from_course(&mut tx, course_id).await?;

    // check if chatbot belongs in course
    let chatbot =
        models::chatbot_configurations::get_by_id(&mut tx, chatbot_configuration_id).await?;

    if course_id != chatbot.course_id {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chatbot course id doesn't match the course id provided.".to_string(),
            None,
        ));
    }

    let configuration = models::chatbot_configurations::set_default_chatbot_for_course(
        &mut tx,
        chatbot_configuration_id,
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(configuration))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("", web::get().to(get_chatbots))
        .route("", web::post().to(create_chatbot))
        .route(
            "/{chatbot_configuration_id}/set-as-default",
            web::post().to(set_default_chatbot),
        );
}
