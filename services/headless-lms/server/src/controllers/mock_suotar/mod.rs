/*!
Mock Suotar: a stand-in for the University of Helsinki Suotar API, and the test/dev control surface
around it.

Mounted at `/api/v0/mock-suotar` only when `TEST_MODE` and `USE_MOCK_SUOTAR_ENDPOINT` are both on;
like `mock_sisu`, the gate is runtime route registration rather than `#[cfg]`. The mock writes no
database table, and its call log holds unscrubbed fake data that must never feed `suotar_api_calls`.
*/

pub mod api;
pub mod commands;
pub mod control;
pub mod default_world;
pub mod faults;
pub mod fixtures;
pub mod ids;
pub mod logic;
pub mod scenarios;
pub mod store;
pub mod wire;
pub mod world;

use crate::prelude::*;

/// The route cannot be reached with the flags off, so tripping this means the gate itself broke.
pub fn assert_enabled(app_conf: &ApplicationConfiguration) {
    assert!(app_conf.test_mode && app_conf.test_suotar);
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/persons/resolve-by-student-numbers",
        web::post().to(api::resolve_persons),
    )
    .route(
        "/enrolments/resolve",
        web::post().to(api::resolve_enrolments),
    )
    .route(
        "/enrolments/list-by-course",
        web::post().to(api::list_by_course),
    )
    .route(
        "/attainments/import",
        web::post().to(api::import_attainments),
    )
    .route(
        "/attainments/verify",
        web::post().to(api::verify_attainments),
    )
    .route(
        "/open-university-product-access-tokens/resolve",
        web::post().to(api::resolve_product_access_tokens),
    )
    .service(web::scope("/control").configure(control::_add_routes));
}
