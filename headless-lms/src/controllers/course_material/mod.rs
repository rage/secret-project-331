/*!
Handlers for HTTP requests to `/api/v0/course-material`.

This documents all endpoints. Select a module below for a category.

*/

pub mod courses;

use actix_web::web::{self, ServiceConfig};

use self::courses::_add_courses_routes;

/// Add controllers from all the submodules.
pub fn add_course_material_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/courses").configure(_add_courses_routes));
}
