use actix_web::web::{self, ServiceConfig};

mod authorize;
mod authorized_clients;
mod consent;
mod discovery;
mod oauth;
mod revoke;
mod token;
mod userinfo;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("").configure(oauth::_add_routes));
}
