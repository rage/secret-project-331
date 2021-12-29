//! Controllers for requests starting with `/api/v0/course-material/exercises`.

use models::exercises::CourseMaterialExercise;

use crate::controllers::prelude::*;

/**
GET `/api/v0/course-material/exercises/:exercise_id` - Get exercise by id. Includes
relevant context so that doing the exercise is possible based on the response.

This endpoint does not expose exercise's private spec because it would
expose the correct answers to the user.

# Example
```json
{
  "exercise": {
    "id": "a4d42748-d561-4e04-a175-a299e373d35f",
    "created_at": "2021-07-02T05:33:05.229362Z",
    "updated_at": "2021-07-02T05:33:05.229362Z",
    "name": "Best exercise",
    "course_id": "355de239-02c0-4262-aa85-1c10e9d69dc3",
    "page_id": "15d4c6ab-6465-41e6-8860-b59d85fb9f1d",
    "deadline": null,
    "deleted_at": null,
    "score_maximum": 1,
    "order_number": 1
  },
  "current_exercise_task": {
    "id": "855d2212-9e2c-41f9-9937-39c65963555e",
    "exercise_id": "a4d42748-d561-4e04-a175-a299e373d35f",
    "exercise_type": "example-exercise",
    "assignment": {
      "name": "core/paragraph",
      "isValid": true,
      "clientId": "187a0aea-c088-4354-a1ea-f0cab082c065",
      "attributes": {
        "content": "Answer this question.",
        "dropCap": false
      },
      "innerBlocks": []
    },
    "public_spec": [
      {
        "id": "7ab2591c-b0f3-4543-9548-a113849b0f94",
        "name": "a"
      },
      {
        "id": "a833d1df-f27b-4fbf-b516-883a62c09d88",
        "name": "b"
      },
      {
        "id": "03d4b3d4-88af-4125-88b7-4ee052fd876f",
        "name": "c"
      }
    ]
  },
  "current_exercise_task_service_info": {
    "exercise_iframe_url": "http://project-331.local/example-exercise/exercise"
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
) -> ControllerResult<web::Json<CourseMaterialExercise>> {
    let mut conn = pool.acquire().await?;
    let user_id = user.map(|u| u.id);
    let exercise =
        models::exercises::get_course_material_exercise(&mut conn, user_id, *request_exercise_id)
            .await?;
    Ok(web::Json(exercise))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exercise_id}", web::get().to(get_exercise));
}
