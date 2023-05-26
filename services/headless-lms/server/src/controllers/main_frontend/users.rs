use models::{course_instance_enrollments::CourseInstanceEnrollmentsInfo, users::User};

use crate::prelude::*;

/**
GET `/api/v0/main-frontend/users/:id`
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_user(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<User>> {
    let mut conn = pool.acquire().await?;
    let user = models::users::get_by_id(&mut conn, *user_id).await?;

    let token = authorize(&mut conn, Act::Teach, Some(*user_id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(user))
}

/**
GET `/api/v0/main-frontend/users/:id/course-instance-enrollments`
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_course_instance_enrollments_for_user(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<CourseInstanceEnrollmentsInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(auth_user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let mut res =
        models::course_instance_enrollments::get_course_instance_enrollment_info_for_user(
            &mut conn, *user_id,
        )
        .await?;

    res.course_instance_enrollments
        .sort_by(|a, b| a.created_at.cmp(&b.created_at));

    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{user_id}", web::get().to(get_user)).route(
        "/{user_id}/course-instance-enrollments",
        web::get().to(get_course_instance_enrollments_for_user),
    );
}
