/*!
Mock Suotar: a stand-in for the University of Helsinki Suotar API, and the test/dev control surface
around it.

Mounted at `/api/v0/mock-suotar` only when `TEST_MODE` and `USE_MOCK_SUOTAR_ENDPOINT` are both on.
Like `mock_sisu` and `mock_azure`, the gate is runtime registration rather than `#[cfg]`: the code
always compiles, but with the flags off the routes are absent from the route table.

`SUOTAR_API_BASE_URL` and `SUOTAR_API_KEY` are deliberately unset in the dev and test overlays, so
the production path is known to fail loudly when unconfigured.

The six contract endpoints are siblings of `/control`, all `POST` only. Any auth scheme is accepted
as long as the credential is `MOCK_SUOTAR_TOKEN`; the control surface needs no credential at all.

The simulated world lives in Redis on its own database index (`MOCK_SUOTAR_REDIS_DB_INDEX`, default
2), which nothing else in the repo touches, so `FLUSHDB` on it is safe. It survives recompiles and
pod restarts, and is replaced by whatever replaces the database under it.

The mock's call log holds unscrubbed fake data and is not `suotar_api_calls`: it is a debugging view
and must never feed the audited tables. The mock writes no database table at all.

Nothing ripens on its own. Every installed world sets ripeness to manual, so a spec drives its own
transitions and another spec's verify sweep cannot burn its counts.
*/

pub mod api;
pub mod commands;
pub mod control;
pub mod default_world;
pub mod faults;
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
