use crate::domain::oauth::dpop::verify_dpop_from_actix;
use crate::domain::oauth::userinfo_response::UserInfoResponse;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use domain::error::{OAuthErrorCode, OAuthErrorData};
use dpop_verifier::DpopError;
use headless_lms_utils::ApplicationConfiguration;
use models::{
    library::oauth::token_digest_sha256,
    oauth_access_token::{OAuthAccessToken, TokenType},
    oauth_client::OAuthClient,
    user_details,
};
use std::collections::HashSet;

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

    // ---- Parse Authorization header ----
    let auth = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidToken.as_str().into(),
                    error_description: "missing Authorization header".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "missing Authorization header",
                None::<anyhow::Error>,
            )
        })?;

    let (presented_scheme, raw_token) = if let Some(t) = auth.strip_prefix("DPoP ") {
        ("DPoP", t)
    } else if let Some(t) = auth.strip_prefix("Bearer ") {
        ("Bearer", t)
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                error: OAuthErrorCode::InvalidToken.as_str().into(),
                error_description: "unsupported auth scheme".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            })),
            "unsupported auth scheme",
            None::<anyhow::Error>,
        ));
    };

    // ---- Look up token by digest ----
    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    let digest = token_digest_sha256(raw_token, token_hmac_key);
    let access = OAuthAccessToken::find_valid(&mut conn, digest).await?;

    // Add non-secret fields to the span for observability
    tracing::Span::current().record("token_type", format!("{:?}", access.token_type));
    tracing::Span::current().record("client_id", access.client_id.to_string());

    // ---- Enforce scheme/token_type consistency ----
    match access.token_type {
        TokenType::Bearer => {
            // Bearer tokens must use the Bearer scheme
            if presented_scheme != "Bearer" {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidToken.as_str().into(),
                        error_description: "bearer token must use Bearer scheme".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "wrong auth scheme for bearer token",
                    None::<anyhow::Error>,
                ));
            }

            let client = OAuthClient::find_by_id(&mut conn, access.client_id).await?;
            if !client.bearer_allowed {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidToken.as_str().into(),
                        error_description: "client not allowed to use bearer tokens".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "client not bearer-allowed",
                    None::<anyhow::Error>,
                ));
            }
        }
        TokenType::DPoP => {
            // DPoP-bound tokens must use DPoP scheme + valid proof
            if presented_scheme != "DPoP" {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidToken.as_str().into(),
                        error_description: "DPoP-bound token must use DPoP scheme".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "wrong auth scheme for DPoP token",
                    None::<anyhow::Error>,
                ));
            }

            let bound_jkt = access.dpop_jkt.as_deref().ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidToken.as_str().into(),
                        error_description: "token marked DPoP but missing cnf.jkt".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "dpop token missing jkt",
                    None::<anyhow::Error>,
                )
            })?;

            // Verify proof (includes `ath` = hash of raw_token)
            let presented_jkt = verify_dpop_from_actix(
                &mut conn,
                &req,
                "GET",
                &app_conf.oauth_server_configuration.dpop_nonce_key,
                Some(raw_token),
            )
            .await?;
            if presented_jkt != bound_jkt {
                return Err(DpopError::AthMismatch.into());
            }
        }
    }

    // ---- Ensure token is for a user ----
    let user_id = match access.user_id {
        Some(u) => u,
        None => {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidToken.as_str().into(),
                    error_description: "token has no associated user".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "token has no associated user",
                None::<anyhow::Error>,
            ));
        }
    };

    // ---- Fetch user and scopes ----
    let user = user_details::get_user_details_by_user_id(&mut conn, user_id).await?;
    let scopes: HashSet<String> = HashSet::from_iter(access.scopes.into_iter());

    let mut res = UserInfoResponse {
        sub: user_id.to_string(),
        first_name: None,
        last_name: None,
        email: None,
    };

    if scopes.contains("profile") {
        res.first_name = user.first_name.clone();
        res.last_name = user.last_name.clone();
    }
    if scopes.contains("email") {
        res.email = Some(user.email.clone());
    }

    // Best practice: prevent caching
    server_token.authorized_ok(
        HttpResponse::Ok()
            .insert_header(("Cache-Control", "no-store"))
            .json(res),
    )
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/userinfo", web::get().to(user_info));
}
