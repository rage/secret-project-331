//! Controllers for requests starting with `/api/v0/main-frontend/{course_id}/stats`.

use crate::{domain::authorization::authorize, prelude::*};
use models::library::course_stats::{AverageMetric, CohortActivity, CountResult};
use uuid::Uuid;

/// GET `/api/v0/main-frontend/{course_id}/stats/total-users-started-course`
#[instrument(skip(pool))]
async fn get_total_users_started_course(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<CountResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = models::library::course_stats::get_total_users_started_course(&mut conn, *course_id)
        .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/total-users-completed`
#[instrument(skip(pool))]
async fn get_total_users_completed_course(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<CountResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res =
        models::library::course_stats::get_total_users_completed_course(&mut conn, *course_id)
            .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/total-users-returned-exercises`
#[instrument(skip(pool))]
async fn get_total_users_returned_at_least_one_exercise(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<CountResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = models::library::course_stats::get_total_users_returned_at_least_one_exercise(
        &mut conn, *course_id,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/weekly-users-starting`
#[instrument(skip(pool))]
async fn get_weekly_unique_users_starting(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res =
        models::library::course_stats::get_weekly_unique_users_starting(&mut conn, *course_id)
            .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/daily-users-starting/{days}`
#[instrument(skip(pool))]
async fn get_daily_unique_users_starting_last_n_days(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, days_limit) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let res = models::library::course_stats::get_daily_unique_users_starting_last_n_days(
        &mut conn, course_id, days_limit,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/monthly-users-starting`
#[instrument(skip(pool))]
async fn get_monthly_unique_users_starting(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res =
        models::library::course_stats::get_monthly_unique_users_starting(&mut conn, *course_id)
            .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/monthly-first-submissions`
#[instrument(skip(pool))]
async fn get_monthly_first_exercise_submissions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = models::library::course_stats::get_monthly_first_exercise_submissions(
        &mut conn, *course_id,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/daily-first-submissions/{days}`
#[instrument(skip(pool))]
async fn get_daily_first_exercise_submissions_last_n_days(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, days_limit) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let res = models::library::course_stats::get_daily_first_exercise_submissions_last_n_days(
        &mut conn, course_id, days_limit,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/monthly-returning-exercises`
#[instrument(skip(pool))]
async fn get_monthly_users_returning_exercises(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res =
        models::library::course_stats::get_monthly_users_returning_exercises(&mut conn, *course_id)
            .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/daily-returning-exercises/{days}`
#[instrument(skip(pool))]
async fn get_daily_users_returning_exercises_last_n_days(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, days_limit) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let res = models::library::course_stats::get_daily_users_returning_exercises_last_n_days(
        &mut conn, course_id, days_limit,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/monthly-completions`
#[instrument(skip(pool))]
async fn get_monthly_course_completions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = models::library::course_stats::get_monthly_course_completions(&mut conn, *course_id)
        .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/daily-completions/{days}`
#[instrument(skip(pool))]
async fn get_daily_course_completions_last_n_days(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, days_limit) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let res = models::library::course_stats::get_daily_course_completions_last_n_days(
        &mut conn, course_id, days_limit,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/avg-time-to-first-submission`
#[instrument(skip(pool))]
async fn get_avg_time_to_first_submission_by_month(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<AverageMetric>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let res = models::library::course_stats::get_avg_time_to_first_submission_by_month(
        &mut conn, *course_id,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/cohort-weekly-activity/{months}`
#[instrument(skip(pool))]
async fn get_cohort_weekly_activity(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<web::Json<Vec<CohortActivity>>> {
    let (course_id, months_limit) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let res = models::library::course_stats::get_cohort_weekly_activity(
        &mut conn,
        course_id,
        months_limit,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/cohort-daily-activity/{days}`
#[instrument(skip(pool))]
async fn get_cohort_daily_activity(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<web::Json<Vec<CohortActivity>>> {
    let (course_id, days_limit) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let res =
        models::library::course_stats::get_cohort_daily_activity(&mut conn, course_id, days_limit)
            .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/all-language-versions/total-users-started`
#[instrument(skip(pool))]
async fn get_total_users_started_all_language_versions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
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

    let res =
        models::library::course_stats::get_total_users_started_all_language_versions_of_a_course(
            &mut conn,
            language_group_id,
        )
        .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/all-language-versions/monthly-users-starting`
#[instrument(skip(pool))]
async fn get_monthly_unique_users_starting_all_language_versions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let language_group_id = course.course_language_group_id;

    let res =
        models::library::course_stats::get_monthly_unique_users_starting_all_language_versions(
            &mut conn,
            language_group_id,
        )
        .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/all-language-versions/daily-users-starting/{days}`
#[instrument(skip(pool))]
async fn get_daily_unique_users_starting_all_language_versions_last_n_days(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, days_limit) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, course_id).await?;
    let language_group_id = course.course_language_group_id;

    let res = models::library::course_stats::get_daily_unique_users_starting_all_language_versions_last_n_days(
        &mut conn,
        language_group_id,
        days_limit,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/all-language-versions/monthly-completions`
#[instrument(skip(pool))]
async fn get_monthly_course_completions_all_language_versions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let language_group_id = course.course_language_group_id;

    let res = models::library::course_stats::get_monthly_course_completions_all_language_versions(
        &mut conn,
        language_group_id,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/{course_id}/stats/all-language-versions/daily-completions/{days}`
#[instrument(skip(pool))]
async fn get_daily_course_completions_all_language_versions_last_n_days(
    pool: web::Data<PgPool>,
    user: AuthUser,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<web::Json<Vec<CountResult>>> {
    let (course_id, days_limit) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, course_id).await?;
    let language_group_id = course.course_language_group_id;

    let res = models::library::course_stats::get_daily_course_completions_all_language_versions_last_n_days(
        &mut conn,
        language_group_id,
        days_limit,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

// Update the configure function to use the new prefix
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
        "/weekly-users-starting",
        web::get().to(get_weekly_unique_users_starting),
    )
    .route(
        "/monthly-users-starting",
        web::get().to(get_monthly_unique_users_starting),
    )
    .route(
        "/daily-users-starting/{days}",
        web::get().to(get_daily_unique_users_starting_last_n_days),
    )
    .route(
        "/monthly-first-submissions",
        web::get().to(get_monthly_first_exercise_submissions),
    )
    .route(
        "/daily-first-submissions/{days}",
        web::get().to(get_daily_first_exercise_submissions_last_n_days),
    )
    .route(
        "/monthly-returning-exercises",
        web::get().to(get_monthly_users_returning_exercises),
    )
    .route(
        "/daily-returning-exercises/{days}",
        web::get().to(get_daily_users_returning_exercises_last_n_days),
    )
    .route(
        "/monthly-completions",
        web::get().to(get_monthly_course_completions),
    )
    .route(
        "/daily-completions/{days}",
        web::get().to(get_daily_course_completions_last_n_days),
    )
    .route(
        "/avg-time-to-first-submission",
        web::get().to(get_avg_time_to_first_submission_by_month),
    )
    .route(
        "/cohort-weekly-activity/{months}",
        web::get().to(get_cohort_weekly_activity),
    )
    .route(
        "/cohort-daily-activity/{days}",
        web::get().to(get_cohort_daily_activity),
    )
    .route(
        "/all-language-versions/total-users-started",
        web::get().to(get_total_users_started_all_language_versions),
    )
    .route(
        "/all-language-versions/monthly-users-starting",
        web::get().to(get_monthly_unique_users_starting_all_language_versions),
    )
    .route(
        "/all-language-versions/daily-users-starting/{days}",
        web::get().to(get_daily_unique_users_starting_all_language_versions_last_n_days),
    )
    .route(
        "/all-language-versions/monthly-completions",
        web::get().to(get_monthly_course_completions_all_language_versions),
    )
    .route(
        "/all-language-versions/daily-completions/{days}",
        web::get().to(get_daily_course_completions_all_language_versions_last_n_days),
    );
}
