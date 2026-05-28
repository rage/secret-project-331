use crate::{domain::authorization::authorize, prelude::*};
use models::ects_reminder_email_sends::{EctsReminderCourseStats, EctsReminderStats};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(get_global_stats, get_per_course_stats,))]
pub(crate) struct MainFrontendEctsReminderStatsApiDoc;

/**
GET `/api/v0/main-frontend/ects-reminder-stats` - Global ECTS reminder campaign statistics (global admin only)
*/
#[utoipa::path(
    get,
    path = "",
    operation_id = "getEctsReminderStats",
    tag = "ects-reminder-stats",
    responses(
        (status = 200, description = "Global ECTS reminder stats", body = EctsReminderStats)
    )
)]
#[instrument(skip(pool))]
pub async fn get_global_stats(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EctsReminderStats>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let stats = models::ects_reminder_email_sends::get_global_stats(&mut conn).await?;
    token.authorized_ok(web::Json(stats))
}

/**
GET `/api/v0/main-frontend/ects-reminder-stats/by-course` - Per-course ECTS reminder statistics (global admin only)
*/
#[utoipa::path(
    get,
    path = "/by-course",
    operation_id = "getEctsReminderStatsByCourse",
    tag = "ects-reminder-stats",
    responses(
        (status = 200, description = "Per-course ECTS reminder stats", body = [EctsReminderCourseStats])
    )
)]
#[instrument(skip(pool))]
pub async fn get_per_course_stats(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<EctsReminderCourseStats>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let stats = models::ects_reminder_email_sends::get_per_course_stats(&mut conn).await?;
    token.authorized_ok(web::Json(stats))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_global_stats))
        .route("/by-course", web::get().to(get_per_course_stats));
}
