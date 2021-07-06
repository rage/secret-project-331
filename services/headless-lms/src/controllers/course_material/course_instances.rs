//! Controllers for requests starting with `/api/v0/course-material/course-instances`.
use crate::domain::authorization::AuthUser;
use crate::{
    controllers::ApplicationResult,
    models::{course_instances::CourseInstance, user_exercise_states::UserProgress},
};
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
POST /api/v0/course-material/course-instance/:course_instance_id/enroll - enrolls user to the course instance.

# Example
```json
{
  "id": "e051ddb5-2128-4215-adda-ebd74a0ea46b",
  "created_at": "2021-06-28T00:21:11.780420Z",
  "updated_at": "2021-06-28T00:21:11.780420Z",
  "deleted_at": null,
  "course_id": "b8077bc2-0816-4c05-a651-d2d75d697fdf",
  "starts_at": null,
  "ends_at": null,
  "name": null,
  "description": null,
  "variant_status": "Active"
}
```
*/
#[instrument(skip(pool))]
async fn add_user_enrollment(
    pool: web::Data<PgPool>,
    request_course_instance_id: web::Path<Uuid>,
    user: AuthUser,
) -> ApplicationResult<Json<CourseInstance>> {
    let mut conn = pool.acquire().await?;
    let instance = crate::models::course_instances::get_course_instance(
        &mut conn,
        *request_course_instance_id,
    )
    .await?;
    let _enrollment = crate::models::course_instance_enrollments::insert(
        &mut conn,
        user.id,
        instance.course_id,
        *request_course_instance_id,
        true,
    )
    .await?;
    Ok(Json(instance))
}

pub fn _add_user_progress_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_instance_id}/enroll",
        web::post().to(add_user_enrollment),
    )
    .route(
        "/{course_instance_id}/progress",
        web::get().to(get_user_progress_page),
    );
}
