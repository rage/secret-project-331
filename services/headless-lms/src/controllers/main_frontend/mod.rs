/*!
Handlers for HTTP requests to `/api/v0/main_frontend`.

This documents all endpoints. Select a module below for a category.

*/

pub mod courses;
pub mod exercises;
pub mod organizations;

use actix_web::web::{self, ServiceConfig};

use self::{
    courses::_add_courses_routes, exercises::_add_exercises_routes,
    organizations::_add_organizations_routes,
};

/// Add controllers from all the submodules.
pub fn add_main_frontend_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/courses").configure(_add_courses_routes))
        .service(web::scope("/exercises").configure(_add_exercises_routes))
        .service(web::scope("/organizations").configure(_add_organizations_routes));
}
