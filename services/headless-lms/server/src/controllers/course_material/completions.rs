//! Controllers for requests starting with `/api/v0/course-material/completions`.

use models::library::progressing::{CompletionRegistrationLink, UserCompletionInformation};

use crate::controllers::prelude::*;

/**
GET `/api/v0/course-material/completions/current-by-course-slug/{course_slug}`

Gets active users's completion for the course, if it exists.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_default_module_completion_information(
    course_slug: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<UserCompletionInformation>> {
    let mut conn = pool.acquire().await?;
    let course = models::courses::get_course_by_slug(&mut conn, course_slug.as_str()).await?;
    let information =
        models::library::progressing::get_user_completion_information(&mut conn, user.id, &course)
            .await?;
    // Don't commit like this
    let token = skip_authorize()?;
    token.authorized_ok(web::Json(information))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn get_completion_link_for_course(
    course_slug: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CompletionRegistrationLink>> {
    let mut conn = pool.acquire().await?;
    let course = models::courses::get_course_by_slug(&mut conn, course_slug.as_str()).await?;
    let completion_registration_link =
        models::library::progressing::get_completion_registration_link_and_save_attempt(
            &mut conn, user.id, &course,
        )
        .await?;
    // Don't commit like this
    let token = skip_authorize()?;
    token.authorized_ok(web::Json(completion_registration_link))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/current-by-course-slug/{course_slug}",
        web::get().to(get_default_module_completion_information),
    )
    .route(
        "/registration-link-by-course-slug/{course_slug}",
        web::get().to(get_completion_link_for_course),
    );
}
