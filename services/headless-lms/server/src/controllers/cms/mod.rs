/*!
Handlers for HTTP requests to `/api/v0/cms`.

This documents all endpoints. Select a module below for a category.

*/

pub mod course_instances;
pub mod courses;
pub mod email_templates;
pub mod exams;
pub mod exercise_services;
pub mod gutenberg;
pub mod organizations;
pub mod pages;

use actix_web::web::{self, ServiceConfig};

/// Add controllers from all the submodules.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/pages").configure(pages::_add_routes))
        .service(web::scope("/course-instances").configure(course_instances::_add_routes))
        .service(web::scope("/email-templates").configure(email_templates::_add_routes))
        .service(web::scope("/gutenberg").configure(gutenberg::_add_routes))
        .service(web::scope("/organizations").configure(organizations::_add_routes))
        .service(web::scope("/courses").configure(courses::_add_routes))
        .service(web::scope("/exams").configure(exams::_add_routes))
        .service(web::scope("/exercise-services").configure(exercise_services::_add_routes));
}
