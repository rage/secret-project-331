use crate::{
    controllers::ControllerResult,
    models::{self, exercise_tasks::ExerciseTask},
};
use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/main-frontend/exercise_tasks/:exercise_task_id` - Returns a single exercise task.
*/
#[instrument(skip(pool))]
async fn get_exercise_task(
    pool: web::Data<PgPool>,
    exercise_task_id: web::Path<Uuid>,
) -> ControllerResult<Json<ExerciseTask>> {
    let mut conn = pool.acquire().await?;
    let exercise_task = models::exercise_tasks::get_by_id(&mut conn, *exercise_task_id).await?;
    Ok(Json(exercise_task))
}

pub fn _add_exercise_tasks_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exercise_task_id}", web::get().to(get_exercise_task));
}
