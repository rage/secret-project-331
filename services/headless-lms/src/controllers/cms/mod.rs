/*!
Handlers for HTTP requests to `/api/v0/cms`.

This documents all endpoints. Select a module below for a category.

*/

pub mod course_instances;
pub mod courses;
pub mod email_templates;
pub mod pages;

use actix_web::web::{self, ServiceConfig};

use crate::utils::file_store::FileStore;

use self::{
    course_instances::_add_course_instances_routes, courses::_add_courses_routes,
    email_templates::_add_email_templates_routes, pages::_add_pages_routes,
};

/// Add controllers from all the submodules.
pub fn add_cms_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/courses").configure(_add_courses_routes::<T>))
        .service(web::scope("/pages").configure(_add_pages_routes))
        .service(web::scope("/course-instances").configure(_add_course_instances_routes))
        .service(web::scope("/email-templates").configure(_add_email_templates_routes));
}
