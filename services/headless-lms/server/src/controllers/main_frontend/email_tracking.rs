use crate::{domain::authorization::authorize, prelude::*};
use models::email_tracking::EmailEngagementStats;
use utoipa::OpenApi;

// Minimal 1x1 transparent GIF (43 bytes)
const TRACKING_PIXEL: &[u8] = &[
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
];

#[derive(OpenApi)]
#[openapi(paths(open_tracking_pixel, click_redirect, get_email_tracking_stats))]
pub(crate) struct MainFrontendEmailTrackingApiDoc;

/**
GET `/api/v0/main-frontend/email-tracking/open/{delivery_id}` - Email open tracking pixel
*/
#[utoipa::path(
    get,
    path = "/open/{delivery_id}",
    operation_id = "openTrackingPixel",
    tag = "email-tracking",
    responses(
        (status = 200, description = "1x1 tracking pixel", content_type = "image/gif")
    )
)]
#[instrument(skip(pool, req))]
pub async fn open_tracking_pixel(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    req: HttpRequest,
) -> HttpResponse {
    let delivery_id = path.into_inner();
    let user_agent = req
        .headers()
        .get("User-Agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let pool_clone = pool.get_ref().clone();
    tokio::spawn(async move {
        match pool_clone.acquire().await {
            Ok(mut conn) => {
                if let Err(err) =
                    models::email_tracking::insert_email_open(&mut conn, delivery_id, user_agent)
                        .await
                {
                    tracing::warn!("Failed to record email open for {}: {}", delivery_id, err);
                }
            }
            Err(err) => {
                tracing::warn!(
                    "Failed to acquire connection for email open tracking: {}",
                    err
                );
            }
        }
    });

    HttpResponse::Ok()
        .insert_header(("Content-Type", "image/gif"))
        .insert_header(("Cache-Control", "no-store"))
        .body(TRACKING_PIXEL)
}

/**
GET `/api/v0/main-frontend/email-tracking/click/{click_id}` - Email link click redirect
*/
#[utoipa::path(
    get,
    path = "/click/{click_id}",
    operation_id = "clickRedirect",
    tag = "email-tracking",
    responses(
        (status = 302, description = "Redirect to destination URL"),
        (status = 404, description = "Unknown click ID")
    )
)]
#[instrument(skip(pool))]
pub async fn click_redirect(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> ControllerResult<HttpResponse> {
    let click_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let dest = models::email_tracking::record_link_click(&mut conn, click_id).await?;
    match dest {
        Some(url) => token.authorized_ok(
            HttpResponse::Found()
                .insert_header(("Location", url))
                .finish(),
        ),
        None => Err(ControllerError::new(
            ControllerErrorType::NotFound,
            "Unknown click ID".to_string(),
            None,
        )),
    }
}

/**
GET `/api/v0/main-frontend/email-tracking/stats` - Email engagement stats per template type (global admin only)
*/
#[utoipa::path(
    get,
    path = "/stats",
    operation_id = "getEmailTrackingStats",
    tag = "email-tracking",
    responses(
        (status = 200, description = "Email engagement stats per template type", body = [EmailEngagementStats])
    )
)]
#[instrument(skip(pool))]
pub async fn get_email_tracking_stats(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<EmailEngagementStats>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewStats,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let stats = models::email_tracking::get_per_template_engagement_stats(&mut conn).await?;
    token.authorized_ok(web::Json(stats))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/open/{delivery_id}", web::get().to(open_tracking_pixel))
        .route("/click/{click_id}", web::get().to(click_redirect))
        .route("/stats", web::get().to(get_email_tracking_stats));
}
