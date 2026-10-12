/*!
Handlers for HTTP requests to `/api/v0/main-frontend/moocfi-handoffs`.

The student's browser arrives here by a top-level navigation from mooc.fi's credit registration page,
carrying a handoff minted by [`crate::controllers::moocfi::credit_registration_handoffs`]. Every answer
is a 303: to the registration page when the handoff signs the student in, and otherwise to the normal
login, so a failed check never signs anyone in.
*/

use actix_session::Session;
use actix_web::http::header;
use headless_lms_base::jwt::{JwtKey, MoocfiHandoffClaim};
use jsonwebtoken::errors::ErrorKind;

use crate::domain::authentication::{self, session_user_id};
use crate::domain::oauth::redirects::pct_encode;
use crate::domain::rate_limit_middleware_builder::{RateLimit, RateLimitConfig, request_client_ip};
use crate::prelude::*;

/// The query parameter the handoff travels in; `redacted_request_line` drops its value from the
/// access log, as it does every query value.
#[derive(Debug, Deserialize)]
pub struct RedeemQuery {
    token: Option<String>,
}

/// How one redeem ended, for the logs. Never logged with the IP.
#[derive(Debug, Clone, Copy)]
enum RedeemOutcome {
    SignedIn,
    AlreadySignedIn,
    Invalid,
    Expired,
    NotSameSite,
    IpMismatch,
    DifferentUser,
}

impl RedeemOutcome {
    fn as_str(self) -> &'static str {
        match self {
            Self::SignedIn => "signed_in",
            Self::AlreadySignedIn => "already_signed_in",
            Self::Invalid => "invalid",
            Self::Expired => "expired",
            Self::NotSameSite => "not_same_site",
            Self::IpMismatch => "ip_mismatch",
            Self::DifferentUser => "different_user",
        }
    }
}

/**
GET `/api/v0/main-frontend/moocfi-handoffs/redeem?token=…` - Signs in the student a mooc.fi handoff
was minted for and sends them to the course's registration page.

The handoff must be unexpired (no leeway), arrive in a same-site navigation, and come from the IP it
was minted for. A different account already signed in is never switched: the student is sent to
`/completion-registration/mooc-fi/{moocfi_course_id}/handoff-error?reason=different_user_signed_in`.
*/
#[instrument(skip_all)]
pub async fn redeem_moocfi_handoff(
    request: HttpRequest,
    session: Session,
    pool: web::Data<PgPool>,
    jwt_key: web::Data<JwtKey>,
    query: web::Query<RedeemQuery>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let Some(handoff) = query.token.as_deref() else {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::Invalid, None));
    };
    let claim = match MoocfiHandoffClaim::validate(handoff, &jwt_key) {
        Ok(claim) => claim,
        Err(error) if matches!(error.kind(), ErrorKind::ExpiredSignature) => {
            let moocfi_course_id = MoocfiHandoffClaim::read_ignoring_expiry(handoff, &jwt_key)
                .ok()
                .map(|claim| claim.moocfi_course_id);
            return token
                .authorized_ok(fall_back_to_login(RedeemOutcome::Expired, moocfi_course_id));
        }
        Err(_) => return token.authorized_ok(fall_back_to_login(RedeemOutcome::Invalid, None)),
    };
    let moocfi_course_id = claim.moocfi_course_id;

    // Browsers set this header and pages cannot forge it, so only a navigation from a mooc.fi page
    // gets through. Same-origin is a stricter case of same-site, and is what dev's mock page sends.
    let is_same_site = request
        .headers()
        .get("Sec-Fetch-Site")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value == "same-site" || value == "same-origin");
    if !is_same_site {
        return token.authorized_ok(fall_back_to_login(
            RedeemOutcome::NotSameSite,
            Some(moocfi_course_id),
        ));
    }
    // The binding that stops login CSRF: an attacker can only mint for their own IP.
    if !request_client_ip(&request).is_some_and(|client_ip| claim.is_bound_to(client_ip, &jwt_key))
    {
        return token.authorized_ok(fall_back_to_login(
            RedeemOutcome::IpMismatch,
            Some(moocfi_course_id),
        ));
    }

    match session_user_id(&session) {
        Some(user_id) if user_id == claim.user_id => {
            log_outcome(RedeemOutcome::AlreadySignedIn);
            return token.authorized_ok(see_other(&registration_page_path(moocfi_course_id)));
        }
        Some(_) => {
            log_outcome(RedeemOutcome::DifferentUser);
            return token.authorized_ok(see_other(&format!(
                "{}/handoff-error?reason=different_user_signed_in",
                registration_page_path(moocfi_course_id)
            )));
        }
        None => {}
    }

    let mut conn = pool.acquire().await?;
    let Ok(user) = models::users::get_by_id(&mut conn, claim.user_id).await else {
        return token.authorized_ok(fall_back_to_login(
            RedeemOutcome::Invalid,
            Some(moocfi_course_id),
        ));
    };
    // Against session fixation: the signed-in session must not reuse an id issued before sign-in.
    session.renew();
    authentication::remember(&session, user)?;
    log_outcome(RedeemOutcome::SignedIn);
    token.authorized_ok(see_other(&registration_page_path(moocfi_course_id)))
}

/// The page a redeemed handoff lands on.
fn registration_page_path(moocfi_course_id: Uuid) -> String {
    format!("/completion-registration/mooc-fi/{moocfi_course_id}")
}

fn fall_back_to_login(outcome: RedeemOutcome, moocfi_course_id: Option<Uuid>) -> HttpResponse {
    log_outcome(outcome);
    let location = match moocfi_course_id {
        Some(moocfi_course_id) => format!(
            "/login?return_to={}",
            pct_encode(&registration_page_path(moocfi_course_id))
        ),
        None => "/login".to_string(),
    };
    see_other(&location)
}

fn see_other(location: &str) -> HttpResponse {
    HttpResponse::SeeOther()
        .insert_header((header::LOCATION, location))
        .insert_header((header::CACHE_CONTROL, "no-store"))
        .finish()
}

fn log_outcome(outcome: RedeemOutcome) {
    info!(outcome = outcome.as_str(), "Redeemed a mooc.fi handoff");
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/redeem")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: Some(10),
                per_hour: Some(60),
                ..Default::default()
            }))
            .route(web::get().to(redeem_moocfi_handoff)),
    );
}
