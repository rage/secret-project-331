//! Controllers for requests starting with `/api/v0/cms/course-instances`.

use models::course_instances::CourseInstance;
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_course_instance, get_organization_id))]
pub(crate) struct CmsCourseInstancesApiDoc;

/**
GET `/api/v0/cms/course-instances/:course_instance` - Gets a course instance by id.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{course_instance_id}",
    operation_id = "getCmsCourseInstance",
    tag = "cms_course_instances",
    params(
        ("course_instance_id" = Uuid, Path, description = "Course instance id")
    ),
    responses(
        (status = 200, description = "Course instance", body = CourseInstance)
    )
)]
async fn get_course_instance(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseInstance>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let instance =
        models::course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    token.authorized_ok(web::Json(instance))
}

/**
GET `/api/v8/course-instances/:course_instance` - Gets a course instance by id.

# Example
Request: `GET /api/v8/course-instances/e051ddb5-2128-4215-adda-ebd74a0ea46b`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{course_instance_id}/organization",
    operation_id = "getCmsCourseInstanceOrganizationId",
    tag = "cms_course_instances",
    params(
        ("course_instance_id" = Uuid, Path, description = "Course instance id")
    ),
    responses(
        (status = 200, description = "Organization id", body = Uuid)
    )
)]
async fn get_organization_id(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let organization =
        models::course_instances::get_organization_id(&mut conn, *course_instance_id).await?;
    token.authorized_ok(web::Json(organization))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_instance_id}", web::get().to(get_course_instance))
        .route(
            "/{course_instance_id}/organization",
            web::get().to(get_organization_id),
        );
}
