//! Controllers for requests starting with `/api/v0/main-frontend/global-stats`.

use models::library::global_stats::{GlobalCourseModuleStatEntry, GlobalStatEntry};

use crate::{domain::authorization::authorize, prelude::*};

/**
GET `/api/v0/main-frontend/global-stats/number-of-people-completed-a-course`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_number_of_people_completed_a_course(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<GlobalStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res =
        models::library::global_stats::get_number_of_people_completed_a_course(&mut conn).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/global-stats/number-of-people-registered-completion-to-study-registry`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_number_of_people_registered_completion_to_study_registry(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<GlobalStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::library::global_stats::get_number_of_people_registered_completion_to_study_registry(&mut conn).await?;

    token.authorized_ok(web::Json(res))
}

/**
 * GET `/api/v0/main-frontend/global-stats/number-of-people-done-at-least-one-exercise`
 */
#[generated_doc]
#[instrument(skip(pool))]
async fn get_number_of_people_done_at_least_one_exercise(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<GlobalStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res =
        models::library::global_stats::get_number_of_people_done_at_least_one_exercise(&mut conn)
            .await?;

    token.authorized_ok(web::Json(res))
}

/**
 * GET `/api/v0/main-frontend/global-stats/number-of-people-started-course`
 */
#[generated_doc]
#[instrument(skip(pool))]
async fn get_number_of_people_started_course(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<GlobalStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::library::global_stats::get_number_of_people_started_course(&mut conn).await?;

    token.authorized_ok(web::Json(res))
}

/**
 * GET `/api/v0/main-frontend/global-stats/course-module-stats-by-completions-registered-to-study-registry`
 */
#[generated_doc]
#[instrument(skip(pool))]
async fn get_course_module_stats_by_completions_registered_to_study_registry(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<GlobalCourseModuleStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::library::global_stats::get_course_module_stats_by_completions_registered_to_study_registry(&mut conn).await?;

    token.authorized_ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/number-of-people-completed-a-course",
        web::get().to(get_number_of_people_completed_a_course),
    )
    .route(
        "/number-of-people-registered-completion-to-study-registry",
        web::get().to(get_number_of_people_registered_completion_to_study_registry),
    )
    .route(
        "/number-of-people-done-at-least-one-exercise",
        web::get().to(get_number_of_people_done_at_least_one_exercise),
    )
    .route(
        "/number-of-people-started-course",
        web::get().to(get_number_of_people_started_course),
    )
    .route(
        "/course-module-stats-by-completions-registered-to-study-registry",
        web::get().to(get_course_module_stats_by_completions_registered_to_study_registry),
    );
}
