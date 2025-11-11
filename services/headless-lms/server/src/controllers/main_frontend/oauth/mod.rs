use actix_web::web::{self, ServiceConfig};

mod authorize_query;
mod authorized_client;
mod claims;
pub mod consent_deny_query;
pub mod consent_query;
pub mod consent_response;
mod dpop;
mod helpers;
mod hmac_sha256;
mod jwks;
mod oauth_validate;
mod oauth_validated;
mod oauth_with_oicd;
mod token_query;
mod token_response;
mod userinfo_response;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("").configure(oauth_with_oicd::_add_routes));
}
