//! Controllers for requests starting with `/api/v0/main-frontend/exercises`.
use crate::{
    controllers::ControllerResult,
    domain::authorization::{authorize, Action, AuthUser, Resource},
    models::submissions::Submission,
    utils::pagination::Pagination,
};
use actix_web::web::{self, Json, ServiceConfig};
use futures::future;
use serde::Serialize;
use sqlx::PgPool;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, TS)]
pub struct ExerciseSubmissions {
    data: Vec<Submission>,
    total_pages: u32,
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/submissions` - Returns an exercise's submissions.

# Example
```json
{
    "data": [
        {
            "id": "f87e11e4-c6e5-40cc-bde7-7c371609643f",
            "created_at": "2021-03-08T21:50:51.065821",
            "updated_at": "2021-03-08T21:50:51.065821",
            "deleted_at": null,
            "exercise_id": "34e47a8e-d573-43be-8f23-79128cbb29b8",
            "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
            "exercise_task_id": "0125c21b-6afa-4652-89f7-56c48bd8ffe4",
            "data_json": null,
            "grading_id": null,
            "metadata": null,
            "user_id": "0589dc46-71a9-4220-baf2-d2f0dc77ef9a"
        }
    ],
    "total_pages": 2
}
```
 */
#[instrument(skip(pool))]
async fn get_exercise_submissions(
    pool: web::Data<PgPool>,
    request_exercise_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<Json<ExerciseSubmissions>> {
    let mut conn = pool.acquire().await?;
    let submission_count =
        crate::models::submissions::exercise_submission_count(&mut conn, &request_exercise_id);
    let mut conn = pool.acquire().await?;
    let course_id =
        crate::models::exercises::get_course_id(&mut conn, *request_exercise_id).await?;
    authorize(
        &mut conn,
        Action::View,
        user.id,
        Resource::Course(course_id),
    )
    .await?;
    let submissions = crate::models::submissions::exercise_submissions(
        &mut conn,
        &request_exercise_id,
        &pagination,
    );
    let (submission_count, submissions) = future::try_join(submission_count, submissions).await?;

    let total_pages = pagination.total_pages(submission_count);

    Ok(Json(ExerciseSubmissions {
        data: submissions,
        total_pages,
    }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_exercises_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{exercise_id}/submissions",
        web::get().to(get_exercise_submissions),
    );
}
