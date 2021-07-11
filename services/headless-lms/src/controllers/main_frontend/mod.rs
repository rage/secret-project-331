/*!
Handlers for HTTP requests to `/api/v0/main_frontend`.

This documents all endpoints. Select a module below for a category.

*/

pub mod courses;
pub mod exercises;
pub mod gradings;
pub mod organizations;
pub mod submissions;

use actix_web::web::{self, ServiceConfig};

use self::{
    courses::_add_courses_routes, exercises::_add_exercises_routes, gradings::_add_gradings_routes,
    organizations::_add_organizations_routes, submissions::_add_submissions_routes,
};

/// Add controllers from all the submodules.
pub fn add_main_frontend_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/courses").configure(_add_courses_routes))
        .service(web::scope("/exercises").configure(_add_exercises_routes))
        .service(web::scope("/gradings").configure(_add_gradings_routes))
        .service(web::scope("/organizations").configure(_add_organizations_routes))
        .service(web::scope("/submissions").configure(_add_submissions_routes));
}
