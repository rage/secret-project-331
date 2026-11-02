/*!
Handlers for HTTP requests to `/api/v0/main-frontend/moocfi-handoffs`.

The student's browser arrives at `redeem` by a top-level navigation from mooc.fi's credit registration
page, or from Elements of AI's, carrying a handoff minted by
[`crate::controllers::moocfi::credit_registration_handoffs`]. Every answer to the navigation is a 303,
never JSON:

- the right account signed in: on to the registration page;
- nobody signed in, same-site: signed in, then on to the registration page;
- another account signed in, or a cross-site arrival: to the landing page, with a continuation in an
  HttpOnly cookie that `continue` completes once the student confirms. Nobody is signed in on a
  cross-site GET, which would allow login CSRF;
- anything else: to the normal login, which never signs anyone in.
*/

use std::net::IpAddr;

use actix_session::Session;
use actix_web::cookie::{Cookie, SameSite, time::Duration as CookieDuration};
use actix_web::http::header;
use headless_lms_base::jwt::{
    JwtKey, MoocfiHandoffClaim, MoocfiHandoffContinuationClaim, sign_hs256_claim,
};
use once_cell::sync::Lazy;
use utoipa::{OpenApi, ToSchema};

use crate::domain::authentication::{self, session_user_id};
use crate::domain::oauth::redirects::pct_encode;
use crate::domain::rate_limit_middleware_builder::{
    EndpointLimiters, RateLimitConfig, request_client_ip,
};
use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_pending_moocfi_handoff, continue_moocfi_handoff))]
pub(crate) struct MainFrontendMoocfiHandoffsApiDoc;

/// `redacted_request_line` drops its value from the access log, as it does every query value.
#[derive(Debug, Deserialize)]
pub struct RedeemQuery {
    token: Option<String>,
}

const CONTINUATION_COOKIE: &str = "moocfi_handoff_continuation";
const CONTINUATION_COOKIE_PATH: &str = "/api/v0/main-frontend/moocfi-handoffs";

/// Must match the reasons the landing page reads.
const REASON_DIFFERENT_ACCOUNT: &str = "different_account";
const REASON_CONFIRM: &str = "confirm";
const REASON_RATE_LIMITED: &str = "rate_limited";

/// A lecture hall shares one address behind a campus NAT, so per IP this is only a coarse cap.
static PER_IP_LIMITS: Lazy<EndpointLimiters> = Lazy::new(|| {
    EndpointLimiters::from_config(&RateLimitConfig {
        per_minute: Some(600),
        per_hour: Some(6000),
        ..Default::default()
    })
});

/// Keyed by the student the handoff is for, which is what the per-IP cap cannot tell apart.
static PER_STUDENT_LIMITS: Lazy<EndpointLimiters> = Lazy::new(|| {
    EndpointLimiters::from_config(&RateLimitConfig {
        per_minute: Some(20),
        per_hour: Some(200),
        ..Default::default()
    })
});

/// How one redeem ended, for the logs. Never logged with the IP.
#[derive(Debug, Clone, Copy)]
enum RedeemOutcome {
    SignedIn,
    AlreadySignedIn,
    Invalid,
    Expired,
    IpMismatch,
    RateLimited,
    DifferentAccount,
    DifferentAccountNotContinuable,
    NeedsConfirmation,
}

impl RedeemOutcome {
    fn as_str(self) -> &'static str {
        match self {
            Self::SignedIn => "signed_in",
            Self::AlreadySignedIn => "already_signed_in",
            Self::Invalid => "invalid",
            Self::Expired => "expired",
            Self::IpMismatch => "ip_mismatch",
            Self::RateLimited => "rate_limited",
            Self::DifferentAccount => "different_account",
            Self::DifferentAccountNotContinuable => "different_account_not_continuable",
            Self::NeedsConfirmation => "needs_confirmation",
        }
    }
}

/**
GET `/api/v0/main-frontend/moocfi-handoffs/redeem?token=…` - Signs in the student a mooc.fi handoff
was minted for and sends them to the course's registration page, or to the landing page at
`/completion-registration/mooc-fi/{moocfi_course_id}/handoff?reason=…` to confirm first.
*/
#[instrument(skip_all)]
pub async fn redeem_moocfi_handoff(
    request: HttpRequest,
    session: Session,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    jwt_key: web::Data<JwtKey>,
    query: web::Query<RedeemQuery>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let client_ip = request_client_ip(&request);
    // Only the signature first: a different account is told so even when the handoff has expired.
    let Some(claim) = query
        .token
        .as_deref()
        .and_then(|handoff| MoocfiHandoffClaim::read_ignoring_expiry(handoff, &jwt_key).ok())
    else {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::Invalid, None));
    };
    let moocfi_course_id = claim.moocfi_course_id;
    let is_ip_limited =
        client_ip.is_some_and(|client_ip| PER_IP_LIMITS.check_key(client_ip.to_string()).is_err());
    if is_ip_limited
        || PER_STUDENT_LIMITS
            .check_key(claim.user_id.to_string())
            .is_err()
    {
        log_outcome(RedeemOutcome::RateLimited);
        return token.authorized_ok(see_other(&landing_page_path(
            moocfi_course_id,
            REASON_RATE_LIMITED,
        )));
    }
    let is_unexpired = query
        .token
        .as_deref()
        .is_some_and(|handoff| MoocfiHandoffClaim::validate(handoff, &jwt_key).is_ok());
    // The binding that stops login CSRF: an attacker can only mint for their own IP.
    let is_bound = client_ip.is_some_and(|client_ip| claim.is_bound_to(client_ip, &jwt_key));

    // The session cookie is SameSite=Strict, so a cross-site arrival never gets this far.
    match session_user_id(&session) {
        Some(user_id) if user_id == claim.user_id => {
            log_outcome(RedeemOutcome::AlreadySignedIn);
            return token.authorized_ok(see_other(&registration_page_path(&claim)));
        }
        Some(_) if is_unexpired && is_bound => {
            log_outcome(RedeemOutcome::DifferentAccount);
            return token.authorized_ok(to_landing_with_continuation(
                &claim,
                REASON_DIFFERENT_ACCOUNT,
                &app_conf,
                &jwt_key,
            )?);
        }
        Some(_) => {
            log_outcome(RedeemOutcome::DifferentAccountNotContinuable);
            return token.authorized_ok(see_other(&landing_page_path(
                moocfi_course_id,
                REASON_DIFFERENT_ACCOUNT,
            )));
        }
        None => {}
    }
    if !is_unexpired {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::Expired, Some(&claim)));
    }
    if !is_bound {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::IpMismatch, Some(&claim)));
    }
    if !is_same_site(&request) {
        log_outcome(RedeemOutcome::NeedsConfirmation);
        return token.authorized_ok(to_landing_with_continuation(
            &claim,
            REASON_CONFIRM,
            &app_conf,
            &jwt_key,
        )?);
    }

    let mut conn = pool.acquire().await?;
    let Ok(user) = models::users::get_by_id(&mut conn, claim.user_id).await else {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::Invalid, Some(&claim)));
    };
    // Against session fixation: the signed-in session must not reuse an id issued before sign-in.
    session.renew();
    authentication::remember(&session, user)?;
    log_outcome(RedeemOutcome::SignedIn);
    token.authorized_ok(see_other(&registration_page_path(&claim)))
}

/// Which account a pending continuation would sign in, beside whoever is signed in now.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct PendingMoocfiHandoff {
    pub moocfi_course_id: Uuid,
    /// Enough of the handoff account's email for the student to recognise it.
    pub masked_email: String,
    pub signed_in_account: SignedInAccount,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SignedInAccount {
    /// The handoff's own account.
    Same,
    Different,
    None,
}

/**
GET `/api/v0/main-frontend/moocfi-handoffs/pending` - The handoff waiting for the student's
confirmation on the landing page, or 404 when none is waiting, it has expired, or it was minted for
another IP.
*/
#[instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/pending",
    operation_id = "getPendingMoocfiHandoff",
    tag = "moocfi-handoffs",
    responses(
        (status = 200, description = "The waiting handoff", body = PendingMoocfiHandoff),
        (status = 404, description = "No handoff is waiting")
    )
)]
pub async fn get_pending_moocfi_handoff(
    request: HttpRequest,
    session: Session,
    pool: web::Data<PgPool>,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<PendingMoocfiHandoff>> {
    let token = skip_authorize();
    let continuation = valid_continuation(&request, &jwt_key)?;
    let mut conn = pool.acquire().await?;
    let email =
        models::user_details::get_user_details_by_user_id(&mut conn, continuation.handoff_user_id)
            .await?
            .email;
    let signed_in_account = match session_user_id(&session) {
        Some(user_id) if user_id == continuation.handoff_user_id => SignedInAccount::Same,
        Some(_) => SignedInAccount::Different,
        None => SignedInAccount::None,
    };
    token.authorized_ok(web::Json(PendingMoocfiHandoff {
        moocfi_course_id: continuation.moocfi_course_id,
        masked_email: mask_email(&email),
        signed_in_account,
    }))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ContinuedMoocfiHandoff {
    /// The registration page; open it with a full navigation so the new session takes over.
    pub redirect_path: String,
}

/**
POST `/api/v0/main-frontend/moocfi-handoffs/continue` - Completes the waiting handoff: signs out
whoever is signed in and signs in the handoff's account.

Only from a same-origin request, and the continuation cookie is SameSite=Lax, so another site cannot
post it. 404 when no handoff is waiting.
*/
#[instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/continue",
    operation_id = "continueMoocfiHandoff",
    tag = "moocfi-handoffs",
    responses(
        (status = 200, description = "Signed in; where to go next", body = ContinuedMoocfiHandoff),
        (status = 404, description = "No handoff is waiting")
    )
)]
pub async fn continue_moocfi_handoff(
    request: HttpRequest,
    session: Session,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let is_same_origin = request
        .headers()
        .get("Sec-Fetch-Site")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value == "same-origin");
    if !is_same_origin {
        return Err(controller_err!(Forbidden, "Forbidden.".to_string()));
    }
    let continuation = valid_continuation(&request, &jwt_key)?;
    if session_user_id(&session) != Some(continuation.handoff_user_id) {
        let mut conn = pool.acquire().await?;
        let user = models::users::get_by_id(&mut conn, continuation.handoff_user_id).await?;
        session.clear();
        session.renew();
        authentication::remember(&session, user)?;
    }
    info!(outcome = "continued", "Continued a mooc.fi handoff");
    let mut removal = continuation_cookie(String::new(), &app_conf);
    removal.make_removal();
    token.authorized_ok(
        HttpResponse::Ok()
            .cookie(removal)
            .json(ContinuedMoocfiHandoff {
                redirect_path: registration_page_path_of(
                    continuation.moocfi_course_id,
                    continuation.ui_language.as_deref(),
                ),
            }),
    )
}

/// The cookie's continuation, if it is unexpired and was minted for this request's IP.
fn valid_continuation(
    request: &HttpRequest,
    jwt_key: &JwtKey,
) -> Result<MoocfiHandoffContinuationClaim, ControllerError> {
    let client_ip: Option<IpAddr> = request_client_ip(request);
    request
        .cookie(CONTINUATION_COOKIE)
        .and_then(|cookie| MoocfiHandoffContinuationClaim::validate(cookie.value(), jwt_key).ok())
        .filter(|continuation| {
            client_ip.is_some_and(|client_ip| continuation.is_bound_to(client_ip, jwt_key))
        })
        .ok_or_else(|| controller_err!(NotFound, "No sign-in is waiting.".to_string()))
}

fn is_same_site(request: &HttpRequest) -> bool {
    // Browsers set this header and pages cannot forge it. Same-origin is a stricter case of
    // same-site, and is what dev's mock page sends.
    request
        .headers()
        .get("Sec-Fetch-Site")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value == "same-site" || value == "same-origin")
}

fn to_landing_with_continuation(
    claim: &MoocfiHandoffClaim,
    reason: &str,
    app_conf: &ApplicationConfiguration,
    jwt_key: &JwtKey,
) -> Result<HttpResponse, ControllerError> {
    let continuation =
        sign_hs256_claim(&MoocfiHandoffContinuationClaim::continuing(claim), jwt_key).map_err(
            |error| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Failed to sign the continuation".to_string(),
                    Some(error.into()),
                )
            },
        )?;
    let mut response = see_other(&landing_page_path(claim.moocfi_course_id, reason));
    response
        .add_cookie(&continuation_cookie(continuation, app_conf))
        .map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to set the continuation cookie".to_string(),
                Some(error.into()),
            )
        })?;
    Ok(response)
}

/// Lax, unlike the Strict session cookie, so that it is set on a cross-site arrival and sent on the
/// landing page's own requests, but never on another site's POST.
fn continuation_cookie(value: String, app_conf: &ApplicationConfiguration) -> Cookie<'static> {
    Cookie::build(CONTINUATION_COOKIE, value)
        .path(CONTINUATION_COOKIE_PATH)
        .http_only(true)
        .secure(!app_conf.base_url.starts_with("http://"))
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::seconds(
            MoocfiHandoffContinuationClaim::LIFETIME.num_seconds(),
        ))
        .finish()
}

/// The first letter of the address and its domain, such as `m…@example.com`.
fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let first: String = local.chars().take(1).collect();
            format!("{first}…@{domain}")
        }
        None => "…".to_string(),
    }
}

/// The page a redeemed handoff lands on, in the language mooc.fi was used in.
fn registration_page_path(claim: &MoocfiHandoffClaim) -> String {
    registration_page_path_of(claim.moocfi_course_id, claim.ui_language.as_deref())
}

fn registration_page_path_of(moocfi_course_id: Uuid, ui_language: Option<&str>) -> String {
    let path = format!("/completion-registration/mooc-fi/{moocfi_course_id}");
    match ui_language {
        Some(language) => format!("{path}?lng={}", pct_encode(language)),
        None => path,
    }
}

fn landing_page_path(moocfi_course_id: Uuid, reason: &str) -> String {
    format!("/completion-registration/mooc-fi/{moocfi_course_id}/handoff?reason={reason}")
}

fn fall_back_to_login(outcome: RedeemOutcome, claim: Option<&MoocfiHandoffClaim>) -> HttpResponse {
    log_outcome(outcome);
    let location = match claim {
        Some(claim) => format!(
            "/login?return_to={}",
            pct_encode(&registration_page_path(claim))
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
    cfg.route("/redeem", web::get().to(redeem_moocfi_handoff))
        .route("/pending", web::get().to(get_pending_moocfi_handoff))
        .service(web::resource("/continue").route(web::post().to(continue_moocfi_handoff)));
}
