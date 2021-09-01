//! Controllers for requests starting with `/api/v0/course-material/course-instances`.
use crate::{
    controllers::ControllerResult,
    domain::authorization::AuthUser,
    models::{
        course_instance_enrollments::{CourseInstanceEnrollment, NewCourseInstanceEnrollment},
        user_exercise_states::UserProgress,
    },
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
) -> ControllerResult<Json<Option<UserProgress>>> {
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

Response:
```json
{
  "user_id": "6c6a2449-8eeb-46ca-8e97-e69752227724",
  "course_id": "c6489a19-c8dc-4a36-ad45-f14c41ef5386",
  "course_instance_id": "fbcdcd77-7f82-4cc3-86a0-b82e116a5ff3",
  "current": true,
  "created_at": "2021-07-08T09:56:54.915951Z",
  "updated_at": "2021-07-08T09:56:54.915951Z",
  "deleted_at": null
}
```
*/
#[instrument(skip(pool))]
async fn add_user_enrollment(
    pool: web::Data<PgPool>,
    request_course_instance_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<CourseInstanceEnrollment>> {
    let mut conn = pool.acquire().await?;

    let instance = crate::models::course_instances::get_course_instance(
        &mut conn,
        *request_course_instance_id,
    )
    .await?;
    let enrollment =
        crate::models::course_instance_enrollments::insert_enrollment_and_set_as_current(
            &mut conn,
            NewCourseInstanceEnrollment {
                course_id: instance.course_id,
                course_instance_id: instance.id,
                user_id: user.id,
            },
        )
        .await?;

    Ok(Json(enrollment))
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
