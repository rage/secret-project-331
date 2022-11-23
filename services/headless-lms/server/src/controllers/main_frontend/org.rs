//! Controllers for requests starting with `/api/v0/main-frontend/org`.

use models::organizations::Organization;

use crate::{domain::authorization::skip_authorize, prelude::*};

/**
GET `/api/v0/main-frontend/org/:slug
*/
#[generated_doc]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_organization_by_slug(
    pool: web::Data<PgPool>,
    organization_slug: web::Path<String>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let db_organization =
        models::organizations::get_organization_by_slug(&mut conn, &organization_slug).await?;
    let organization =
        Organization::from_database_organization(db_organization, file_store.as_ref(), &app_conf);

    let token = skip_authorize()?;
    token.authorized_ok(web::Json(organization))
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
    );
}
