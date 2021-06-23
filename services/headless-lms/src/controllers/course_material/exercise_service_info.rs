//! Controllers for requests starting with `/api/v0/course_material/exercices_service_info`.
use crate::models::chapters::Chapter;
use crate::{controllers::ApplicationResult, models::pages::Page};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
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
    user: AuthUser,
    request_course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Option<UserProgress>>> {
    let user_course_progress = crate::models::user_exercise_states::get_user_progress(
        pool.get_ref(),
        &request_course_instance_id,
        &user.id,
    )
    .await?;
    Ok(Json(Some(user_course_progress)))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_exercise_service_info_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_id}/page-by-path/{url_path:.*}",
        web::get().to(get_course_page_by_path),
    )
}
