use crate::{controllers::ControllerResult, models::exercise_services::ExerciseService};
use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;

#[instrument(skip(pool))]
async fn get_exercise_service(
    exercise_type: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<ExerciseService>> {
    let mut conn = pool.acquire().await?;
    let exercise_service = crate::models::exercise_services::get_exercise_service_by_exercise_type(
        &mut conn,
        exercise_type.as_str(),
    )
    .await?;
    Ok(Json(exercise_service))
}

pub fn _add_exercise_services_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exercise_type}", web::get().to(get_exercise_service));
}
