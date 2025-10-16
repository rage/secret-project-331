//! Controllers for requests starting with `/api/v0/main-frontend/courses/{course_id}/students`.
use crate::prelude::*;


#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct StudentProgress {}

/// GET `/api/v0/main-frontend/courses/{course_id}/students/progress`
#[instrument(skip(pool))]
async fn get_progress(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<StudentProgress>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let mut vec = Vec::new();
    vec.push(StudentProgress {});

    token.authorized_ok(web::Json(vec))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/progress", web::get().to(get_progress));
}
