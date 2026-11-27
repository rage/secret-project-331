use crate::prelude::*;
use models::{
    CourseOrExamId,
    repository_exercises::{self, RepositoryExercise},
};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(get_for_course, get_for_exam))]
pub(crate) struct CmsRepositoryExercisesApiDoc;

#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{course_id}",
    operation_id = "getCmsRepositoryExercisesForCourse",
    tag = "cms_repository_exercises",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Repository exercises for course", body = Vec<RepositoryExercise>)
    )
)]
pub async fn get_for_course(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<RepositoryExercise>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        user.map(|u| u.id),
        Res::Course(*course_id),
    )
    .await?;

    let exercises =
        repository_exercises::get_for_course_or_exam(&mut conn, CourseOrExamId::Course(*course_id))
            .await?;
    token.authorized_ok(web::Json(exercises))
}

#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/exam/{exam_id}",
    operation_id = "getCmsRepositoryExercisesForExam",
    tag = "cms_repository_exercises",
    params(
        ("exam_id" = Uuid, Path, description = "Exam id")
    ),
    responses(
        (status = 200, description = "Repository exercises for exam", body = Vec<RepositoryExercise>)
    )
)]
pub async fn get_for_exam(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<RepositoryExercise>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;
    let exercises =
        repository_exercises::get_for_course_or_exam(&mut conn, CourseOrExamId::Exam(*exam_id))
            .await?;
    token.authorized_ok(web::Json(exercises))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}", web::get().to(get_for_course))
        .route("/exam/{exam_id}", web::get().to(get_for_exam));
}
