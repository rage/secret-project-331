use crate::domain::oauth::jwks::{Jwk, Jwks};
use crate::domain::oauth::oidc::rsa_n_e_and_kid_from_pem;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use headless_lms_utils::ApplicationConfiguration;

/// Handles `/jwks.json` for returning the JSON Web Key Set (JWKS).
///
/// This endpoint:
/// - Reads the configured ID Token signing public key (RS256).
/// - Exposes it in JWKS format for clients to validate ID tokens.
///
/// Follows [RFC 7517](https://datatracker.ietf.org/doc/html/rfc7517).
///
/// Note: Currently exposes a single signing key. Key rotation (OIDC Core §10) is not implemented.
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/jwks.json HTTP/1.1
/// ```
///
/// Response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
///
/// {
///   "keys": [
///     { "kty":"RSA","use":"sig","alg":"RS256","kid":"abc123","n":"...","e":"AQAB" }
///   ]
/// }
/// ```
#[instrument(skip(app_conf))]
pub async fn jwks(app_conf: web::Data<ApplicationConfiguration>) -> ControllerResult<HttpResponse> {
    let server_token = skip_authorize();

    // The public key used for signing ID tokens (RS256)
    let public_pem = &app_conf.oauth_server_configuration.rsa_public_key;

    // Extract modulus (n), exponent (e), and a stable key id (kid) from the PEM
    let (n, e, kid) = rsa_n_e_and_kid_from_pem(public_pem)?;

    // Your existing JWKS types
    let jwk = Jwk {
        kty: "RSA".into(),
        use_: "sig".into(),
        alg: "RS256".into(),
        kid,
        n,
        e,
    };

    server_token.authorized_ok(HttpResponse::Ok().json(Jwks { keys: vec![jwk] }))
}

/// Handles `/.well-known/openid-configuration` to expose OIDC discovery metadata.
///
/// This endpoint advertises the AS/OP capabilities so clients can auto-configure:
/// - Endpoints (authorize, token, userinfo, jwks)
/// - Supported response/grant types
/// - Token endpoint auth methods
/// - ID Token signing algs
/// - PKCE and DPoP metadata
///
/// Follows:
/// - [OIDC Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
/// - [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
/// - [RFC 9449 — DPoP metadata](https://www.rfc-editor.org/rfc/rfc9449#name-authorization-server-metadata)
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/.well-known/openid-configuration HTTP/1.1
/// ```
///
/// Example response (truncated):
/// ```json
/// {
///   "issuer": "https://example.org/api/v0/main-frontend/oauth",
///   "authorization_endpoint": "https://example.org/api/v0/main-frontend/oauth/authorize",
///   "token_endpoint": "https://example.org/api/v0/main-frontend/oauth/token",
///   "userinfo_endpoint": "https://example.org/api/v0/main-frontend/oauth/userinfo",
///   "jwks_uri": "https://example.org/api/v0/main-frontend/oauth/jwks.json",
///   "response_types_supported": ["code"],
///   "grant_types_supported": ["authorization_code","refresh_token"],
///   "code_challenge_methods_supported": ["S256"],
///   "token_endpoint_auth_methods_supported": ["none","client_secret_post"],
///   "id_token_signing_alg_values_supported": ["RS256"],
///   "subject_types_supported": ["public"],
///   "dpop_signing_alg_values_supported": ["ES256","RS256"]
/// }
/// ```
#[instrument(skip(app_conf))]
pub async fn well_known_openid(
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let server_token = skip_authorize();
    let base_url = app_conf.base_url.trim_end_matches('/');

    // We advertise what the server *globally* supports. Per-client specifics (like allowed PKCE methods)
    // can be stricter; by default we allow only S256 for PKCE at the server level.
    let config = serde_json::json!({
        "issuer":                          format!("{}/api/v0/main-frontend/oauth", base_url),
        "authorization_endpoint":          format!("{}/api/v0/main-frontend/oauth/authorize", base_url),
        "token_endpoint":                  format!("{}/api/v0/main-frontend/oauth/token", base_url),
        "userinfo_endpoint":               format!("{}/api/v0/main-frontend/oauth/userinfo", base_url),
        "revocation_endpoint":             format!("{}/api/v0/main-frontend/oauth/revoke", base_url),
        "jwks_uri":                        format!("{}/api/v0/main-frontend/oauth/jwks.json", base_url),

        // Core capabilities
        "response_types_supported":        ["code"],
        "grant_types_supported":           ["authorization_code","refresh_token"],
        "subject_types_supported":         ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],

        // Token endpoint auth: public ("none") and confidential via client_secret_post
        "token_endpoint_auth_methods_supported": ["none","client_secret_post"],

        // PKCE (RFC 7636): server supports S256; "plain" discouraged and typically disabled
        "code_challenge_methods_supported": ["S256"],

        // DPoP (RFC 9449) metadata
        "dpop_signing_alg_values_supported": ["ES256","RS256"],

        // Nice-to-have hints for clients (optional but common)
        "scopes_supported":                ["openid","profile","email","offline_access"],
        "claims_supported":                ["sub","iss","aud","exp","iat","auth_time","nonce","email","email_verified","name","given_name","family_name"],
        "response_modes_supported":        ["query"],
        "userinfo_signing_alg_values_supported": [], // we return plain JSON at /userinfo
    });

    server_token.authorized_ok(HttpResponse::Ok().json(config))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route(
        "/.well-known/openid-configuration",
        web::get().to(well_known_openid),
    )
    .route("/jwks.json", web::get().to(jwks));
}
