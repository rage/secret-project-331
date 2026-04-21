//! Controllers for requests starting with `/api/v0/course-material/organizations`.

use headless_lms_models::organizations::Organization;
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_organization))]
pub(crate) struct CourseMaterialOrganizationsApiDoc;

/**
GET /organizations/:organization_id - Get organization.
*/
#[utoipa::path(
    get,
    path = "/{organization_id}",
    operation_id = "getCourseMaterialOrganization",
    tag = "course-material-organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Organization", body = Organization)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_organization(
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let db_organization =
        models::organizations::get_organization(&mut conn, *organization_id).await?;
    let organization =
        Organization::from_database_organization(db_organization, file_store.as_ref(), &app_conf);
    token.authorized_ok(web::Json(organization))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{organization_id}", web::get().to(get_organization));
}
