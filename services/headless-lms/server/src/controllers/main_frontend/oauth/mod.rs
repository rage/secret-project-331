use actix_web::web::{self, ServiceConfig};

mod oauth_with_oicd;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("").configure(oauth_with_oicd::_add_routes));
}
