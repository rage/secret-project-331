/*!
Handlers for HTTP requests to `/api/v0/main_frontend`.

This documents all endpoints. Select a module below for a category.

*/

pub mod chapters;
pub mod course_instances;
pub mod courses;
pub mod email_templates;
pub mod exams;
pub mod exercise_services;
pub mod exercises;
pub mod feedback;
pub mod organizations;
pub mod pages;
pub mod playground_examples;
pub mod proposed_edits;
pub mod submissions;
pub mod users;

use actix_web::web::{self, ServiceConfig};

use crate::utils::file_store::FileStore;

use self::{
    chapters::_add_chapters_routes, course_instances::_add_course_instances_routes,
    courses::_add_courses_routes, email_templates::_add_email_templates_routes,
    exams::_add_exams_routes, exercise_services::_add_exercise_service_routes,
    exercises::_add_exercises_routes, feedback::_add_feedback_routes,
    organizations::_add_organizations_routes, pages::_add_pages_routes,
    playground_examples::_add_playground_examples_routes,
    proposed_edits::_add_proposed_edits_routes, submissions::_add_submissions_routes,
    users::_add_users_routes,
};

/// Add controllers from all the submodules.
pub fn add_main_frontend_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/chapters").configure(_add_chapters_routes::<T>))
        .service(web::scope("/course-instances").configure(_add_course_instances_routes))
        .service(web::scope("/courses").configure(_add_courses_routes::<T>))
        .service(web::scope("/email-templates").configure(_add_email_templates_routes))
        .service(web::scope("/exercises").configure(_add_exercises_routes))
        .service(web::scope("/feedback").configure(_add_feedback_routes))
        .service(web::scope("/organizations").configure(_add_organizations_routes::<T>))
        .service(web::scope("/pages").configure(_add_pages_routes))
        .service(web::scope("/submissions").configure(_add_submissions_routes))
        .service(web::scope("/proposed-edits").configure(_add_proposed_edits_routes))
        .service(web::scope("/exercise-services").configure(_add_exercise_service_routes))
        .service(web::scope("/playground_examples").configure(_add_playground_examples_routes))
        .service(web::scope("/users").configure(_add_users_routes))
        .service(web::scope("/exams").configure(_add_exams_routes));
}
