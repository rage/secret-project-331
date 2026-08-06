/*!
Mock Suotar: a stand-in for the University of Helsinki Suotar API, and the test/dev control surface
around it.

Mounted at `/api/v0/mock-suotar` only when `TEST_MODE` and `USE_MOCK_SUOTAR_ENDPOINT` are both on.
Like `mock_sisu` and `mock_azure`, the gate is runtime registration rather than `#[cfg]`: the code
always compiles, but with the flags off the routes are absent from the route table.

`SUOTAR_API_BASE_URL` and `SUOTAR_API_KEY` are deliberately unset in the dev and test overlays, so
the production path is known to fail loudly when unconfigured.
*/

pub mod control;

use crate::prelude::*;

/// The route cannot be reached with the flags off, so tripping this means the gate itself broke.
pub fn assert_enabled(app_conf: &ApplicationConfiguration) {
    assert!(app_conf.test_mode && app_conf.test_suotar);
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/control").configure(control::_add_routes));
}
