/*!
Handlers for HTTP requests to `/api/v0/course-material`.

This documents all endpoints. Select a module below for a category.

*/

pub mod chapters;
pub mod chatbot;
pub mod code_giveaways;
pub mod course_instances;
pub mod course_modules;
pub mod courses;
pub mod exams;
pub mod exercises;
pub mod glossary;
pub mod oembed;
pub mod organizations;
pub mod page_audio_files;
pub mod pages;
pub mod proposed_edits;
pub mod user_details;

use actix_web::web::{self, ServiceConfig};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    nest(
        (path = "/chapters", api = chapters::CourseMaterialChaptersApiDoc),
        (path = "/chatbot", api = chatbot::CourseMaterialChatbotApiDoc),
        (path = "/code-giveaways", api = code_giveaways::CourseMaterialCodeGiveawaysApiDoc),
        (path = "/course-instances", api = course_instances::CourseMaterialCourseInstancesApiDoc),
        (path = "/course-modules", api = course_modules::CourseMaterialCourseModulesApiDoc),
        (path = "/courses", api = courses::CourseMaterialCoursesApiDoc),
        (path = "/exams", api = exams::CourseMaterialExamsApiDoc),
        (path = "/exercises", api = exercises::CourseMaterialExercisesApiDoc),
        (path = "/acronyms", api = glossary::CourseMaterialGlossaryApiDoc),
        (path = "/oembed", api = oembed::CourseMaterialOembedApiDoc),
        (path = "/organizations", api = organizations::CourseMaterialOrganizationsApiDoc),
        (path = "/page_audio", api = page_audio_files::CourseMaterialPageAudioApiDoc),
        (path = "/pages", api = pages::CourseMaterialPagesApiDoc),
        (path = "/proposed-edits", api = proposed_edits::CourseMaterialProposedEditsApiDoc),
        (path = "/user-details", api = user_details::CourseMaterialUserDetailsApiDoc)
    )
)]
pub struct CourseMaterialRoutesApiDoc;

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
        .service(web::scope("/page_audio").configure(page_audio_files::_add_routes))
        .service(web::scope("/chatbot").configure(chatbot::_add_routes))
        .service(web::scope("/code-giveaways").configure(code_giveaways::_add_routes))
        .service(web::scope("/user-details").configure(user_details::_add_routes))
        .service(web::scope("/organizations").configure(organizations::_add_routes));
}
