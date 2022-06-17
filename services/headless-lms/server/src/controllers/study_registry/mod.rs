/*!
Handlers for HTTP requests to `/api/v0/study-registry`.

This documents all endpoints. Select a module below for a category.

*/

use actix_web::web::{self, ServiceConfig};

pub mod completions;
pub mod register_completions;

/// Add controllers from all the submodules.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/completions").configure(completions::_add_routes))
        .service(web::scope("/register-completions").configure(register_completions::_add_routes));
}
