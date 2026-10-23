//! Authentication and rate limiting for the MCP server at `/api/v0/mcp`.
//!
//! Wrap the MCP route scope in [`McpAuth`]. It validates the Bearer token for the MCP audience,
//! answers 401 with the RFC 9728 `resource_metadata` challenge that starts the client's OAuth
//! flow, limits requests per user and per grant, and puts the [`McpPrincipal`] in the request
//! extensions for the handler.

use std::{num::NonZeroU32, rc::Rc, sync::Arc};

use actix_web::{
    Error, HttpMessage, HttpResponse,
    body::{EitherBody, MessageBody},
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    http::{StatusCode, header},
    web,
};
use futures::future::{LocalBoxFuture, Ready, ready};
use governor::{
    Quota, RateLimiter,
    clock::{Clock, DefaultClock},
    state::keyed::DefaultKeyedStateStore,
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::library::oauth::mcp::{
    McpPrincipal, McpTokenError, all_mcp_scopes_string, authenticate_mcp_access_token,
};
use sqlx::PgPool;

/// The canonical URL of the MCP server: the RFC 8707 resource MCP tokens are bound to.
pub fn mcp_resource_url(app_conf: &ApplicationConfiguration) -> String {
    format!("{}/api/v0/mcp", app_conf.base_url.trim_end_matches('/'))
}

/// The issuer of this server's OAuth authorization server.
pub fn oauth_issuer(app_conf: &ApplicationConfiguration) -> String {
    format!(
        "{}/api/v0/main-frontend/oauth",
        app_conf.base_url.trim_end_matches('/')
    )
}

/// Where the MCP server's RFC 9728 protected resource metadata is served.
pub fn protected_resource_metadata_url(app_conf: &ApplicationConfiguration) -> String {
    format!(
        "{}/.well-known/oauth-protected-resource/api/v0/mcp",
        app_conf.base_url.trim_end_matches('/')
    )
}

/// The `WWW-Authenticate` value for a 401 from the MCP server. `error` is the RFC 6750 error code
/// and description, absent when no token was sent.
pub fn www_authenticate_challenge(
    app_conf: &ApplicationConfiguration,
    error: Option<(&str, &str)>,
) -> String {
    let mut challenge = format!(
        r#"Bearer resource_metadata="{}", scope="{}""#,
        protected_resource_metadata_url(app_conf),
        all_mcp_scopes_string()
    );
    if let Some((code, description)) = error {
        challenge.push_str(&format!(
            r#", error="{}", error_description="{}""#,
            code,
            description.replace('\\', "\\\\").replace('"', "\\\"")
        ));
    }
    challenge
}

/// Requests one grant may make; a user's grants together get twice that, so one runaway agent
/// cannot use up the quota of the user's other agent.
const PER_GRANT_PER_MINUTE: u32 = 120;
const PER_GRANT_PER_HOUR: u32 = 3000;
const TEST_MODE_MULTIPLIER: u32 = 100;

type KeyedLimiter = RateLimiter<String, DefaultKeyedStateStore<String>, DefaultClock>;

struct Limiters {
    per_grant: [KeyedLimiter; 2],
    per_user: [KeyedLimiter; 2],
}

impl Limiters {
    fn new(test_mode: bool) -> Self {
        let multiplier = if test_mode { TEST_MODE_MULTIPLIER } else { 1 };
        let limiter = |n: u32, quota: fn(NonZeroU32) -> Quota| {
            RateLimiter::keyed(quota(
                NonZeroU32::new(n * multiplier).unwrap_or(NonZeroU32::MIN),
            ))
        };
        Self {
            per_grant: [
                limiter(PER_GRANT_PER_MINUTE, Quota::per_minute),
                limiter(PER_GRANT_PER_HOUR, Quota::per_hour),
            ],
            per_user: [
                limiter(2 * PER_GRANT_PER_MINUTE, Quota::per_minute),
                limiter(2 * PER_GRANT_PER_HOUR, Quota::per_hour),
            ],
        }
    }

    /// Counts one request for the grant and for its user, and returns how long to wait when
    /// either is over a limit.
    fn check(&self, principal: &McpPrincipal) -> Option<std::time::Duration> {
        let clock = DefaultClock::default();
        let grant_key = principal.grant_id.to_string();
        let user_key = principal.user_id.to_string();
        let checks = self
            .per_grant
            .iter()
            .map(|limiter| limiter.check_key(&grant_key))
            .chain(
                self.per_user
                    .iter()
                    .map(|limiter| limiter.check_key(&user_key)),
            );
        checks
            .filter_map(Result::err)
            .map(|negative| negative.wait_time_from(clock.now()))
            .max()
    }
}

/// Middleware for the MCP route scope; see the module documentation.
#[derive(Clone)]
pub struct McpAuth {
    limiters: Arc<Limiters>,
}

impl McpAuth {
    pub fn new(test_mode: bool) -> Self {
        Self {
            limiters: Arc::new(Limiters::new(test_mode)),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for McpAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = McpAuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(McpAuthMiddleware {
            service: Rc::new(service),
            limiters: self.limiters.clone(),
        }))
    }
}

pub struct McpAuthMiddleware<S> {
    service: Rc<S>,
    limiters: Arc<Limiters>,
}

impl<S, B> Service<ServiceRequest> for McpAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    actix_web::dev::forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let limiters = self.limiters.clone();
        Box::pin(async move {
            let (Some(pool), Some(app_conf)) = (
                req.app_data::<web::Data<PgPool>>().cloned(),
                req.app_data::<web::Data<ApplicationConfiguration>>()
                    .cloned(),
            ) else {
                return Ok(req.into_response(
                    HttpResponse::InternalServerError()
                        .finish()
                        .map_into_right_body(),
                ));
            };
            let token = req
                .headers()
                .get(header::AUTHORIZATION)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.strip_prefix("Bearer "))
                .map(str::to_string);
            let Some(token) = token else {
                return Ok(unauthorized(req, &app_conf, None));
            };
            let mut conn = pool
                .acquire()
                .await
                .map_err(actix_web::error::ErrorInternalServerError)?;
            let principal = match authenticate_mcp_access_token(
                &mut conn,
                &token,
                &app_conf.oauth_server_configuration.oauth_token_hmac_key,
                &mcp_resource_url(&app_conf),
            )
            .await
            {
                Ok(principal) => principal,
                Err(McpTokenError::InvalidToken(description)) => {
                    return Ok(unauthorized(
                        req,
                        &app_conf,
                        Some(("invalid_token", description)),
                    ));
                }
                Err(McpTokenError::Database(err)) => {
                    return Err(actix_web::error::ErrorInternalServerError(err));
                }
            };
            drop(conn);

            if let Some(wait) = limiters.check(&principal) {
                let response = HttpResponse::build(StatusCode::TOO_MANY_REQUESTS)
                    .insert_header((header::RETRY_AFTER, wait.as_secs().max(1).to_string()))
                    .finish();
                return Ok(req.into_response(response).map_into_right_body());
            }

            req.extensions_mut().insert(principal);
            service.call(req).await.map(|res| res.map_into_left_body())
        })
    }
}

fn unauthorized<B>(
    req: ServiceRequest,
    app_conf: &ApplicationConfiguration,
    error: Option<(&str, &str)>,
) -> ServiceResponse<EitherBody<B>> {
    let response = HttpResponse::Unauthorized()
        .insert_header((
            header::WWW_AUTHENTICATE,
            www_authenticate_challenge(app_conf, error),
        ))
        .finish();
    req.into_response(response).map_into_right_body()
}
