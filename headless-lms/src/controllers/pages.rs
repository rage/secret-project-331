//! Controllers for requests starting with `/api/v0/pages`.
use std::str::FromStr;

use crate::models::pages::{NewPage, Page, PageUpdate};
use actix_web::web::ServiceConfig;
use actix_web::{
    web::{self, Json},
    Result,
};
use sqlx::PgPool;
use uuid::Uuid;

use super::ApplicationError;

/**
GET `/api/v0/pages/:page_id` - Get a page by id.
*/

async fn get_page(
    request_page_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> Result<Json<Page>> {
    let page_id = Uuid::from_str(&request_page_id)
        .map_err(|original_error| ApplicationError::BadRequest(original_error.to_string()))?;

    let page: Page = crate::models::pages::get_page(pool.get_ref(), page_id)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(page))
}

/**
POST `/api/v0/pages` - Create a new page.
*/
async fn post_new_page(payload: web::Json<NewPage>, pool: web::Data<PgPool>) -> Result<Json<Page>> {
    let new_page = payload.0;
    let page = crate::models::pages::insert_page(pool.get_ref(), new_page)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(page))
}

/**
PUT `/api/v0/pages/:page_id` - Update a page by id.
*/
async fn update_page(
    payload: web::Json<PageUpdate>,
    request_page_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> Result<Json<Page>> {
    let page_id = Uuid::from_str(&request_page_id)
        .map_err(|original_error| ApplicationError::BadRequest(original_error.to_string()))?;

    let page_update = payload.0;
    let page = crate::models::pages::update_page(pool.get_ref(), page_id, page_update)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(page))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_pages_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}", web::get().to(get_page))
        .route("/", web::post().to(post_new_page))
        .route("/{page_id}", web::put().to(update_page));
}
