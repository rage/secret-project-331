use actix_web::web::{self, ServiceConfig};

pub mod authorize_query;
pub mod claims;
pub mod consent_deny_query;
pub mod consent_query;
pub mod dpop;
pub mod helpers;
pub mod hmac_sha256;
pub mod jwks;
pub mod oauth_validate;
pub mod oauth_with_oicd;
pub mod safe_exractor;
pub mod token_query;
pub mod token_response;
pub mod userinfo_response;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("").configure(oauth_with_oicd::_add_routes));
}
