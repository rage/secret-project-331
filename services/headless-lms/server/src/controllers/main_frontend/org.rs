//! Controllers for requests starting with `/api/v0/main-frontend/org`.

use crate::{
    controllers::ControllerResult,
    models::{courses::Course, organizations::Organization},
    utils::{file_store::FileStore, ApplicationConfiguration},
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;

async fn get_organization_by_slug(
    pool: web::Data<PgPool>,
    request_organization_slug: web::Path<String>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let db_organization = crate::models::organizations::get_organization_by_slug(
        &mut conn,
        &*request_organization_slug,
    )
    .await?;
    let organization =
        Organization::from_database_organization(&db_organization, &file_store, &app_conf);
    Ok(Json(organization))
}

async fn get_organization_courses_by_slug(
    pool: web::Data<PgPool>,
    request_organization_slug: web::Path<String>,
) -> ControllerResult<Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let organization = crate::models::organizations::get_organization_by_slug(
        &mut conn,
        &*request_organization_slug,
    )
    .await?;
    let courses = crate::models::courses::organization_courses(&mut conn, &organization.id).await?;
    Ok(Json(courses))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_org_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{organization_slug}",
        web::get().to(get_organization_by_slug),
    )
    .route(
        "/{organization_slug}/courses",
        web::get().to(get_organization_courses_by_slug),
    );
}
