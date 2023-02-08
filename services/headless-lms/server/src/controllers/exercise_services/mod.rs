mod grading;

use crate::prelude::*;

/// Add controllers from all the submodules.
#[doc(hidden)]
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/grading").configure(grading::_add_routes));
}
