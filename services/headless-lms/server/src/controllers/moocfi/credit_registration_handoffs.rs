/*!
Handlers for HTTP requests to `/api/v0/moocfi/credit-registration-handoffs`.

mooc.fi's backend mints a handoff here when a student presses "Register in courses.mooc.fi", and
sends the student's browser to the returned URL, where
[`crate::controllers::main_frontend::moocfi_handoffs`] signs them in. Nothing is stored, and no
completion is read from mooc.fi here.
*/

use std::net::IpAddr;

use actix_web::http::{StatusCode, header};
use headless_lms_base::jwt::{JwtKey, MoocfiHandoffClaim, sign_hs256_claim};
use headless_lms_utils::services::tmc::TmcClient;
use once_cell::sync::Lazy;
use secrecy::{ExposeSecret, SecretString};

use crate::domain::authentication::{
    authenticate_test_token, authorization_credential, constant_time_eq_str,
    get_or_create_user_from_tmc_mooc_fi_response,
};
use crate::domain::rate_limit_middleware_builder::{EndpointLimiters, RateLimitConfig};
use crate::prelude::*;

/// The path the returned redirect URL points at.
pub const REDEEM_PATH: &str = "/api/v0/main-frontend/moocfi-handoffs/redeem";

/// How often one student may mint a handoff, and one client IP redeem one.
pub const HANDOFF_RATE_LIMIT: RateLimitConfig = RateLimitConfig {
    per_second: None,
    per_minute: Some(10),
    per_hour: Some(60),
    per_day: None,
    per_month: None,
};

/// Keyed by user, which the route middleware cannot do: the caller is mooc.fi's backend, and the
/// user is only known once the TMC token checks out.
static PER_USER_LIMITS: Lazy<EndpointLimiters> =
    Lazy::new(|| EndpointLimiters::from_config(&HANDOFF_RATE_LIMIT));

/// At most one error report per mooc.fi course an hour, per replica: a mismatch refuses every
/// student who presses the button, before TMC has vouched for any of them.
static CUTOFF_MISMATCH_REPORTS_PER_COURSE: Lazy<EndpointLimiters> = Lazy::new(|| {
    EndpointLimiters::from_config(&RateLimitConfig {
        per_second: None,
        per_minute: None,
        per_hour: Some(1),
        per_day: None,
        per_month: None,
    })
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
            StatusCode::SERVICE_UNAVAILABLE,
            "not_configured",
            "Credit registration handoffs are not configured.",
        ));
    };
    if !is_authorized(&request, handoff_secret) {
        return token.authorized_ok(refusal(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
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
            StatusCode::BAD_REQUEST,
            "invalid_request",
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
        if CUTOFF_MISMATCH_REPORTS_PER_COURSE
            .check_key(moocfi_course_id.to_string())
            .is_ok()
        {
            report_cutoff_mismatch(&pool, moocfi_course_id, delegated_at, &targets).await;
        }
        return token.authorized_ok(refusal(
            StatusCode::CONFLICT,
            "cutoff_mismatch",
            "This course is not set up for credit registration on courses.mooc.fi.",
        ));
    }

    let user = match find_user(&mut conn, &app_conf, &tmc_client, &tmc_access_token).await {
        Ok(user) => user,
        Err(TmcFailure::Rejected) => {
            return token.authorized_ok(refusal(
                StatusCode::UNAUTHORIZED,
                "tmc_rejected",
                TMC_REFUSAL_MESSAGE,
            ));
        }
        Err(TmcFailure::Unavailable) => {
            return token.authorized_ok(refusal(
                StatusCode::SERVICE_UNAVAILABLE,
                "tmc_unavailable",
                TMC_REFUSAL_MESSAGE,
            ));
        }
    };

    if let Err(retry_after) = PER_USER_LIMITS.check_key(user.id.to_string()) {
        let mut response = refusal(
            StatusCode::TOO_MANY_REQUESTS,
            "rate_limited",
            "Too many requests. Please try again later.",
        );
        response
            .headers_mut()
            .insert(header::RETRY_AFTER, retry_after.as_secs().max(1).into());
        return token.authorized_ok(response);
    }

    let claim = MoocfiHandoffClaim::new(user.id, moocfi_course_id, client_ip, &jwt_key);
    let redirect_url = redeem_url(&app_conf.base_url, &claim, &jwt_key).map_err(|error| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            error.to_string(),
            Some(error),
        )
    })?;

    info!(outcome = "minted", user_id = %user.id, "Minted a mooc.fi handoff");
    token.authorized_ok(
        HttpResponse::Created().json(CreditRegistrationHandoffResponse {
            redirect_url: redirect_url.to_string(),
        }),
    )
}

const TMC_REFUSAL_MESSAGE: &str = "Could not verify the student with TMC.";

/// Why [`find_user`] found no one.
enum TmcFailure {
    Rejected,
    Unavailable,
}

/// A refused mint, logged under `kind`, which the body's `type` repeats.
fn refusal(status: StatusCode, kind: &'static str, message: &str) -> HttpResponse {
    warn!(outcome = kind, "Refused a mooc.fi handoff");
    HttpResponse::build(status).json(serde_json::json!({
        "type": kind,
        "message": message,
    }))
}

fn is_authorized(request: &HttpRequest, handoff_secret: &SecretString) -> bool {
    authorization_credential(request, "Bearer")
        .is_some_and(|provided| constant_time_eq_str(provided, handoff_secret.expose_secret()))
}

/// The redeem URL carrying `claim` signed.
fn redeem_url(
    base_url: &str,
    claim: &MoocfiHandoffClaim,
    jwt_key: &JwtKey,
) -> anyhow::Result<url::Url> {
    let handoff = sign_hs256_claim(claim, jwt_key).context("Failed to sign the handoff")?;
    let mut url = url::Url::parse(base_url)
        .and_then(|base_url| base_url.join(REDEEM_PATH))
        .context("Invalid BASE_URL")?;
    url.query_pairs_mut().append_pair("token", &handoff);
    Ok(url)
}

/// The courses account of the TMC token's owner, created on first sight like a login would.
async fn find_user(
    conn: &mut PgConnection,
    app_conf: &ApplicationConfiguration,
    tmc_client: &TmcClient,
    tmc_access_token: &SecretString,
) -> Result<models::users::User, TmcFailure> {
    if app_conf.test_mode
        && let Some(user) = authenticate_test_token(conn, tmc_access_token, app_conf)
            .await
            .map_err(|_| TmcFailure::Unavailable)?
    {
        return Ok(user);
    }
    let tmc_user = tmc_client
        .get_user_from_tmc_mooc_fi_by_tmc_access_token(tmc_access_token)
        .await
        .map_err(|error| match error.error_type() {
            UtilErrorType::TmcHttpStatusError(401 | 403) => TmcFailure::Rejected,
            _ => {
                warn!(%error, "TMC did not answer a mooc.fi handoff");
                TmcFailure::Unavailable
            }
        })?;
    get_or_create_user_from_tmc_mooc_fi_response(
        conn,
        &app_conf.moocfi_configuration,
        tmc_user,
        tmc_access_token,
    )
    .await
    .map_err(|error| {
        warn!(%error, "Could not find or create the user of a mooc.fi handoff");
        TmcFailure::Unavailable
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
