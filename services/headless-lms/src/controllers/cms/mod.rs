/*!
Handlers for HTTP requests to `/api/v0/cms`.

This documents all endpoints. Select a module below for a category.

*/

pub mod course_instances;
pub mod email_templates;
pub mod oembed;
pub mod organizations;
pub mod pages;

use actix_web::web::{self, ServiceConfig};

use self::{
    course_instances::_add_course_instances_routes, email_templates::_add_email_templates_routes,
    oembed::_add_oembed_routes, organizations::_add_organizations_routes, pages::_add_pages_routes,
};

/// Add controllers from all the submodules.
pub fn add_cms_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/pages").configure(_add_pages_routes))
        .service(web::scope("/course-instances").configure(_add_course_instances_routes))
        .service(web::scope("/email-templates").configure(_add_email_templates_routes))
        .service(web::scope("/oembed").configure(_add_oembed_routes))
        .service(web::scope("/organizations").configure(_add_organizations_routes));
}
