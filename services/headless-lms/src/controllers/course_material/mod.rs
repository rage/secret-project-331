/*!
Handlers for HTTP requests to `/api/v0/course-material`.

This documents all endpoints. Select a module below for a category.

*/

pub mod chapters;
pub mod course_instances;
pub mod courses;
pub mod exams;
pub mod exercises;
pub mod pages;
pub mod proposed_edits;
pub mod submissions;

use self::{
    chapters::_add_chapters_routes, course_instances::_add_user_progress_routes,
    courses::_add_courses_routes, exams::_add_exams_routes, exercises::_add_exercises_routes,
    pages::_add_pages_routes, proposed_edits::_add_proposed_edits_routes,
    submissions::_add_submissions_routes,
};
use actix_web::web::{self, ServiceConfig};

/// Add controllers from all the submodules.
pub fn add_course_material_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/courses").configure(_add_courses_routes))
        .service(web::scope("/exercises").configure(_add_exercises_routes))
        .service(web::scope("/pages").configure(_add_pages_routes))
        .service(web::scope("/chapters").configure(_add_chapters_routes))
        .service(web::scope("/submissions").configure(_add_submissions_routes))
        .service(web::scope("/course-instances").configure(_add_user_progress_routes))
        .service(web::scope("/proposed-edits").configure(_add_proposed_edits_routes))
        .service(web::scope("/exams").configure(_add_exams_routes));
}
