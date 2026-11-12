/*!
Handlers for HTTP requests to `/api/v0/main-frontend/moocfi-handoffs`.

The student's browser arrives at `redeem` by a top-level navigation from mooc.fi's credit registration
page, or from Elements of AI's, carrying a handoff minted by
[`crate::controllers::moocfi::credit_registration_handoffs`]. Every answer to the navigation is a 303,
never JSON:

- the right account signed in: on to the registration page;
- nobody signed in, arriving same-site from mooc.fi's own page: signed in, then on to the
  registration page;
- another account signed in, or any other arrival: to the course's landing page
  (`/completion-registration/mooc-fi/{moocfi_course_id}/handoff`), with a single-use continuation
  in an HttpOnly cookie that `continue` completes once the student confirms. Nobody is signed in
  without asking on a navigation another site could have started, which would allow login CSRF;
- a handoff for an account with any courses role, and anything else: to the normal login, which
  never signs anyone in.

A handoff is single use: signing in or starting a continuation spends it. Sessions it signs in are
delegated; see [`authentication::remember`].
*/

use actix_session::Session;
use actix_web::cookie::{Cookie, SameSite, time::Duration as CookieDuration};
use actix_web::http::header;
use headless_lms_base::jwt::{JwtKey, MoocfiHandoffClaim, client_ip_hash};
use models::moocfi_handoff_continuations::{self, NewContinuation, PendingContinuation};
use once_cell::sync::Lazy;
use sha2::{Digest, Sha256};
use utoipa::{IntoParams, OpenApi, ToSchema};

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

/// Long enough to read the landing page, short enough that a shared computer's next user rarely
/// finds one waiting.
const CONTINUATION_LIFETIME: chrono::TimeDelta = chrono::TimeDelta::seconds(60);

/// An expired handoff still gets the wrong-account explanation, and is charged to its student's
/// bucket, only this soon after expiry; older ones could otherwise be replayed to lock them out.
const RECENTLY_EXPIRED: chrono::TimeDelta = chrono::TimeDelta::minutes(1);

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
    Spent,
    IpMismatch,
    RateLimited,
    StaffAccount,
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
            Self::Spent => "spent",
            Self::IpMismatch => "ip_mismatch",
            Self::RateLimited => "rate_limited",
            Self::StaffAccount => "staff_account",
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
    let is_unexpired = claim.is_unexpired_or_expired_within(chrono::TimeDelta::zero());
    let is_recent = claim.is_unexpired_or_expired_within(RECENTLY_EXPIRED);
    // The binding that stops login CSRF: an attacker can only mint for their own IP.
    let is_bound = client_ip.is_some_and(|client_ip| claim.is_bound_to(client_ip, &jwt_key));

    let is_ip_limited =
        client_ip.is_some_and(|client_ip| PER_IP_LIMITS.check_key(client_ip.to_string()).is_err());
    let is_student_limited = is_bound
        && is_recent
        && PER_STUDENT_LIMITS
            .check_key(claim.user_id.to_string())
            .is_err();
    if is_ip_limited || is_student_limited {
        log_outcome(RedeemOutcome::RateLimited);
        return token.authorized_ok(see_other(&landing_page_path(
            moocfi_course_id,
            REASON_RATE_LIMITED,
        )));
    }
    if !is_recent {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::Expired, Some(&claim)));
    }

    // The session cookie is SameSite=Strict, so a cross-site arrival never gets this far.
    let session_user = session_user_id(&session);
    if session_user == Some(claim.user_id) {
        log_outcome(RedeemOutcome::AlreadySignedIn);
        return token.authorized_ok(see_other(&registration_page_path(&claim)));
    }
    // Checked again here, not only at the mint: a role granted since must not be signed in either.
    let mut conn = pool.acquire().await?;
    if models::roles::has_any_role(&mut conn, claim.user_id).await? {
        return token.authorized_ok(fall_back_to_login(
            RedeemOutcome::StaffAccount,
            Some(&claim),
        ));
    }
    if session_user.is_some() {
        if is_unexpired && is_bound && spend(&mut conn, &claim).await? {
            log_outcome(RedeemOutcome::DifferentAccount);
            return token.authorized_ok(
                to_landing_with_continuation(
                    &mut conn,
                    &claim,
                    REASON_DIFFERENT_ACCOUNT,
                    &app_conf,
                )
                .await?,
            );
        }
        log_outcome(RedeemOutcome::DifferentAccountNotContinuable);
        return token.authorized_ok(see_other(&landing_page_path(
            moocfi_course_id,
            REASON_DIFFERENT_ACCOUNT,
        )));
    }
    if !is_unexpired {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::Expired, Some(&claim)));
    }
    if !is_bound {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::IpMismatch, Some(&claim)));
    }
    if !spend(&mut conn, &claim).await? {
        return token.authorized_ok(fall_back_to_login(RedeemOutcome::Spent, Some(&claim)));
    }
    if !is_from_moocfi_page(&request, &app_conf) {
        log_outcome(RedeemOutcome::NeedsConfirmation);
        return token.authorized_ok(
            to_landing_with_continuation(&mut conn, &claim, REASON_CONFIRM, &app_conf).await?,
        );
    }

    let user = match models::users::get_by_id(&mut conn, claim.user_id).await {
        Ok(user) => user,
        Err(error) if error.error_type() == &ModelErrorType::RecordNotFound => {
            return token.authorized_ok(fall_back_to_login(RedeemOutcome::Invalid, Some(&claim)));
        }
        Err(error) => return Err(error.into()),
    };
    // Against session fixation: the signed-in session must not reuse an id issued before sign-in.
    session.renew();
    authentication::remember(&session, user)?;
    log_outcome(RedeemOutcome::SignedIn);
    token.authorized_ok(see_other(&registration_page_path(&claim)))
}

/// The course whose landing page asks; a continuation for another course is not shown there.
#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct PendingMoocfiHandoffQuery {
    pub moocfi_course_id: Uuid,
}

/// Which account a pending continuation would sign in, beside whoever is signed in now.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct PendingMoocfiHandoff {
    pub moocfi_course_id: Uuid,
    /// The handoff account's email, in full: the student confirms by recognising it, and only the
    /// browser the handoff was minted for, from its IP, gets this far.
    pub email: String,
    /// When `Same`, the continuation is already spent: open `redirect_path`.
    pub signed_in_account: SignedInAccount,
    /// The registration page to open once the right account is signed in.
    pub redirect_path: String,
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
GET `/api/v0/main-frontend/moocfi-handoffs/pending?moocfi_course_id=…` - The handoff waiting for the
student's confirmation on the course's landing page, or 404 when none is waiting for that course,
it has expired or been used, or it was minted for another IP.
*/
#[instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/pending",
    operation_id = "getPendingMoocfiHandoff",
    tag = "moocfi-handoffs",
    params(PendingMoocfiHandoffQuery),
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
    query: web::Query<PendingMoocfiHandoffQuery>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let mut conn = pool.acquire().await?;
    let (digest, continuation) =
        pending_continuation(&mut conn, &request, &jwt_key, query.moocfi_course_id).await?;
    let email = models::user_details::get_user_details_by_user_id(&mut conn, continuation.user_id)
        .await?
        .email;
    let signed_in_account = signed_in_account(&session, &continuation);
    let pending = PendingMoocfiHandoff {
        moocfi_course_id: continuation.moocfi_course_id,
        email,
        signed_in_account,
        redirect_path: registration_page_path_of(
            continuation.moocfi_course_id,
            continuation.ui_language.as_deref(),
        ),
    };
    if signed_in_account == SignedInAccount::Same {
        // Nothing left to confirm, so nothing is left waiting for the browser's next user.
        moocfi_handoff_continuations::take(&mut conn, &digest, query.moocfi_course_id).await?;
        return token.authorized_ok(clearing_continuation(HttpResponse::Ok().json(pending)));
    }
    token.authorized_ok(HttpResponse::Ok().json(pending))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ContinueMoocfiHandoffPayload {
    /// The course whose landing page the student confirmed on.
    pub moocfi_course_id: Uuid,
    /// Who was signed in when the student confirmed, as `pending` said. If it has changed since,
    /// the student confirmed something else, so nothing is switched.
    pub expected_signed_in_account: SignedInAccount,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ContinuedMoocfiHandoff {
    /// The registration page; open it with a full navigation so the new session takes over.
    pub redirect_path: String,
}

/**
POST `/api/v0/main-frontend/moocfi-handoffs/continue` - Completes the waiting handoff: signs out
whoever is signed in and signs in the handoff's account. Single use.

Only from a same-origin request, and the continuation cookie is SameSite=Lax, so another site cannot
post it. 404 when no handoff is waiting for the course; 400 when the signed-in account is no longer
the one the student saw; 403 for an account with a courses role.
*/
#[instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/continue",
    operation_id = "continueMoocfiHandoff",
    tag = "moocfi-handoffs",
    request_body = ContinueMoocfiHandoffPayload,
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
    payload: web::Json<ContinueMoocfiHandoffPayload>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    if !is_same_origin(&request, &app_conf) {
        return Err(controller_err!(Forbidden, "Forbidden.".to_string()));
    }
    let mut conn = pool.acquire().await?;
    let (digest, continuation) =
        pending_continuation(&mut conn, &request, &jwt_key, payload.moocfi_course_id).await?;
    if signed_in_account(&session, &continuation) != payload.expected_signed_in_account {
        return Err(controller_err!(
            BadRequest,
            "The signed-in account has changed.".to_string()
        ));
    }
    // The continuation outlives the handoff by minutes, long enough for a role to be granted.
    if models::roles::has_any_role(&mut conn, continuation.user_id).await? {
        return Err(controller_err!(Forbidden, "Forbidden.".to_string()));
    }
    // Spent in between by a concurrent continue.
    let Some(continuation) =
        moocfi_handoff_continuations::take(&mut conn, &digest, payload.moocfi_course_id).await?
    else {
        return Err(controller_err!(NotFound, NO_CONTINUATION.to_string()));
    };
    if session_user_id(&session) != Some(continuation.user_id) {
        let user = models::users::get_by_id(&mut conn, continuation.user_id).await?;
        session.clear();
        session.renew();
        authentication::remember(&session, user)?;
    }
    info!(outcome = "continued", "Continued a mooc.fi handoff");
    token.authorized_ok(clearing_continuation(HttpResponse::Ok().json(
        ContinuedMoocfiHandoff {
            redirect_path: registration_page_path_of(
                continuation.moocfi_course_id,
                continuation.ui_language.as_deref(),
            ),
        },
    )))
}

const NO_CONTINUATION: &str = "No sign-in is waiting.";

/// The cookie's continuation for the course, if one is waiting for this request's IP, with the
/// cookie token's digest that spends it.
async fn pending_continuation(
    conn: &mut PgConnection,
    request: &HttpRequest,
    jwt_key: &JwtKey,
    moocfi_course_id: Uuid,
) -> Result<(Vec<u8>, PendingContinuation), ControllerError> {
    let not_found = || controller_err!(NotFound, NO_CONTINUATION.to_string());
    let digest = request
        .cookie(CONTINUATION_COOKIE)
        .map(|cookie| Sha256::digest(cookie.value().as_bytes()).to_vec())
        .ok_or_else(not_found)?;
    let continuation = moocfi_handoff_continuations::get_pending(conn, &digest, moocfi_course_id)
        .await?
        .ok_or_else(not_found)?;
    let is_bound = request_client_ip(request)
        .is_some_and(|client_ip| client_ip_hash(client_ip, jwt_key) == continuation.client_ip_hash);
    if !is_bound {
        return Err(not_found());
    }
    Ok((digest, continuation))
}

fn signed_in_account(session: &Session, continuation: &PendingContinuation) -> SignedInAccount {
    match session_user_id(session) {
        Some(user_id) if user_id == continuation.user_id => SignedInAccount::Same,
        Some(_) => SignedInAccount::Different,
        None => SignedInAccount::None,
    }
}

fn sec_fetch_site(request: &HttpRequest) -> Option<&str> {
    request
        .headers()
        .get("Sec-Fetch-Site")
        .and_then(|value| value.to_str().ok())
}

/// From a page of ours. Browsers without Fetch Metadata, such as Safari before 16.4, still send
/// `Origin` on a POST.
fn is_same_origin(request: &HttpRequest, app_conf: &ApplicationConfiguration) -> bool {
    match sec_fetch_site(request) {
        Some(site) => site == "same-origin",
        None => request
            .headers()
            .get("Origin")
            .and_then(|value| value.to_str().ok())
            .is_some_and(|origin| {
                url::Url::parse(&app_conf.base_url)
                    .is_ok_and(|base_url| base_url.origin().ascii_serialization() == origin)
            }),
    }
}

/// A navigation from mooc.fi's own page. Same-site alone would admit any site under mooc.fi, so
/// the `Referer` origin must also be mooc.fi's frontend. Same-origin is what dev's mock page sends.
/// In test mode a missing `Sec-Fetch-Site` passes: Chromium sends none to the plain-http test site.
fn is_from_moocfi_page(request: &HttpRequest, app_conf: &ApplicationConfiguration) -> bool {
    let is_same_site = match sec_fetch_site(request) {
        Some(site) => site == "same-site" || site == "same-origin",
        None => app_conf.test_mode,
    };
    is_same_site
        && request
            .headers()
            .get(header::REFERER)
            .and_then(|value| value.to_str().ok())
            .and_then(|referer| url::Url::parse(referer).ok())
            .is_some_and(|referer| {
                referer.origin().ascii_serialization()
                    == app_conf.moocfi_configuration.frontend_origin()
            })
}

/// Spends the claim, false when it was spent already.
async fn spend(conn: &mut PgConnection, claim: &MoocfiHandoffClaim) -> ModelResult<bool> {
    models::moocfi_redeemed_inbound_handoffs::spend(conn, claim.jti(), claim.expires_at()).await
}

async fn to_landing_with_continuation(
    conn: &mut PgConnection,
    claim: &MoocfiHandoffClaim,
    reason: &str,
    app_conf: &ApplicationConfiguration,
) -> Result<HttpResponse, ControllerError> {
    let continuation_token = models::library::oauth::tokens::generate_access_token();
    moocfi_handoff_continuations::insert(
        conn,
        &Sha256::digest(continuation_token.as_bytes()),
        &NewContinuation {
            user_id: claim.user_id,
            moocfi_course_id: claim.moocfi_course_id,
            ui_language: claim.ui_language.as_deref(),
            client_ip_hash: claim.client_ip_hash(),
        },
        CONTINUATION_LIFETIME,
    )
    .await?;
    let mut response = redirect(&landing_page_path(claim.moocfi_course_id, reason));
    response
        .add_cookie(&continuation_cookie(continuation_token, app_conf))
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
        .max_age(CookieDuration::seconds(CONTINUATION_LIFETIME.num_seconds()))
        .finish()
}

/// Expires the continuation cookie. Sent wherever a session starts or ends, so a continuation
/// left waiting never outlives the session it was shown beside.
pub fn continuation_cookie_removal() -> Cookie<'static> {
    let mut cookie = Cookie::build(CONTINUATION_COOKIE, "")
        .path(CONTINUATION_COOKIE_PATH)
        .finish();
    cookie.make_removal();
    cookie
}

fn clearing_continuation(mut response: HttpResponse) -> HttpResponse {
    // Only fails on a cookie that cannot be a header value, which this one always can.
    let _ = response.add_cookie(&continuation_cookie_removal());
    response
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

/// A redirect that also ends any continuation waiting in the browser.
fn see_other(location: &str) -> HttpResponse {
    clearing_continuation(redirect(location))
}

fn redirect(location: &str) -> HttpResponse {
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
