use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    controllers::ControllerResult,
    models::{
        self,
        submissions::{Submission, SubmissionInfo},
    },
};
/**
GET `/api/v0/main-frontend/submissions/{submission_id}"` - Returns a single submission.

# Example
```json
{
  "id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
  "created_at": "2021-03-08T21:50:51.065821",
  "updated_at": "2021-03-08T21:50:51.065821",
  "exercise_id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
  "course_id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
  "course_instance_id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
  "exercise_task_id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
  "user_id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83"
}
```
 */
#[instrument(skip(pool))]
async fn get_submission(
    submission_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Submission>> {
    let mut conn = pool.acquire().await?;
    let submission = crate::models::submissions::get_by_id(&mut conn, *submission_id).await?;
    Ok(Json(submission))
}

/**
GET `/api/v0/main-frontend/submissions/{submission_id}/info"` - Returns data necessary for rendering a submission.
*/
#[instrument(skip(pool))]
async fn get_submission_info(
    submission_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<SubmissionInfo>> {
    let mut conn = pool.acquire().await?;
    let submission = models::submissions::get_by_id(&mut conn, *submission_id).await?;
    let exercise = models::exercises::get_by_id(&mut conn, submission.exercise_id).await?;
    let exercise_task =
        models::exercise_tasks::get_exercise_task_by_id(&mut conn, submission.exercise_task_id)
            .await?;
    let grading = if let Some(id) = submission.grading_id {
        Some(models::gradings::get_by_id(&mut conn, id).await?)
    } else {
        None
    };
    let exercise_service_info = models::exercise_service_info::get_service_info_by_exercise_type(
        &mut conn,
        &exercise_task.exercise_type,
    )
    .await?;

    Ok(Json(SubmissionInfo {
        submission,
        exercise,
        exercise_task,
        grading,
        submission_iframe_path: exercise_service_info.submission_iframe_path,
    }))
}

pub fn _add_submissions_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{submission_id}", web::get().to(get_submission))
        .route("/{submission_id}/info", web::get().to(get_submission_info));
}
