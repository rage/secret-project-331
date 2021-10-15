//! Controllers for requests starting with `/api/v0/course-material/course-instances`.
use crate::{
    controllers::ControllerResult,
    domain::authorization::AuthUser,
    models::{
        chapters::UserCourseInstanceChapterProgress,
        course_instance_enrollments::{CourseInstanceEnrollment, NewCourseInstanceEnrollment},
        user_exercise_states::{
            UserCourseInstanceChapterExerciseProgress, UserCourseInstanceProgress,
        },
    },
    utils::numbers::option_f32_to_f32_two_decimals,
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
#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance(
    user: AuthUser,
    request_course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<UserCourseInstanceProgress>> {
    let user_course_instance_progress =
        crate::models::user_exercise_states::get_user_course_instance_progress(
            pool.get_ref(),
            &request_course_instance_id,
            &user.id,
        )
        .await?;
    Ok(Json(user_course_instance_progress))
}

/**
GET `/api/v0/course-material/course-instance/:course_instance_id/chapters/:chapter_id/progress - Returns user progress for chapter in course instance.

# Example

Response:
```json
{
  "score_given":1.0,
  "score_maximum":4
}
```
*/

#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance_chapter(
    user: AuthUser,
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<UserCourseInstanceChapterProgress>> {
    let (course_instance_id, chapter_id) = params.into_inner();
    let user_course_instance_chapter_progress =
        crate::models::chapters::get_user_course_instance_chapter_progress(
            pool.get_ref(),
            &course_instance_id,
            &chapter_id,
            &user.id,
        )
        .await?;
    Ok(Json(user_course_instance_chapter_progress))
}

/**
GET /api/v0/course-material/course-instance/:course_instance_id/chapters/:chapter_id/exercises/progress - Returns user progress for an exercise in given course instance.

# Example

Response:
```json
{
    "exercise_id": "uuid"
    "score_given": 1.0
}
 ```
*/
#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance_chapter_exercises(
    user: AuthUser,
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Vec<UserCourseInstanceChapterExerciseProgress>>> {
    let mut conn = pool.acquire().await?;
    let (course_instance_id, chapter_id) = params.into_inner();
    let chapter_exercises =
        crate::models::exercises::get_exercises_by_chapter_id(&mut conn, &chapter_id).await?;
    let exercise_ids: Vec<Uuid> = chapter_exercises.into_iter().map(|e| e.id).collect();

    let user_course_instance_exercise_progress =
        crate::models::user_exercise_states::get_user_course_instance_chapter_exercises_progress(
            pool.get_ref(),
            &course_instance_id,
            &exercise_ids,
            &user.id,
        )
        .await?;
    let rounded_score_given_instances: Vec<UserCourseInstanceChapterExerciseProgress> =
        user_course_instance_exercise_progress
            .into_iter()
            .map(|i| UserCourseInstanceChapterExerciseProgress {
                score_given: option_f32_to_f32_two_decimals(i.score_given),
                exercise_id: i.exercise_id,
            })
            .collect();
    Ok(Json(rounded_score_given_instances))
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
        web::get().to(get_user_progress_for_course_instance),
    )
    .route(
        "/{course_instance_id}/chapters/{chapter_id}/exercises/progress",
        web::get().to(get_user_progress_for_course_instance_chapter_exercises),
    )
    .route(
        "/{course_instance_id}/chapters/{chapter_id}/progress",
        web::get().to(get_user_progress_for_course_instance_chapter),
    );
}
