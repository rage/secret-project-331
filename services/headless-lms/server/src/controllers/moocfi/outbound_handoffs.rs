/*!
Handlers for HTTP requests to `/api/v0/moocfi/outbound-handoffs`.

The other direction from [`super::credit_registration_handoffs`]: a student leaving courses for mooc.fi
carries a token minted by
[`crate::controllers::main_frontend::credit_registrations::create_my_moocfi_handoff`], and mooc.fi's
backend redeems it here to learn whom to sign in and where to send them.
*/

use actix_web::http::StatusCode;
use models::moocfi_outbound_handoffs::{MoocfiHandoffDestination, RedeemRefusal};
use secrecy::{ExposeSecret, SecretString};
use sha2::{Digest, Sha256};

use crate::domain::authentication::{authorization_credential, constant_time_eq_str};
use crate::prelude::*;

#[derive(Debug, Deserialize)]
pub struct RedeemOutboundHandoffRequest {
    token: Option<SecretString>,
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
handoffs with. Answers 200 `{ upstream_id, moocfi_course_id, destination }`; 410 when the token was
redeemed already or has expired; 400 when it is missing or unknown; 401 for a wrong secret; 503 when
handoffs are not configured.
*/
#[instrument(skip_all)]
pub async fn redeem_outbound_handoff(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<RedeemOutboundHandoffRequest>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let Some(handoff_secret) = &app_conf.moocfi_configuration.handoff_secret else {
        return token.authorized_ok(refusal(StatusCode::SERVICE_UNAVAILABLE, "not_configured"));
    };
    let is_authorized = authorization_credential(&request, "Bearer")
        .is_some_and(|provided| constant_time_eq_str(provided, handoff_secret.expose_secret()));
    if !is_authorized {
        return token.authorized_ok(refusal(StatusCode::UNAUTHORIZED, "unauthorized"));
    }
    let Some(handoff) = payload
        .token
        .as_ref()
        .map(|handoff| handoff.expose_secret().trim())
        .filter(|handoff| !handoff.is_empty())
    else {
        return token.authorized_ok(refusal(StatusCode::BAD_REQUEST, "invalid"));
    };

    let mut conn = pool.acquire().await?;
    let digest = Sha256::digest(handoff.as_bytes());
    match models::moocfi_outbound_handoffs::redeem(&mut conn, &digest).await? {
        Ok(redeemed) => {
            info!(outcome = "redeemed", "Redeemed a handoff to mooc.fi");
            token.authorized_ok(HttpResponse::Ok().json(RedeemedOutboundHandoff {
                upstream_id: redeemed.upstream_id,
                moocfi_course_id: redeemed.moocfi_course_id,
                destination: redeemed.destination,
            }))
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

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/redeem", web::post().to(redeem_outbound_handoff));
}
