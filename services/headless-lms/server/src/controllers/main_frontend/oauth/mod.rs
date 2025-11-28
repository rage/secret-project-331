use actix_web::web::ServiceConfig;

/// OAuth 2.0 and OpenID Connect implementation.
///
/// This module implements the following RFCs and specifications:
///
/// ## OAuth 2.0 Core
/// - [RFC 6749 — OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
///   - §3.1 — Authorization Endpoint (`/authorize`)
///   - §3.2 — Token Endpoint (`/token`)
///
/// ## OAuth 2.0 Extensions
/// - [RFC 7009 — OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009) (`/revoke`)
/// - [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636)
/// - [RFC 7662 — OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662) (`/introspect`)
/// - [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414) (`/.well-known/openid-configuration`)
/// - [RFC 9449 — OAuth 2.0 Demonstrating Proof-of-Possession (DPoP)](https://datatracker.ietf.org/doc/html/rfc9449)
///
/// ## JSON Web Token (JWT)
/// - [RFC 7517 — JSON Web Key (JWK)](https://datatracker.ietf.org/doc/html/rfc7517) (`/jwks.json`)
///
/// ## OpenID Connect
/// - [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
///   - §3 — Authorization Endpoint (`/authorize`)
///   - §3.1.3 — Token Endpoint (`/token`)
///   - §5.3 — UserInfo Endpoint (`/userinfo`)
///   - §10 — JWKS endpoint for key discovery (`/jwks.json`) — Note: Currently exposes a single key; key rotation not implemented
/// - [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html) (`/.well-known/openid-configuration`)
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
