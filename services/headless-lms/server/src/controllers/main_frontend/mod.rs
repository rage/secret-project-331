/*!
Handlers for HTTP requests to `/api/v0/main_frontend`.

This documents all endpoints. Select a module below for a category.

*/

pub mod chapters;
pub mod course_instances;
pub mod course_modules;
pub mod courses;
pub mod email_templates;
pub mod exams;
pub mod exercise_repositories;
pub mod exercise_services;
pub mod exercise_slide_submissions;
pub mod exercises;
pub mod feedback;
pub mod glossary;
pub mod org;
pub mod organizations;
pub mod page_audio_files;
pub mod pages;
pub mod playground_examples;
pub mod playground_views;
pub mod proposed_edits;
pub mod regradings;
pub mod roles;
pub mod users;

use actix_web::web::{self, ServiceConfig};

/// Add controllers from all the submodules.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/chapters").configure(chapters::_add_routes))
        .service(web::scope("/course-instances").configure(course_instances::_add_routes))
        .service(web::scope("/course-modules").configure(course_modules::_add_routes))
        .service(web::scope("/courses").configure(courses::_add_routes))
        .service(web::scope("/email-templates").configure(email_templates::_add_routes))
        .service(web::scope("/exercises").configure(exercises::_add_routes))
        .service(web::scope("/feedback").configure(feedback::_add_routes))
        .service(web::scope("/org").configure(org::_add_routes))
        .service(web::scope("/organizations").configure(organizations::_add_routes))
        .service(web::scope("/pages").configure(pages::_add_routes))
        .service(
            web::scope("/exercise-slide-submissions")
                .configure(exercise_slide_submissions::_add_routes),
        )
        .service(web::scope("/proposed-edits").configure(proposed_edits::_add_routes))
        .service(web::scope("/exercise-services").configure(exercise_services::_add_routes))
        .service(web::scope("/playground_examples").configure(playground_examples::_add_routes))
        .service(web::scope("/users").configure(users::_add_routes))
        .service(web::scope("/exams").configure(exams::_add_routes))
        .service(web::scope("/glossary").configure(glossary::_add_routes))
        .service(web::scope("/roles").configure(roles::_add_routes))
        .service(web::scope("/exercise-repositories").configure(exercise_repositories::_add_routes))
        .service(web::scope("/regradings").configure(regradings::_add_routes))
        .service(web::scope("/playground-views").configure(playground_views::_add_routes))
        .service(web::scope("/page_audio").configure(page_audio_files::_add_routes));
}
