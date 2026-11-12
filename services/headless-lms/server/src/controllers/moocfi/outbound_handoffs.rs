/*!
Handlers for HTTP requests to `/api/v0/moocfi/outbound-handoffs`.

The other direction from [`super::credit_registration_handoffs`]: a student leaving courses for mooc.fi
carries a token minted by
[`crate::controllers::main_frontend::credit_registrations::create_my_moocfi_handoff`], and mooc.fi's
backend redeems it here to learn whom to sign in and where to send them.
*/

use std::net::IpAddr;

use actix_web::http::StatusCode;
use headless_lms_base::jwt::{JwtKey, client_ip_hash};
use models::library::oauth::tokens::ACCESS_TOKEN_LENGTH;
use models::moocfi_outbound_handoffs::{MoocfiHandoffDestination, RedeemRefusal};
use once_cell::sync::Lazy;
use secrecy::{ExposeSecret, SecretString};
use sha2::{Digest, Sha256};

use crate::domain::rate_limit_middleware_builder::{EndpointLimiters, RateLimitConfig};
use crate::prelude::*;

/// Per student, so that one student's retries cannot use up the quota of everyone behind mooc.fi.
static PER_STUDENT_LIMITS: Lazy<EndpointLimiters> = Lazy::new(|| {
    EndpointLimiters::from_config(&RateLimitConfig {
        per_minute: Some(20),
        per_hour: Some(200),
        ..Default::default()
    })
});

#[derive(Debug, Deserialize)]
pub struct RedeemOutboundHandoffRequest {
    token: Option<SecretString>,
    /// The IP of the browser that brought the token to mooc.fi, which must be the one it was
    /// minted from.
    client_ip: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RedeemedOutboundHandoff {
    /// The student's TMC user id.
    upstream_id: i32,
    moocfi_course_id: Uuid,
    destination: MoocfiHandoffDestination,
}

/**
POST `/api/v0/moocfi/outbound-handoffs/redeem` - Consumes a handoff a student brought to mooc.fi.

Authorized by `Authorization: Bearer <MOOCFI_HANDOFF_SECRET>`, the secret mooc.fi mints inbound
handoffs with. Body `{ token, client_ip }`. Answers 200 `{ upstream_id, moocfi_course_id,
destination }`; 410 `spent` when the token was redeemed already or has expired; 410 `ip_mismatch`
when `client_ip` is not the IP the token was minted from, which leaves the token unspent; 400
`invalid` when the token is missing, malformed or unknown, or `client_ip` is not an IP; 401 for a
wrong secret; 429 per student; 503 when handoffs are not configured.
*/
#[instrument(skip_all)]
pub async fn redeem_outbound_handoff(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    jwt_key: web::Data<JwtKey>,
    payload: web::Json<RedeemOutboundHandoffRequest>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let Some(handoff_secret) = &app_conf.moocfi_configuration.handoff_secret else {
        return token.authorized_ok(refusal(StatusCode::SERVICE_UNAVAILABLE, "not_configured"));
    };
    if !super::is_authorized(&request, handoff_secret) {
        return token.authorized_ok(refusal(StatusCode::UNAUTHORIZED, "unauthorized"));
    }
    if super::is_over_global_cap() {
        return token.authorized_ok(rate_limited(None));
    }
    let Some(handoff) = payload
        .token
        .as_ref()
        .map(|handoff| handoff.expose_secret().trim())
        .filter(|handoff| {
            handoff.len() == ACCESS_TOKEN_LENGTH
                && handoff.bytes().all(|b| b.is_ascii_alphanumeric())
        })
    else {
        return token.authorized_ok(refusal(StatusCode::BAD_REQUEST, "invalid"));
    };
    let Some(client_ip) = payload
        .client_ip
        .as_deref()
        .and_then(|client_ip| client_ip.trim().parse::<IpAddr>().ok())
    else {
        return token.authorized_ok(refusal(StatusCode::BAD_REQUEST, "invalid"));
    };

    let mut conn = pool.acquire().await?;
    let digest = Sha256::digest(handoff.as_bytes());
    let Some(student_id) =
        models::moocfi_outbound_handoffs::get_student_id(&mut conn, &digest).await?
    else {
        return token.authorized_ok(refusal(StatusCode::BAD_REQUEST, "invalid"));
    };
    if let Err(retry_after) = PER_STUDENT_LIMITS.check_key(student_id.to_string()) {
        return token.authorized_ok(rate_limited(Some(retry_after)));
    }
    match models::moocfi_outbound_handoffs::redeem(
        &mut conn,
        &digest,
        &client_ip_hash(client_ip, &jwt_key),
    )
    .await?
    {
        Ok(redeemed) => {
            info!(outcome = "redeemed", "Redeemed a handoff to mooc.fi");
            token.authorized_ok(HttpResponse::Ok().json(RedeemedOutboundHandoff {
                upstream_id: redeemed.upstream_id,
                moocfi_course_id: redeemed.moocfi_course_id,
                destination: redeemed.destination,
            }))
        }
        Err(RedeemRefusal::IpMismatch) => {
            token.authorized_ok(refusal(StatusCode::GONE, "ip_mismatch"))
        }
        Err(RedeemRefusal::Spent) => token.authorized_ok(refusal(StatusCode::GONE, "spent")),
        Err(RedeemRefusal::Unknown) => {
            token.authorized_ok(refusal(StatusCode::BAD_REQUEST, "invalid"))
        }
    }
}

/// A refused redeem, logged under `kind`, which the body's `type` repeats.
fn refusal(status: StatusCode, kind: &'static str) -> HttpResponse {
    warn!(outcome = kind, "Refused to redeem a handoff to mooc.fi");
    HttpResponse::build(status).json(serde_json::json!({ "type": kind }))
}

fn rate_limited(retry_after: Option<std::time::Duration>) -> HttpResponse {
    super::with_retry_after(
        refusal(StatusCode::TOO_MANY_REQUESTS, "rate_limited"),
        retry_after,
    )
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/redeem", web::post().to(redeem_outbound_handoff));
}
