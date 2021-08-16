//! Controllers for requests starting with `/api/v0/main-frontend/exercise-services/`.

use crate::models::exercise_services::ExerciseServiceNewOrUpdate;
use crate::{
    controllers::ControllerResult, domain::authorization::AuthUser,
    models::exercise_services::ExerciseService,
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

#[instrument(skip(pool))]
async fn delete_exercise_service(
    request_exercise_service_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<ExerciseService>> {
    let mut conn = pool.acquire().await?;
    let deleted = crate::models::exercise_services::delete_exercise_service(
        &mut conn,
        *request_exercise_service_id,
    )
    .await?;
    Ok(Json(deleted))
}

#[instrument(skip(pool))]
async fn add_exercise_service(
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<ExerciseServiceNewOrUpdate>,
) -> ControllerResult<Json<ExerciseService>> {
    let mut conn = pool.acquire().await?;
    let exercise_service = payload.0;
    let created =
        crate::models::exercise_services::insert_exercise_service(&mut conn, &exercise_service)
            .await?;
    Ok(Json(created))
}

#[instrument(skip(pool))]
async fn get_exercise_service_by_id(
    request_exercise_service_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<ExerciseService>> {
    let mut conn = pool.acquire().await?;
    let exercise_service = crate::models::exercise_services::get_exercise_service(
        &mut conn,
        *request_exercise_service_id,
    )
    .await?;
    Ok(Json(exercise_service))
}

#[instrument(skip(pool))]
async fn get_exercise_services(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<Vec<ExerciseService>>> {
    let mut conn = pool.acquire().await?;
    let exercise_services =
        crate::models::exercise_services::get_exercise_services(&mut conn).await?;
    Ok(Json(exercise_services))
}

#[instrument(skip(pool))]
async fn update_exercise_service(
    payload: web::Json<ExerciseServiceNewOrUpdate>,
    request_exercise_service_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<ExerciseService>> {
    let mut conn = pool.acquire().await?;
    let updated_exercise_service = payload.0;
    let updated_service = crate::models::exercise_services::update_exercise_service(
        &mut conn,
        *request_exercise_service_id,
        &updated_exercise_service,
    )
    .await?;
    Ok(Json(updated_service))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_exercise_service_routes(cfg: &mut ServiceConfig) {
    cfg.route("/", web::post().to(add_exercise_service))
        .route("/", web::get().to(get_exercise_services))
        .route(
            "/{exercise_service_id}",
            web::delete().to(delete_exercise_service),
        )
        .route(
            "/{exercise_service_id}",
            web::put().to(update_exercise_service),
        )
        .route(
            "/{exercise_service_id}",
            web::get().to(get_exercise_service_by_id),
        );
}
