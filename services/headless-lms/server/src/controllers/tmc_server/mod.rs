/*!
Handlers for HTTP requests to `/api/v0/tmc-server`.

These endpoints are used by the TMC server so that it can integrate with this system.
*/

pub mod users_by_upstream_id;

use crate::prelude::*;

/// Add controllers from all the submodules.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/users-by-upstream-id").configure(users_by_upstream_id::_add_routes));
}
