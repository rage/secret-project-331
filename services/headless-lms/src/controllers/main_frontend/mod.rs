/*!
Handlers for HTTP requests to `/api/v0/main_frontend`.

This documents all endpoints. Select a module below for a category.

*/

pub mod chapters;
pub mod courses;
pub mod exercises;
pub mod organizations;
pub mod pages;
pub mod submissions;

use actix_web::web::{self, ServiceConfig};

use crate::utils::file_store::FileStore;

use self::{
    chapters::_add_chapters_routes, courses::_add_courses_routes, exercises::_add_exercises_routes,
    organizations::_add_organizations_routes, pages::_add_pages_routes,
    submissions::_add_submissions_routes,
};

/// Add controllers from all the submodules.
pub fn add_main_frontend_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/chapters").configure(_add_chapters_routes::<T>))
        .service(web::scope("/courses").configure(_add_courses_routes::<T>))
        .service(web::scope("/exercises").configure(_add_exercises_routes))
        .service(web::scope("/organizations").configure(_add_organizations_routes))
        .service(web::scope("/pages").configure(_add_pages_routes))
        .service(web::scope("/submissions").configure(_add_submissions_routes));
}
