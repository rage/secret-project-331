use crate::prelude::*;
use models::repository_exercises::{self, RepositoryExercise};

#[generated_doc]
#[instrument(skip(pool))]
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
