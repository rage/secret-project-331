use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{controllers::ApplicationResult, models::submissions::Submission};
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
) -> ApplicationResult<Json<Submission>> {
    let mut conn = pool.acquire().await?;
    let submission = crate::models::submissions::get_by_id(&mut conn, *submission_id).await?;
    Ok(Json(submission))
}

pub fn _add_submissions_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{submission_id}", web::get().to(get_submission));
}
