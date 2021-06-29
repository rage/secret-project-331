//! Controllers for requests starting with `/api/v0/course-material/exercises`.

use crate::domain::authorization::AuthUser;
use crate::{controllers::ApplicationResult, models::exercises::CourseMaterialExercise};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/course-material/exercises/:exercise_id` - Get exercise by id. Includes
relevant context so that doing the exercise is possible based on the response.

This endpoint does not expose exercise's private spec because it would
expose the correct answers to the user.

# Example
```json
{
  "exercise": {
    "id": "34e47a8e-d573-43be-8f23-79128cbb29b8",
    "created_at": "2021-04-28T10:49:31.360052",
    "updated_at": "2021-04-28T10:49:31.360052",
    "name": "Best exercise",
    "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "page_id": "f3b0d699-c9be-4d56-bd0a-9d40e5547e4d",
    "deadline": null,
    "deleted_at": null,
    "score_maximum": 1
  },
  "current_exercise_task": {
    "id": "0125c21b-6afa-4652-89f7-56c48bd8ffe4",
    "created_at": "2021-04-28T10:49:47.328126",
    "updated_at": "2021-04-28T10:49:47.328126",
    "exercise_id": "34e47a8e-d573-43be-8f23-79128cbb29b8",
    "exercise_type": "example-exercise",
    "assignment": [],
    "deleted_at": null,
    "public_spec": null,
    "spec_file_id": null
  },
  "exercise_status": {
    "score_given": null,
    "activity_progress": "Initialized",
    "grading_progress": "NotReady"
  }
}
```
 */
#[instrument(skip(pool))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    request_exercise_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ApplicationResult<Json<CourseMaterialExercise>> {
    let mut conn = pool.acquire().await?;
    let user_id = user.map(|u| u.id);
    let exercise = crate::models::exercises::get_course_material_exercise(
        &mut conn,
        user_id,
        *request_exercise_id,
    )
    .await?;
    Ok(Json(exercise))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_exercises_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exercise_id}", web::get().to(get_exercise));
}
