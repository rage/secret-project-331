//! Controllers for requests starting with `/api/v0/course-material/course-instances`.
use crate::{controllers::ApplicationResult, models::user_exercise_states::UserProgress};
use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

/**
 GET /api/v0/course-material/course-instance/:course_intance_id/progress - returns user progress information.
 # Example,
```json
{
   "score_given": 3,
   "score_maximum": 10,
   "total_exericises": 66,
   "completed_exercises": 13
}
```
*/
async fn get_user_progress_page(
    request_course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Option<UserProgress>>> {
    let user_course_progress = crate::models::user_exercise_states::get_user_progress(
        pool.get_ref(),
        &request_course_instance_id,
        NULL,
    )
    .await?;
    Ok(Json(user_course_progress))
}

pub fn _add_user_progress_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_instance_id}/progress",
        web::get().to(get_user_progress_page),
    );
}
