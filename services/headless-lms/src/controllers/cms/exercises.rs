use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{controllers::ControllerResult, utils::document_schema_processor::GutenbergBlock};

#[instrument(skip(pool))]
async fn get_exercise_by_id(
    request_exercise_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Vec<GutenbergBlock>>> {
    let mut conn = pool.acquire().await?;
    let exercise =
        crate::models::exercises::get_denormalized_exercise_by_id(&mut conn, *request_exercise_id)
            .await?;
    format!("{:?}", exercise);
    Ok(Json(exercise))
}

pub fn _add_exercises_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exercise_id}", web::get().to(get_exercise_by_id));
}
