//! Controllers for requests starting with `/api/v0/main-frontend/exercise-services/`.

use headless_lms_models::{ModelError, exercise_service_info::fetch_and_upsert_service_info};
use models::exercise_services::{ExerciseService, ExerciseServiceNewOrUpdate};

use crate::{domain::models_requests, prelude::*};

/**
DELETE `/api/v0/main-frontend/exercise-services/:id`
*/
#[instrument(skip(pool))]
async fn delete_exercise_service(
    exercise_service_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseService>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::ExerciseService).await?;

    let deleted =
        models::exercise_services::delete_exercise_service(&mut conn, *exercise_service_id).await?;

    token.authorized_ok(web::Json(deleted))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseServiceWithError {
    exercise_service: ExerciseService,
    service_info_error: Option<String>,
}

/**
POST `/api/v0/main-frontend/exercise-services`
*/
#[instrument(skip(pool))]
async fn add_exercise_service(
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<ExerciseServiceNewOrUpdate>,
) -> ControllerResult<web::Json<ExerciseServiceWithError>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::ExerciseService).await?;

    let exercise_service = payload.0;
    let exercise_service =
        models::exercise_services::insert_exercise_service(&mut conn, &exercise_service).await?;

    let exercise_service_with_error =
        try_to_get_exercise_service_info(&mut conn, exercise_service).await?;
    token.authorized_ok(web::Json(exercise_service_with_error))
}

/**
GET `/api/v0/main-frontend/exercise-services/:id`
*/
#[instrument(skip(pool))]
async fn get_exercise_service_by_id(
    exercise_service_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseService>> {
    let mut conn = pool.acquire().await?;
    let exercise_service =
        models::exercise_services::get_exercise_service(&mut conn, *exercise_service_id).await?;

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::ExerciseService).await?;
    token.authorized_ok(web::Json(exercise_service))
}

/**
GET `/api/v0/main-frontend/exercise-services`
*/
#[instrument(skip(pool))]
async fn get_exercise_services(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseService>>> {
    let mut conn = pool.acquire().await?;
    let exercise_services = models::exercise_services::get_exercise_services(&mut conn).await?;

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::ExerciseService).await?;
    token.authorized_ok(web::Json(exercise_services))
}

/**
PUT `/api/v0/main-frontend/exercise-services/:id`
*/
#[instrument(skip(pool))]
async fn update_exercise_service(
    payload: web::Json<ExerciseServiceNewOrUpdate>,
    exercise_service_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseServiceWithError>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::ExerciseService).await?;

    let updated_exercise_service = payload.0;
    let updated_service = models::exercise_services::update_exercise_service(
        &mut conn,
        *exercise_service_id,
        &updated_exercise_service,
    )
    .await?;

    let exercise_service_with_error =
        try_to_get_exercise_service_info(&mut conn, updated_service).await?;
    token.authorized_ok(web::Json(exercise_service_with_error))
}

async fn try_to_get_exercise_service_info(
    conn: &mut PgConnection,
    exercise_service: ExerciseService,
) -> Result<ExerciseServiceWithError, ModelError> {
    // try to get exercise service info
    let service_info_error = if let Err(err) = fetch_and_upsert_service_info(
        conn,
        &exercise_service,
        models_requests::fetch_service_info_fast,
    )
    .await
    {
        tracing::warn!(
            "Failed to get exercise service info for new exercise service {}: {err}",
            exercise_service.name
        );
        Some(err.to_string())
    } else {
        None
    };

    let with_error = ExerciseServiceWithError {
        exercise_service,
        service_info_error,
    };
    Ok(with_error)
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
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
