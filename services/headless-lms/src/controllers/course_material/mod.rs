/*!
Handlers for HTTP requests to `/api/v0/course-material`.

This documents all endpoints. Select a module below for a category.

*/

pub mod course_parts;
pub mod courses;
pub mod exercises;
pub mod pages;
pub mod submissions;

use actix_web::web::{self, ServiceConfig};

use self::{
    course_parts::_add_course_parts_routes, courses::_add_courses_routes,
    exercises::_add_exercises_routes, pages::_add_pages_routes,
    submissions::_add_submissions_routes,
};

/// Add controllers from all the submodules.
pub fn add_course_material_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/courses").configure(_add_courses_routes))
        .service(web::scope("/exercises").configure(_add_exercises_routes))
        .service(web::scope("/course-parts").configure(_add_course_parts_routes))
        .service(web::scope("/submissions").configure(_add_submissions_routes))
        .service(web::scope("/pages").configure(_add_pages_routes));
}
