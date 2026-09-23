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

use actix_web::{Resource, Scope};

use crate::prelude::*;

/// The route cannot be reached with the flags off, so tripping this means the gate itself broke.
pub fn assert_enabled(app_conf: &ApplicationConfiguration) {
    assert!(app_conf.test_mode && app_conf.test_suotar);
}

/// The mock's whole scope. Unmatched paths and methods fall through the way Suotar's router does,
/// which is why the contract routes are resources with their own fallback.
pub fn scope() -> Scope {
    web::scope("/mock-suotar")
        .service(
            web::scope("/control")
                .configure(control::_add_routes)
                .default_service(web::to(HttpResponse::NotFound)),
        )
        .service(
            contract_route("/persons/resolve-by-student-numbers")
                .route(web::post().to(api::resolve_persons)),
        )
        .service(
            contract_route("/enrolments/resolve").route(web::post().to(api::resolve_enrolments)),
        )
        .service(
            contract_route("/enrolments/list-by-course").route(web::post().to(api::list_by_course)),
        )
        .service(
            contract_route("/attainments/import").route(web::post().to(api::import_attainments)),
        )
        .service(
            contract_route("/attainments/verify").route(web::post().to(api::verify_attainments)),
        )
        .service(
            contract_route("/course-codes/validate")
                .route(web::post().to(api::validate_course_codes)),
        )
        .default_service(web::to(api::fall_through))
}

fn contract_route(path: &str) -> Resource {
    web::resource(path).default_service(web::to(api::fall_through))
}
