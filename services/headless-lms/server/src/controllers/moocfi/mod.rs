/*!
Handlers for HTTP requests to `/api/v0/moocfi`, which mooc.fi's backend calls server to server.

Rate limits are keyed inside the handlers, after the shared secret checks out: every call comes
from mooc.fi's few egress addresses, so a limit keyed on the request's own IP would be one quota
for every student.
*/

pub mod credit_registration_handoffs;
pub mod outbound_handoffs;

use once_cell::sync::Lazy;
use secrecy::{ExposeSecret, SecretString};

use crate::domain::authentication::{authorization_credential, constant_time_eq_str};
use crate::domain::rate_limit_middleware_builder::{EndpointLimiters, RateLimitConfig};
use crate::prelude::*;

/// A safety net against a runaway caller, far above any real peak of students pressing the button.
static GLOBAL_LIMITS: Lazy<EndpointLimiters> = Lazy::new(|| {
    EndpointLimiters::from_config(&RateLimitConfig {
        per_minute: Some(6000),
        ..Default::default()
    })
});

/// Whether the request carries `Authorization: Bearer <handoff_secret>`, mooc.fi's credential.
fn is_authorized(request: &HttpRequest, handoff_secret: &SecretString) -> bool {
    authorization_credential(request, "Bearer")
        .is_some_and(|provided| constant_time_eq_str(provided, handoff_secret.expose_secret()))
}

/// Counts an authorized call against [`GLOBAL_LIMITS`], shared by every route here.
fn is_over_global_cap() -> bool {
    GLOBAL_LIMITS.check_key(String::new()).is_err()
}

/// Tells the caller when to try again, if a limiter said.
fn with_retry_after(
    mut response: HttpResponse,
    retry_after: Option<std::time::Duration>,
) -> HttpResponse {
    if let Some(retry_after) = retry_after {
        response.headers_mut().insert(
            actix_web::http::header::RETRY_AFTER,
            retry_after.as_secs().max(1).into(),
        );
    }
    response
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(
        web::scope("/credit-registration-handoffs")
            .configure(credit_registration_handoffs::_add_routes),
    )
    .service(web::scope("/outbound-handoffs").configure(outbound_handoffs::_add_routes));
}
