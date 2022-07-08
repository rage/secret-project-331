/*!
Handlers for HTTP requests to `/api/v0/study-registry`.

This documents all endpoints. Select a module below for a category.

*/

use actix_web::web::{self, ServiceConfig};

pub mod completion_registered_to_study_registry;
pub mod completions;

/// Add controllers from all the submodules.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(
        web::scope("/completion-registered-to-study-registry")
            .configure(completion_registered_to_study_registry::_add_routes),
    )
    .service(web::scope("/completions").configure(completions::_add_routes));
}
