use actix_web::web::{self, ServiceConfig};

mod authorize_query;
mod authorized_client;
mod claims;
mod consent_deny_query;
mod consent_query;
mod dpop;
mod helpers;
mod hmac_sha256;
mod jwks;
mod oauth_from_request;
mod oauth_validate;
mod oauth_with_oicd;
mod token_query;
mod token_response;
mod userinfo_response;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("").configure(oauth_with_oicd::_add_routes));
}
