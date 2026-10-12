/*!
Handlers for HTTP requests to `/api/v0/moocfi/credit-registration-handoffs`.

mooc.fi's backend mints a handoff here when a student presses "Register in courses.mooc.fi", and
sends the student's browser to the returned URL, where
[`crate::controllers::main_frontend::moocfi_handoffs`] signs them in. Nothing is stored, and no
completion is read from mooc.fi here.
*/

use std::net::IpAddr;
use std::num::NonZeroU32;

use governor::{Quota, RateLimiter, clock::DefaultClock, state::keyed::DefaultKeyedStateStore};
use headless_lms_base::jwt::{JwtKey, MoocfiHandoffClaim};
use headless_lms_utils::services::tmc::TmcClient;
use once_cell::sync::Lazy;
use secrecy::{ExposeSecret, SecretString};

use crate::domain::authentication::{
    authenticate_test_token, constant_time_eq_str, get_or_create_user_from_tmc_mooc_fi_response,
};
use crate::prelude::*;

/// The path the returned redirect URL points at.
pub const REDEEM_PATH: &str = "/api/v0/main-frontend/moocfi-handoffs/redeem";

type UserLimiter = RateLimiter<Uuid, DefaultKeyedStateStore<Uuid>, DefaultClock>;

/// Keyed by user, which the route middleware cannot do: the caller is mooc.fi's backend, and the
/// user is only known once the TMC token checks out.
static PER_USER_LIMITS: Lazy<[UserLimiter; 2]> = Lazy::new(|| {
    [
        RateLimiter::keyed(Quota::per_minute(NonZeroU32::new(10).expect("non-zero"))),
        RateLimiter::keyed(Quota::per_hour(NonZeroU32::new(60).expect("non-zero"))),
    ]
});

#[derive(Debug, Deserialize)]
pub struct CreditRegistrationHandoffRequest {
    /// The student's TMC token, as mooc.fi received it from the student.
    tmc_access_token: SecretString,
    /// The handler course on mooc.fi.
    moocfi_course_id: Uuid,
    /// mooc.fi's cutoff for the course, which must equal ours.
    delegated_at: DateTime<Utc>,
    /// The student's IP as mooc.fi saw it; the handoff only works from it.
    client_ip: String,
}

#[derive(Debug, Serialize)]
pub struct CreditRegistrationHandoffResponse {
    redirect_url: String,
}

/**
POST `/api/v0/moocfi/credit-registration-handoffs` - Mints a short-lived sign-in for a student on
their way from mooc.fi's credit registration page.

Authorized by `Authorization: Bearer <MOOCFI_HANDOFF_SECRET>`. Answers 201 with the URL to send the
student's browser to; 401 for a wrong secret or a TMC token TMC rejects; 409 when we have no live
target for the course or our cutoff differs from mooc.fi's; 429 per student; 503 when delegation is
not configured or TMC cannot be reached.
*/
#[instrument(skip_all, fields(moocfi_course_id = %payload.moocfi_course_id))]
pub async fn create_credit_registration_handoff(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    jwt_key: web::Data<JwtKey>,
    tmc_client: web::Data<TmcClient>,
    payload: web::Json<CreditRegistrationHandoffRequest>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let moocfi = &app_conf.moocfi_configuration;
    let (Some(handoff_secret), Some(_)) = (&moocfi.handoff_secret, &moocfi.delegation) else {
        return token.authorized_ok(refusal(
            HandoffOutcome::NotConfigured,
            "Credit registration handoffs are not configured.",
        ));
    };
    if !is_authorized(&request, handoff_secret) {
        return token.authorized_ok(refusal(
            HandoffOutcome::Unauthorized,
            "Invalid authorization.",
        ));
    }
    let CreditRegistrationHandoffRequest {
        tmc_access_token,
        moocfi_course_id,
        delegated_at,
        client_ip,
    } = payload.into_inner();
    let Ok(client_ip) = client_ip.trim().parse::<IpAddr>() else {
        return token.authorized_ok(refusal(
            HandoffOutcome::InvalidRequest,
            "client_ip is not an IP address.",
        ));
    };

    let mut conn = pool.acquire().await?;
    let targets =
        models::external_credit_targets::get_by_moocfi_course_id(&mut conn, moocfi_course_id)
            .await?;
    let is_cutoff_equal = |target: &models::external_credit_targets::ExternalCreditTarget| {
        // mooc.fi's timestamps go through JavaScript dates, which keep milliseconds only.
        target.delegated_at.timestamp_millis() == delegated_at.timestamp_millis()
    };
    if targets.is_empty() || !targets.iter().all(is_cutoff_equal) {
        report_cutoff_mismatch(&pool, moocfi_course_id, delegated_at, &targets).await;
        return token.authorized_ok(refusal(
            HandoffOutcome::CutoffMismatch,
            "This course is not set up for credit registration on courses.mooc.fi.",
        ));
    }

    let user = match find_user(&mut conn, &app_conf, &tmc_client, &tmc_access_token).await {
        Ok(user) => user,
        Err(outcome) => {
            return token.authorized_ok(refusal(outcome, "Could not verify the student with TMC."));
        }
    };

    if PER_USER_LIMITS
        .iter()
        .any(|limiter| limiter.check_key(&user.id).is_err())
    {
        return token.authorized_ok(refusal(
            HandoffOutcome::RateLimited,
            "Too many requests. Please try again later.",
        ));
    }

    let handoff = MoocfiHandoffClaim::new(user.id, moocfi_course_id, client_ip, &jwt_key)
        .sign(&jwt_key)
        .map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to sign the handoff".to_string(),
                Some(error.into()),
            )
        })?;
    let mut redirect_url = url::Url::parse(&app_conf.base_url)
        .and_then(|base_url| base_url.join(REDEEM_PATH))
        .map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Invalid BASE_URL".to_string(),
                Some(error.into()),
            )
        })?;
    redirect_url
        .query_pairs_mut()
        .append_pair("token", &handoff);

    info!(outcome = HandoffOutcome::Minted.as_str(), user_id = %user.id, "Minted a mooc.fi handoff");
    token.authorized_ok(
        HttpResponse::Created().json(CreditRegistrationHandoffResponse {
            redirect_url: redirect_url.to_string(),
        }),
    )
}

/// How one mint request ended, for the logs.
#[derive(Debug, Clone, Copy)]
enum HandoffOutcome {
    Minted,
    NotConfigured,
    Unauthorized,
    InvalidRequest,
    CutoffMismatch,
    TmcRejected,
    TmcUnavailable,
    RateLimited,
}

impl HandoffOutcome {
    fn as_str(self) -> &'static str {
        match self {
            Self::Minted => "minted",
            Self::NotConfigured => "not_configured",
            Self::Unauthorized => "unauthorized",
            Self::InvalidRequest => "invalid_request",
            Self::CutoffMismatch => "cutoff_mismatch",
            Self::TmcRejected => "tmc_rejected",
            Self::TmcUnavailable => "tmc_unavailable",
            Self::RateLimited => "rate_limited",
        }
    }

    fn status(self) -> actix_web::http::StatusCode {
        use actix_web::http::StatusCode;
        match self {
            Self::Minted => StatusCode::CREATED,
            Self::NotConfigured | Self::TmcUnavailable => StatusCode::SERVICE_UNAVAILABLE,
            Self::Unauthorized | Self::TmcRejected => StatusCode::UNAUTHORIZED,
            Self::InvalidRequest => StatusCode::BAD_REQUEST,
            Self::CutoffMismatch => StatusCode::CONFLICT,
            Self::RateLimited => StatusCode::TOO_MANY_REQUESTS,
        }
    }
}

fn refusal(outcome: HandoffOutcome, message: &str) -> HttpResponse {
    warn!(outcome = outcome.as_str(), "Refused a mooc.fi handoff");
    HttpResponse::build(outcome.status()).json(serde_json::json!({
        "type": outcome.as_str(),
        "message": message,
    }))
}

fn is_authorized(request: &HttpRequest, handoff_secret: &SecretString) -> bool {
    request
        .headers()
        .get(actix_web::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .is_some_and(|provided| constant_time_eq_str(provided, handoff_secret.expose_secret()))
}

/// The courses account of the TMC token's owner, created on first sight like a login would.
async fn find_user(
    conn: &mut PgConnection,
    app_conf: &ApplicationConfiguration,
    tmc_client: &TmcClient,
    tmc_access_token: &SecretString,
) -> Result<models::users::User, HandoffOutcome> {
    if app_conf.test_mode
        && let Some(user) = authenticate_test_token(conn, tmc_access_token, app_conf)
            .await
            .map_err(|_| HandoffOutcome::TmcUnavailable)?
    {
        return Ok(user);
    }
    let tmc_user = tmc_client
        .get_user_from_tmc_mooc_fi_by_tmc_access_token(tmc_access_token)
        .await
        .map_err(|error| match error.error_type() {
            UtilErrorType::TmcHttpStatusError(401 | 403) => HandoffOutcome::TmcRejected,
            _ => {
                warn!(%error, "TMC did not answer a mooc.fi handoff");
                HandoffOutcome::TmcUnavailable
            }
        })?;
    get_or_create_user_from_tmc_mooc_fi_response(conn, tmc_user, tmc_access_token)
        .await
        .map_err(|error| {
            warn!(%error, "Could not find or create the user of a mooc.fi handoff");
            HandoffOutcome::TmcUnavailable
        })
}

/// The two platforms disagree about which completions are whose, so this needs an admin.
async fn report_cutoff_mismatch(
    pool: &PgPool,
    moocfi_course_id: Uuid,
    moocfi_delegated_at: DateTime<Utc>,
    targets: &[models::external_credit_targets::ExternalCreditTarget],
) {
    let message = if targets.is_empty() {
        format!(
            "mooc.fi sent a credit registration handoff for mooc.fi course {moocfi_course_id}, which has no live target"
        )
    } else {
        format!(
            "The credit registration cutoff of mooc.fi course {moocfi_course_id} differs between mooc.fi and courses"
        )
    };
    let report = models::errors::NewErrorReport {
        service: "headless-lms".to_string(),
        error_source: Some(models::errors::ErrorSource::Backend),
        message,
        stack_trace: None,
        path: None,
        app_version: None,
        details: Some(serde_json::json!({
            "kind": "moocfi_handoff_cutoff_mismatch",
            "moocfi_course_id": moocfi_course_id,
            "moocfi_delegated_at": moocfi_delegated_at,
            "target_delegated_at": targets
                .iter()
                .map(|target| target.delegated_at)
                .collect::<Vec<_>>(),
        })),
    };
    models::errors::insert_best_effort(pool, &report).await;
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(create_credit_registration_handoff));
}
