//! The course's credit registrations as a downloadable csv.

use crate::domain::csv_export::{
    credit_registrations_export::CreditRegistrationsExportOperation, general_export,
};
use crate::prelude::*;

/**
GET `/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/export` - Every credit
registration of the course as csv.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/courses/{course_id}/export",
    operation_id = "exportCourseCreditRegistrations",
    tag = "course-credit-registrations",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses(
        (status = 200, description = "The course's credit registrations", body = String, content_type = "text/csv")
    )
)]
pub async fn export_course_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewAndManageCreditRegistrations,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, *course_id).await?;
    general_export(
        pool,
        &format!(
            "attachment; filename=\"{} - Credit registrations {}.csv\"",
            course.name,
            Utc::now().format("%Y-%m-%d")
        ),
        CreditRegistrationsExportOperation {
            course_id: *course_id,
        },
        token,
    )
    .await
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/courses/{course_id}/export",
        web::get().to(export_course_credit_registrations),
    );
}
