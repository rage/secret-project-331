//! Controllers for requests starting with `/api/v0/main-frontend/{course_id}/stats`.

use crate::{domain::authorization::authorize, prelude::*};
use headless_lms_models::library::TimeGranularity;
use headless_lms_models::ModelError;
use headless_lms_utils::prelude::{UtilError, UtilErrorType};
use models::library::course_stats::{AverageMetric, CohortActivity, CountResult};
use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;

const CACHE_DURATION: Duration = Duration::from_secs(3600);

/// Helper function to handle caching for stats endpoints
async fn cached_stats_query<F, Fut, T>(
    cache: &Cache,
    endpoint: &str,
    course_id: Uuid,
    extra_params: Option<&str>,
    duration: Duration,
    f: F,
) -> Result<T, ControllerError>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T, ModelError>>,
    T: serde::Serialize + serde::de::DeserializeOwned,
{
    let cache_key = match extra_params {
        Some(params) => format!("stats:{}:{}:{}", endpoint, course_id, params),
        None => format!("stats:{}:{}", endpoint, course_id),
    };

    let wrapped_f = || async {
        f().await.map_err(|err| {
            UtilError::new(UtilErrorType::Other, "Failed to get data", Some(err.into()))
        })
    };

    cache
        .get_or_set(cache_key, duration, wrapped_f)
        .await
        .map_err(|_| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to get data",
                None,
            )
        })
}

/// GET `/api/v0/main-frontend/{course_id}/stats/total-users-started-course`
#[instrument(skip(pool))]
async fn get_total_users_started_course(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<CountResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = cached_stats_query(
        &cache,
        "total-users-started-course",
        *course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::get_total_users_started_course(&mut conn, *course_id)
                .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/total-users-completed`
#[instrument(skip(pool))]
async fn get_total_users_completed_course(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<CountResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = cached_stats_query(
        &cache,
        "total-users-completed",
        *course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::get_total_users_completed_course(&mut conn, *course_id)
                .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/total-users-returned-exercises`
#[instrument(skip(pool))]
async fn get_total_users_returned_at_least_one_exercise(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<CountResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = cached_stats_query(
        &cache,
        "total-users-returned-exercises",
        *course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::get_total_users_returned_at_least_one_exercise(
                &mut conn, *course_id,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/avg-time-to-first-submission/{granularity}/{time_window}`
///
/// Returns average time to first submission statistics with specified time granularity and window.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_avg_time_to_first_submission_history(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<Vec<AverageMetric>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!(
        "avg-time-to-first-submission-{}-{}",
        granularity, time_window
    );
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::avg_time_to_first_submission_history(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/cohort-activity/{granularity}/{history_window}/{tracking_window}`
#[instrument(skip(pool))]
async fn get_cohort_activity_history(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<Vec<CohortActivity>>> {
    let (course_id, granularity, history_window, tracking_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let res = cached_stats_query(
        &cache,
        &format!(
            "cohort-activity-{}-{}-{}",
            granularity, history_window, tracking_window
        ),
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::get_cohort_activity_history(
                &mut conn,
                course_id,
                granularity,
                history_window,
                tracking_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/all-language-versions/total-users-started`
#[instrument(skip(pool))]
async fn get_total_users_started_all_language_versions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<CountResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    // Get the course to find its language group ID
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let language_group_id = course.course_language_group_id;

    let res = cached_stats_query(
        &cache,
        "all-language-versions-total-users-started",
        language_group_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::get_total_users_started_all_language_versions_of_a_course(
                &mut conn,
                language_group_id,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/all-language-versions/users-starting-history/{granularity}/{time_window}`
///
/// Returns unique users starting statistics for all language versions with specified time granularity and window.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_unique_users_starting_history_all_language_versions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    // Get the course to find its language group ID
    let course = models::courses::get_course(&mut conn, course_id).await?;
    let language_group_id = course.course_language_group_id;

    let cache_key = format!(
        "all-language-versions-users-starting-{}-{}",
        granularity, time_window
    );
    let res = cached_stats_query(
        &cache,
        &cache_key,
        language_group_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::unique_users_starting_history_all_language_versions(
                &mut conn,
                language_group_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/all-language-versions/completions-history/{granularity}/{time_window}`
///
/// Returns completion statistics for all language versions with specified time granularity and window.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_course_completions_history(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, granularity, time_window) = path.into_inner();

    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!("completions-{}-{}", granularity, time_window);
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::course_completions_history(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/users-returning-exercises-history/{granularity}/{time_window}`
///
/// Returns users returning exercises statistics with specified time granularity and window.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_users_returning_exercises_history(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!("users-returning-{}-{}", granularity, time_window);
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::users_returning_exercises_history(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/first-submissions-history/{granularity}/{time_window}`
///
/// Returns first exercise submission statistics with specified time granularity and window.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_first_exercise_submissions_history(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!("first-submissions-{}-{}", granularity, time_window);
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::first_exercise_submissions_history(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/users-starting-history/{granularity}/{time_window}`
///
/// Returns unique users starting statistics with specified time granularity and window.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_unique_users_starting_history(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!("users-starting-{}-{}", granularity, time_window);
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::unique_users_starting_history(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/by-instance/total-users-started-course`
#[instrument(skip(pool))]
async fn get_total_users_started_course_by_instance(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<HashMap<Uuid, CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = cached_stats_query(
        &cache,
        "total-users-started-course-by-instance",
        *course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::get_total_users_started_course_by_instance(
                &mut conn, *course_id,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/by-instance/total-users-completed`
#[instrument(skip(pool))]
async fn get_total_users_completed_course_by_instance(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<HashMap<Uuid, CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = cached_stats_query(
        &cache,
        "total-users-completed-by-instance",
        *course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::get_total_users_completed_course_by_instance(
                &mut conn, *course_id,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/by-instance/total-users-returned-exercises`
#[instrument(skip(pool))]
async fn get_total_users_returned_at_least_one_exercise_by_instance(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<HashMap<Uuid, CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = cached_stats_query(
        &cache,
        "total-users-returned-exercises-by-instance",
        *course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::get_total_users_returned_at_least_one_exercise_by_instance(
                &mut conn, *course_id,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/by-instance/completions-history/{granularity}/{time_window}`
///
/// Returns course completion statistics with specified time granularity and window, grouped by course instance.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_course_completions_history_by_instance(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<HashMap<Uuid, Vec<CountResult>>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!("completions-by-instance-{}-{}", granularity, time_window);
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::course_completions_history_by_instance(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/by-instance/users-starting-history/{granularity}/{time_window}`
///
/// Returns unique users starting statistics with specified time granularity and window, grouped by course instance.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_unique_users_starting_history_by_instance(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<HashMap<Uuid, Vec<CountResult>>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!("users-starting-by-instance-{}-{}", granularity, time_window);
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::unique_users_starting_history_by_instance(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/by-instance/first-submissions-history/{granularity}/{time_window}`
///
/// Returns first exercise submission statistics with specified time granularity and window, grouped by course instance.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_first_exercise_submissions_history_by_instance(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<HashMap<Uuid, Vec<CountResult>>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!(
        "first-submissions-by-instance-{}-{}",
        granularity, time_window
    );
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::first_exercise_submissions_history_by_instance(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/by-instance/users-returning-exercises-history/{granularity}/{time_window}`
///
/// Returns users returning exercises statistics with specified time granularity and window, grouped by course instance.
/// - granularity: "year", "month", or "day"
/// - time_window: number of time units to look back
#[instrument(skip(pool))]
async fn get_users_returning_exercises_history_by_instance(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, TimeGranularity, u16)>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<HashMap<Uuid, Vec<CountResult>>>> {
    let (course_id, granularity, time_window) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let cache_key = format!(
        "users-returning-by-instance-{}-{}",
        granularity, time_window
    );
    let res = cached_stats_query(
        &cache,
        &cache_key,
        course_id,
        None,
        CACHE_DURATION,
        || async {
            models::library::course_stats::users_returning_exercises_history_by_instance(
                &mut conn,
                course_id,
                granularity,
                time_window,
            )
            .await
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route(
        "/total-users-started-course",
        web::get().to(get_total_users_started_course),
    )
    .route(
        "/total-users-completed",
        web::get().to(get_total_users_completed_course),
    )
    .route(
        "/total-users-returned-exercises",
        web::get().to(get_total_users_returned_at_least_one_exercise),
    )
    .route(
        "/by-instance/total-users-started-course",
        web::get().to(get_total_users_started_course_by_instance),
    )
    .route(
        "/by-instance/total-users-completed",
        web::get().to(get_total_users_completed_course_by_instance),
    )
    .route(
        "/by-instance/total-users-returned-exercises",
        web::get().to(get_total_users_returned_at_least_one_exercise_by_instance),
    )
    .route(
        "/first-submissions-history/{granularity}/{time_window}",
        web::get().to(get_first_exercise_submissions_history),
    )
    .route(
        "/by-instance/first-submissions-history/{granularity}/{time_window}",
        web::get().to(get_first_exercise_submissions_history_by_instance),
    )
    .route(
        "/users-returning-exercises-history/{granularity}/{time_window}",
        web::get().to(get_users_returning_exercises_history),
    )
    .route(
        "/by-instance/users-returning-exercises-history/{granularity}/{time_window}",
        web::get().to(get_users_returning_exercises_history_by_instance),
    )
    .route(
        "/completions-history/{granularity}/{time_window}",
        web::get().to(get_course_completions_history),
    )
    .route(
        "/by-instance/completions-history/{granularity}/{time_window}",
        web::get().to(get_course_completions_history_by_instance),
    )
    .route(
        "/users-starting-history/{granularity}/{time_window}",
        web::get().to(get_unique_users_starting_history),
    )
    .route(
        "/by-instance/users-starting-history/{granularity}/{time_window}",
        web::get().to(get_unique_users_starting_history_by_instance),
    )
    .route(
        "/avg-time-to-first-submission/{granularity}/{time_window}",
        web::get().to(get_avg_time_to_first_submission_history),
    )
    .route(
        "/cohort-activity/{granularity}/{history_window}/{tracking_window}",
        web::get().to(get_cohort_activity_history),
    )
    .route(
        "/all-language-versions/total-users-started",
        web::get().to(get_total_users_started_all_language_versions),
    )
    .route(
        "/all-language-versions/users-starting-history/{granularity}/{time_window}",
        web::get().to(get_unique_users_starting_history_all_language_versions),
    );
}
