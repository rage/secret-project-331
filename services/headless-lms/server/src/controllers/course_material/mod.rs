/*!
Handlers for HTTP requests to `/api/v0/course-material`.

This documents all endpoints. Select a module below for a category.

*/

pub mod chapters;
pub mod course_instances;
pub mod course_modules;
pub mod courses;
pub mod exams;
pub mod exercises;
pub mod glossary;
pub mod oembed;
pub mod page_audio_files;
pub mod pages;
pub mod proposed_edits;

use actix_web::web::{self, ServiceConfig};

/// Add controllers from all the submodules.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/courses").configure(courses::_add_routes))
        .service(web::scope("/exercises").configure(exercises::_add_routes))
        .service(web::scope("/pages").configure(pages::_add_routes))
        .service(web::scope("/chapters").configure(chapters::_add_routes))
        .service(web::scope("/course-instances").configure(course_instances::_add_routes))
        .service(web::scope("/proposed-edits").configure(proposed_edits::_add_routes))
        .service(web::scope("/exams").configure(exams::_add_routes))
        .service(web::scope("/acronyms").configure(glossary::_add_routes))
        .service(web::scope("/oembed").configure(oembed::_add_routes))
        .service(web::scope("/course-modules").configure(course_modules::_add_routes))
        .service(web::scope("/page_audio").configure(page_audio_files::_add_routes));
}
