use crate::{
    controllers::ControllerResult,
    domain::authorization::{authorize, Action, AuthUser, Resource},
    models::exams::{self, Exam},
};
use actix_web::web::{self, Json, ServiceConfig};
use serde::Deserialize;
use sqlx::PgPool;
use ts_rs::TS;
use uuid::Uuid;

pub async fn get_exam(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<Exam>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Action::View, user.id, Resource::Exam(*id)).await?;
    let exam = exams::get(&mut conn, id.into_inner()).await?;
    Ok(Json(exam))
}

#[derive(Debug, Deserialize, TS)]
pub struct ExamCourseInfo {
    course_id: Uuid,
}

pub async fn set_course(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    course_id: web::Json<ExamCourseInfo>,
    user: AuthUser,
) -> ControllerResult<Json<()>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Action::Edit, user.id, Resource::Exam(*id)).await?;

    exams::set_course(&mut conn, id.into_inner(), course_id.into_inner().course_id).await?;
    Ok(Json(()))
}

pub async fn unset_course(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    course_id: web::Json<ExamCourseInfo>,
    user: AuthUser,
) -> ControllerResult<Json<()>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Action::Edit, user.id, Resource::Exam(*id)).await?;

    exams::unset_course(&mut conn, id.into_inner(), course_id.into_inner().course_id).await?;
    Ok(Json(()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_exams_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}", web::get().to(get_exam))
        .route("/{id}/set", web::post().to(set_course))
        .route("/{id}/unset", web::post().to(unset_course));
}
