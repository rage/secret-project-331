use headless_lms_models::user_course_exercise_service_variables;
use models::{course_modules, library::custom_view_exercises::CustomViewExerciseSubmissions};

use crate::{domain::authorization::skip_authorize, prelude::*};

/**
GET `/api/v0/course-material/course-modules/chapter/:chapter_id`

Returns course module id based on chapter.
*/
#[instrument(skip(pool))]
async fn get_course_module_id_by_chapter_id(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let module_id = course_modules::get_course_module_id_by_chapter(&mut conn, *chapter_id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(module_id))
}

/**
GET `/api/v0/course-material/course-modules/course/:course_instance_id`

Returns course module id based on chapter.
*/
#[instrument(skip(pool))]
async fn get_default_course_module_id_by_course_id(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let module = course_modules::get_default_by_course_id(&mut conn, *course_id).await?;
    let module_id = module.id;
    let token = skip_authorize();
    token.authorized_ok(web::Json(module_id))
}

/**
GET `/api/v0/course-material/course-modules/:course_module_id/exercise-tasks/:exercise_type/:course_instance_id`

Returns exercise submissions for user to be used in en exercise service Custom view.
*/
#[instrument(skip(pool))]
async fn get_user_course_module_exercises_by_exercise_type(
    path: web::Path<(Uuid, String, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CustomViewExerciseSubmissions>> {
    let mut conn = pool.acquire().await?;
    let (course_module_id, exercise_type, course_instance_id) = path.into_inner();
    let exercise_tasks = models::exercise_task_submissions::get_user_custom_view_exercise_tasks_by_module_and_exercise_type(
        &mut conn,
        &exercise_type,
        course_module_id,
        user.id,
    course_instance_id)
        .await?;

    let exercises = models::exercises::get_exercises_by_module_containing_exercise_type(
        &mut conn,
        &exercise_type,
        course_module_id,
    )
    .await?;
    let user_variables =
    user_course_exercise_service_variables::get_all_user_variables_for_user_and_course_instance_and_exercise_type(&mut conn, user.id, course_instance_id, &exercise_type).await?;
    let token = skip_authorize();
    let res = CustomViewExerciseSubmissions {
        exercise_tasks,
        exercises,
        user_variables,
    };

    token.authorized_ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/chapter/{chapter_id}",
        web::get().to(get_course_module_id_by_chapter_id),
    )
    .route(
        "/course/{course_id}",
        web::get().to(get_default_course_module_id_by_course_id),
    )
    .route(
        "/{course_module_id}/exercise-tasks/{exercise_type}/{course_instance_id}",
        web::get().to(get_user_course_module_exercises_by_exercise_type),
    );
}
