use actix_web::web::ServiceConfig;

mod authorize;
mod authorized_clients;
mod consent;
mod discovery;
mod introspect;
mod revoke;
mod token;
mod userinfo;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    authorize::_add_routes(cfg);
    token::_add_routes(cfg);
    userinfo::_add_routes(cfg);
    discovery::_add_routes(cfg);
    revoke::_add_routes(cfg);
    consent::_add_routes(cfg);
    authorized_clients::_add_routes(cfg);
    introspect::_add_routes(cfg);
}
