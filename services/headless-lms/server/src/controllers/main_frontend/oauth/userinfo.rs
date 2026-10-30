use crate::domain::oauth::dpop::verify_dpop_from_actix;
use crate::domain::oauth::helpers::oauth_invalid_token;
use crate::domain::oauth::userinfo_response::UserInfoResponse;
use crate::prelude::*;
use actix_web::{HttpResponse, guard, web};
use dpop_verifier::DpopError;
use headless_lms_base::config::ApplicationConfiguration;
use models::{
    library::oauth::{bearer::split_authorization, token_digest_sha256},
    oauth_access_token::{OAuthAccessToken, TokenType},
    oauth_client::OAuthClient,
    user_details,
};
use std::collections::HashSet;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(user_info_get_doc, user_info_post_doc))]
#[allow(dead_code)]
pub(crate) struct MainFrontendOauthUserInfoApiDoc;

/// Handles `/userinfo` for returning user claims according to granted scopes.
///
/// - Validates access token (Bearer or DPoP-bound)
/// - For DPoP tokens: requires valid DPoP proof (JKT + ATH)
/// - For Bearer tokens: requires client.bearer_allowed = true
/// - Returns `sub` always; `first_name`/`last_name` with `profile`; `email` with `email`
///
/// Follows OIDC Core §5.3.
#[instrument(skip(pool, app_conf, req))]
pub async fn user_info(
    pool: web::Data<sqlx::PgPool>,
    req: actix_web::HttpRequest,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let auth = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| oauth_invalid_token("missing Authorization header"))?;

    let (presented_scheme, raw_token) = match split_authorization(auth) {
        Some((scheme, token)) if scheme.eq_ignore_ascii_case("DPoP") => (TokenType::DPoP, token),
        Some((scheme, token)) if scheme.eq_ignore_ascii_case("Bearer") => {
            (TokenType::Bearer, token)
        }
        _ => return Err(oauth_invalid_token("unsupported auth scheme")),
    };

    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    let digest = token_digest_sha256(raw_token, token_hmac_key);
    let access = OAuthAccessToken::find_valid(&mut conn, digest).await?;

    // Add non-secret fields to the span for observability
    tracing::Span::current().record("token_type", format!("{:?}", access.token_type));
    tracing::Span::current().record("client_id", access.client_id.to_string());

    match access.token_type {
        TokenType::Bearer => {
            // Bearer tokens must use the Bearer scheme
            if presented_scheme != TokenType::Bearer {
                return Err(oauth_invalid_token("bearer token must use Bearer scheme"));
            }

            let client = OAuthClient::find_by_id(&mut conn, access.client_id).await?;
            if !client.bearer_allowed {
                return Err(oauth_invalid_token(
                    "client not allowed to use bearer tokens",
                ));
            }
        }
        TokenType::DPoP => {
            // DPoP-bound tokens must use DPoP scheme + valid proof
            if presented_scheme != TokenType::DPoP {
                return Err(oauth_invalid_token("DPoP-bound token must use DPoP scheme"));
            }

            let bound_jkt = access
                .dpop_jkt
                .as_deref()
                .ok_or_else(|| oauth_invalid_token("token marked DPoP but missing cnf.jkt"))?;

            // Verify proof (includes `ath` = hash of raw_token)
            let presented_jkt = verify_dpop_from_actix(
                &mut conn,
                &req,
                req.method().as_str(),
                &app_conf.oauth_server_configuration.dpop_nonce_key,
                Some(raw_token),
            )
            .await?;
            // Verify JKT (JWK thumbprint) binding: the DPoP proof's key must match the token's bound key
            // Note: DpopError::AthMismatch is used here because the external dpop_verifier crate
            // doesn't provide a JktMismatch variant. This check verifies JKT binding, not ATH (access token hash).
            // TODO: Change this after dpop_verifier is updated to provide a JktMismatch variant.
            if presented_jkt != bound_jkt {
                return Err(DpopError::AthMismatch.into());
            }
        }
    }

    let user_id = match access.user_id {
        Some(u) => u,
        None => {
            return Err(oauth_invalid_token("token has no associated user"));
        }
    };

    let user = user_details::get_user_details_by_user_id(&mut conn, user_id).await?;
    let scopes: HashSet<String> = HashSet::from_iter(access.scopes.into_iter());

    let mut res = UserInfoResponse {
        sub: user_id.to_string(),
        first_name: None,
        last_name: None,
        email: None,
        email_verified: None,
    };

    if scopes.contains("profile") {
        res.first_name = user.first_name.clone();
        res.last_name = user.last_name.clone();
    }
    if scopes.contains("email") {
        res.email = Some(user.email.clone());
        res.email_verified = Some(user.email_verified_at.is_some());
    }

    // Best practice: prevent caching
    server_token.authorized_ok(
        HttpResponse::Ok()
            .insert_header(("Cache-Control", "no-store"))
            .json(res),
    )
}

#[utoipa::path(
    get,
    path = "/userinfo",
    operation_id = "getOauthUserInfo",
    tag = "oauth",
    responses(
        (status = 200, description = "OAuth userinfo response", body = serde_json::Value),
        (status = 401, description = "Invalid token")
    )
)]
#[allow(dead_code)]
pub(crate) fn user_info_get_doc() {}

#[utoipa::path(
    post,
    path = "/userinfo",
    operation_id = "postOauthUserInfo",
    tag = "oauth",
    responses(
        (status = 200, description = "OAuth userinfo response", body = serde_json::Value),
        (status = 401, description = "Invalid token")
    )
)]
#[allow(dead_code)]
pub(crate) fn user_info_post_doc() {}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route(
        "/userinfo",
        web::route()
            .guard(guard::Any(guard::Get()).or(guard::Post()))
            .to(user_info),
    );
}
