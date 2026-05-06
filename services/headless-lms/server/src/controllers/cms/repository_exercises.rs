use crate::prelude::*;
use models::repository_exercises::{self, RepositoryExercise};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(get_for_course))]
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

    let exercises = repository_exercises::get_for_course(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(exercises))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}", web::get().to(get_for_course));
}
