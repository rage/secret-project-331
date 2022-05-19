//! Controllers for requests starting with `/api/v0/cms/course-instances`.

use crate::controllers::prelude::*;

/**
GET `/api/v8/course-instances/:course_instance` - Gets a course instance by id.

# Example
Request: `GET /api/v8/course-instances/e051ddb5-2128-4215-adda-ebd74a0ea46b`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_organization_id(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let organization =
        models::course_instances::get_organization_id(&mut conn, *course_instance_id).await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    return token.0.ok(web::Json(organization));
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_instance_id}/organization",
        web::get().to(get_organization_id),
    );
}
