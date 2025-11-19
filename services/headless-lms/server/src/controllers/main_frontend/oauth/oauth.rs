//! Controllers for requests starting with '/api/v0/main-frontend/oauth'.

use actix_web::web;

use super::{
    authorize::authorize,
    authorized_clients::{delete_authorized_client, get_authorized_clients},
    consent::{approve_consent, deny_consent},
    discovery::{jwks, well_known_openid},
    revoke::revoke,
    token::token,
    userinfo::user_info,
};

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/authorize", web::get().to(authorize))
        .route("/token", web::post().to(token))
        .route("/userinfo", web::get().to(user_info))
        .route(
            "/.well-known/openid-configuration",
            web::get().to(well_known_openid),
        )
        .route("/jwks.json", web::get().to(jwks))
        .route("/revoke", web::post().to(revoke))
        .route("/consent", web::post().to(approve_consent))
        .route("/consent/deny", web::post().to(deny_consent))
        .route("/authorized-clients", web::get().to(get_authorized_clients))
        .route(
            "/authorized-clients/{client_id}",
            web::delete().to(delete_authorized_client),
        );
}
