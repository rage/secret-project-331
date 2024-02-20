use models::{
    course_modules::{self, CourseModule},
    library::progressing::{CompletionRegistrationLink, UserCompletionInformation},
};

use crate::prelude::*;

/**
GET `/api/v0/main-frontend/course-modules/{course_module_id}`

Returns information about the course module.
*/
#[instrument(skip(pool))]
async fn get_course_module(
    course_module_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseModule>> {
    let mut conn = pool.acquire().await?;
    let course_module = course_modules::get_by_id(&mut conn, *course_module_id).await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Course(course_module.course_id),
    )
    .await?;
    token.authorized_ok(web::Json(course_module))
}

/**
GET `/api/v0/main-frontend/course-modules/{course_module_id}/user-completion`

Gets active users's completion for the course, if it exists.
*/
#[instrument(skip(pool))]
async fn get_course_module_completion_information_for_user(
    course_module_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<UserCompletionInformation>> {
    let mut conn = pool.acquire().await?;
    let course_module = course_modules::get_by_id(&mut conn, *course_module_id).await?;
    // Proper request validation is based on whether a completion exists for the user or not.
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Course(course_module.course_id),
    )
    .await?;
    let information = models::library::progressing::get_user_completion_information(
        &mut conn,
        user.id,
        &course_module,
    )
    .await?;
    token.authorized_ok(web::Json(information))
}

/**
GET `/api/v0/main-frontend/course-modules/{course_slug}/completion-registration-link`
*/
#[instrument(skip(pool))]
async fn get_course_module_completion_registration_link(
    course_module_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CompletionRegistrationLink>> {
    let mut conn = pool.acquire().await?;
    let course_module = course_modules::get_by_id(&mut conn, *course_module_id).await?;
    // Proper request validation is based on whether a completion exists for the user or not.
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Course(course_module.course_id),
    )
    .await?;
    let completion_registration_link =
        models::library::progressing::get_completion_registration_link_and_save_attempt(
            &mut conn,
            user.id,
            &course_module,
        )
        .await?;
    token.authorized_ok(web::Json(completion_registration_link))
}

async fn enable_or_disable_certificate_generation(
    params: web::Path<(Uuid, bool)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let (course_module_id, enabled) = params.into_inner();

    let course_module = course_modules::get_by_id(&mut conn, course_module_id).await?;
    // Proper request validation is based on whether a completion exists for the user or not.
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(course_module.course_id),
    )
    .await?;
    models::course_modules::update_certification_enabled(&mut conn, course_module_id, enabled)
        .await?;

    token.authorized_ok(web::Json(true))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_module_id}", web::get().to(get_course_module))
        .route(
            "/{course_module_id}/user-completion",
            web::get().to(get_course_module_completion_information_for_user),
        )
        .route(
            "/{course_module_id}/completion-registration-link",
            web::get().to(get_course_module_completion_registration_link),
        )
        .route(
            "/{course_module_id}/set-certificate-generation/{enabled}",
            web::post().to(enable_or_disable_certificate_generation),
        );
}
