//! Controllers for requests starting with `/api/v0/main-frontend/org`.

use models::{courses::Course, organizations::Organization};

use crate::controllers::prelude::*;

/**
GET `/api/v0/main-frontend/org/:slug
*/
#[cfg_attr(doc, doc = generated_docs!(Organization))]
async fn get_organization_by_slug(
    pool: web::Data<PgPool>,
    organization_slug: web::Path<String>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let db_organization =
        models::organizations::get_organization_by_slug(&mut conn, &*organization_slug).await?;
    let organization =
        Organization::from_database_organization(db_organization, file_store.as_ref(), &app_conf);
    Ok(web::Json(organization))
}

/**
GET `/api/v0/main-frontend/org/:slug/courses
*/
#[cfg_attr(doc, doc = generated_docs!(Vec<Course>))]
async fn get_organization_courses_by_slug(
    pool: web::Data<PgPool>,
    organization_slug: web::Path<String>,
) -> ControllerResult<web::Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let organization =
        models::organizations::get_organization_by_slug(&mut conn, &*organization_slug).await?;
    let courses = models::courses::organization_courses(&mut conn, organization.id).await?;
    Ok(web::Json(courses))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{organization_slug}",
        web::get().to(get_organization_by_slug),
    )
    .route(
        "/{organization_slug}/courses",
        web::get().to(get_organization_courses_by_slug),
    );
}
