use headless_lms_models::{course_instances, user_course_exercise_service_variables};
use models::{course_modules, library::custom_view_exercises::CustomViewExerciseSubmissions};
use utoipa::OpenApi;

use crate::{domain::authorization::authorize_access_to_course_material, prelude::*};

#[derive(OpenApi)]
#[openapi(paths(
    get_course_module_id_by_chapter_id,
    get_default_course_module_id_by_course_id,
    get_user_course_module_exercises_by_exercise_type
))]
pub(crate) struct CourseMaterialCourseModulesApiDoc;

/**
GET `/api/v0/course-material/course-modules/chapter/:chapter_id`

Returns course module id based on chapter.
*/
#[utoipa::path(
    get,
    path = "/chapter/{chapter_id}",
    operation_id = "getCourseMaterialModuleIdByChapterId",
    tag = "course-material-course-modules",
    params(
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Course module id", body = Uuid)
    )
)]
#[instrument(skip(pool))]
async fn get_course_module_id_by_chapter_id(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let token =
        authorize_access_to_course_material(&mut conn, Some(user.id), chapter.course_id).await?;
    let module_id = chapter.course_module_id;
    token.authorized_ok(web::Json(module_id))
}

/**
GET `/api/v0/course-material/course-modules/course/:course_instance_id`

Returns course module id based on chapter.
*/
#[utoipa::path(
    get,
    path = "/course/{course_id}",
    operation_id = "getCourseMaterialDefaultModuleIdByCourseId",
    tag = "course-material-course-modules",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Default course module id", body = Uuid)
    )
)]
#[instrument(skip(pool))]
async fn get_default_course_module_id_by_course_id(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_access_to_course_material(&mut conn, Some(user.id), *course_id).await?;
    let module = course_modules::get_default_by_course_id(&mut conn, *course_id).await?;
    let module_id = module.id;
    token.authorized_ok(web::Json(module_id))
}

/**
GET `/api/v0/course-material/course-modules/:course_module_id/exercise-tasks/:exercise_type/:course_instance_id`

Returns exercise submissions for user to be used in en exercise service Custom view.
*/
#[utoipa::path(
    get,
    path = "/{course_module_id}/exercise-tasks/{exercise_type}/{course_instance_id}",
    operation_id = "getCourseMaterialExerciseTasksByModuleAndType",
    tag = "course-material-course-modules",
    params(
        ("course_module_id" = Uuid, Path, description = "Course module id"),
        ("exercise_type" = String, Path, description = "Exercise type"),
        ("course_instance_id" = Uuid, Path, description = "Course instance id")
    ),
    responses(
        (
            status = 200,
            description = "Exercise tasks, exercises, and user variables",
            body = CustomViewExerciseSubmissions
        )
    )
)]
#[instrument(skip(pool))]
async fn get_user_course_module_exercises_by_exercise_type(
    path: web::Path<(Uuid, String, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CustomViewExerciseSubmissions>> {
    let mut conn = pool.acquire().await?;
    let (course_module_id, exercise_type, course_instance_id) = path.into_inner();
    let course_instance =
        course_instances::get_course_instance(&mut conn, course_instance_id).await?;
    let module = course_modules::get_by_id(&mut conn, course_module_id).await?;
    if module.course_id != course_instance.course_id {
        return Err(controller_err!(
            Forbidden,
            "Course module does not belong to the requested course instance".to_string()
        ));
    }
    let token =
        authorize_access_to_course_material(&mut conn, Some(user.id), module.course_id).await?;
    let course_id = course_instance.course_id;
    let exercise_tasks = models::exercise_task_submissions::get_user_custom_view_exercise_tasks_by_module_and_exercise_type(
        &mut conn,
        &exercise_type,
        course_module_id,
        user.id,
    course_id)
        .await?;

    let exercises = models::exercises::get_exercises_by_module_containing_exercise_type(
        &mut conn,
        &exercise_type,
        course_module_id,
    )
    .await?;
    let user_variables =
    user_course_exercise_service_variables::get_all_user_variables_for_user_and_course_and_exercise_type(&mut conn, user.id, course_id, &exercise_type).await?;
    let res = CustomViewExerciseSubmissions {
        exercise_tasks,
        exercises,
        user_variables,
    };

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/course-material/course-modules/course/:course_instance_id`

Returns course module metadata.
*/
// #[utoipa::path(
//     get,
//     path = "/course/{course_id}",
//     operation_id = "getCourseMaterialDefaultModuleIdByCourseId",
//     tag = "course-material-course-modules",
//     params(
//         ("course_id" = Uuid, Path, description = "Course id")
//     ),
//     responses(
//         (status = 200, description = "Course module metadata", body = )
//     )
// )]
// #[instrument(skip(pool))]
// async fn get_course_module_meta_data(
//     course_id: web::Path<Uuid>,
//     pool: web::Data<PgPool>,
// ) -> ControllerResult<web::Json<>> {

// }

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
