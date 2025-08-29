use actix_web::web::{self, ServiceConfig};

pub mod dpop;
pub mod oauth_with_oicd;
pub mod types;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("").configure(oauth_with_oicd::_add_routes));
}
