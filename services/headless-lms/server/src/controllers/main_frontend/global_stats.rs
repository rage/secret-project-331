//! Controllers for requests starting with `/api/v0/main-frontend/global-stats`.

use crate::{domain::authorization::authorize, prelude::*};

use models::library::TimeGranularity;
use models::library::global_stats::{
    CourseCompletionStats, DomainCompletionStats, GlobalCourseModuleStatEntry, GlobalStatEntry,
};
use std::collections::HashMap;

/**
GET `/api/v0/main-frontend/global-stats/number-of-people-completed-a-course`

Query parameters:
- granularity: String - Either "year" or "month" (defaults to "year")
*/
#[instrument(skip(pool))]
async fn get_number_of_people_completed_a_course(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<HashMap<String, String>>,
) -> ControllerResult<web::Json<Vec<GlobalStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let granularity = query
        .get("granularity")
        .map(|s| s.parse().unwrap_or(TimeGranularity::Year))
        .unwrap_or(TimeGranularity::Year);

    let res = models::library::global_stats::get_number_of_people_completed_a_course(
        &mut conn,
        granularity,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/global-stats/number-of-people-registered-completion-to-study-registry`

Query parameters:
- granularity: String - Either "year" or "month" (defaults to "year")
*/
#[instrument(skip(pool))]
async fn get_number_of_people_registered_completion_to_study_registry(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<HashMap<String, String>>,
) -> ControllerResult<web::Json<Vec<GlobalStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let granularity = query
        .get("granularity")
        .map(|s| s.parse().unwrap_or(TimeGranularity::Year))
        .unwrap_or(TimeGranularity::Year);

    let res = models::library::global_stats::get_number_of_people_registered_completion_to_study_registry(&mut conn, granularity).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/global-stats/number-of-people-done-at-least-one-exercise`

Query parameters:
- granularity: String - Either "year" or "month" (defaults to "year")
*/
#[instrument(skip(pool))]
async fn get_number_of_people_done_at_least_one_exercise(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<HashMap<String, String>>,
) -> ControllerResult<web::Json<Vec<GlobalStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let granularity = query
        .get("granularity")
        .map(|s| s.parse().unwrap_or(TimeGranularity::Year))
        .unwrap_or(TimeGranularity::Year);

    let res = models::library::global_stats::get_number_of_people_done_at_least_one_exercise(
        &mut conn,
        granularity,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/global-stats/number-of-people-started-course`

Query parameters:
- granularity: String - Either "year" or "month" (defaults to "year")
*/
#[instrument(skip(pool))]
async fn get_number_of_people_started_course(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<HashMap<String, String>>,
) -> ControllerResult<web::Json<Vec<GlobalStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let granularity = query
        .get("granularity")
        .map(|s| s.parse().unwrap_or(TimeGranularity::Year))
        .unwrap_or(TimeGranularity::Year);

    let res =
        models::library::global_stats::get_number_of_people_started_course(&mut conn, granularity)
            .await?;

    token.authorized_ok(web::Json(res))
}

/**
 * GET `/api/v0/main-frontend/global-stats/course-module-stats-by-completions-registered-to-study-registry`
 *
 * Query parameters:
 * - granularity: String - Either "year" or "month" (defaults to "year")
 */
#[instrument(skip(pool))]
async fn get_course_module_stats_by_completions_registered_to_study_registry(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<HashMap<String, String>>,
) -> ControllerResult<web::Json<Vec<GlobalCourseModuleStatEntry>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let granularity = query
        .get("granularity")
        .map(|s| s.parse().unwrap_or(TimeGranularity::Year))
        .unwrap_or(TimeGranularity::Year);

    let res = models::library::global_stats::get_course_module_stats_by_completions_registered_to_study_registry(&mut conn, granularity).await?;

    token.authorized_ok(web::Json(res))
}

/**
 * GET `/api/v0/main-frontend/global-stats/completion-stats-by-email-domain`
 *
 * Query parameters:
 * - year: Optional<i32> - Filter results to specific year (e.g. ?year=2023)
 */
#[instrument(skip(pool))]
async fn get_completion_stats_by_email_domain(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<HashMap<String, String>>,
) -> ControllerResult<web::Json<Vec<DomainCompletionStats>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let year = query.get("year").and_then(|y| y.parse::<i32>().ok());

    let res = models::library::global_stats::get_completion_stats_by_email_domain(&mut conn, year)
        .await?;

    token.authorized_ok(web::Json(res))
}

/**
 * GET `/api/v0/main-frontend/global-stats/course-completion-stats-for-email-domain`
 *
 * Query parameters:
 * - email_domain: String - The email domain to get stats for (required)
 * - year: Optional<i32> - Filter results to specific year (e.g. ?year=2023)
 */
#[instrument(skip(pool))]
async fn get_course_completion_stats_for_email_domain(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<HashMap<String, String>>,
) -> ControllerResult<web::Json<Vec<CourseCompletionStats>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let email_domain = query
        .get("email_domain")
        .ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                "email_domain is required".to_string(),
                None,
            )
        })?
        .to_string();

    let year = query.get("year").and_then(|y| y.parse::<i32>().ok());

    let res = models::library::global_stats::get_course_completion_stats_for_email_domain(
        &mut conn,
        email_domain,
        year,
    )
    .await?;

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
    )
    .route(
        "/completion-stats-by-email-domain",
        web::get().to(get_completion_stats_by_email_domain),
    )
    .route(
        "/course-completion-stats-for-email-domain",
        web::get().to(get_course_completion_stats_for_email_domain),
    );
}
