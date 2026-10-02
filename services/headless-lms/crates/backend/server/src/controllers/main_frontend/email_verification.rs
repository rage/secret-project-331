/*!
Handlers for HTTP requests to `/api/v0/main-frontend/email-verification`.

Proving that an account can read the address it claims: `user_details.email` is self-service editable,
and the OIDC discovery document advertises an `email_verified` claim.
*/

use headless_lms_models::{
    email_templates::{self, EmailTemplateType},
    user_details::{self, EmailVerificationMethod},
    user_email_codes::{self, UserEmailCodePurpose},
};
use secrecy::ExposeSecret;
use utoipa::{OpenApi, ToSchema};

use crate::domain::{
    email_ownership_verification::{
        MAX_CODE_ATTEMPTS, VerificationEmailOutcome, queue_verification_email,
    },
    rate_limit_middleware_builder::{RateLimit, RateLimitConfig},
};
use crate::prelude::*;

const PURPOSE: UserEmailCodePurpose = UserEmailCodePurpose::EmailOwnershipVerification;

#[derive(OpenApi)]
#[openapi(paths(
    get_my_email_verification_status,
    request_email_verification_code,
    verify_email_ownership,
    get_email_verification_code_for_test_mode
))]
pub(crate) struct MainFrontendEmailVerificationApiDoc;

/// What we last mailed about the address the account holds now. Never a delivery confirmation: we
/// hand messages to an SMTP relay and cannot see an inbox.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EmailVerificationEmailInfo {
    pub sent_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EmailVerificationStatus {
    /// False switches the feature off entirely; the request and verify endpoints 404 then.
    pub verification_enabled: bool,
    /// False when `verification_enabled` but the deployment has no `verify_email_address`
    /// template: requesting a code would 500, so the frontend hides the feature instead.
    pub template_configured: bool,
    pub email: String,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub email_verified_method: Option<EmailVerificationMethod>,
    pub latest_verification_email: Option<EmailVerificationEmailInfo>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RequestEmailVerificationOutcome {
    Queued,
    AlreadyVerified,
    /// A code went to this address moments ago.
    RecentlySent,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RequestEmailVerificationPayload {
    /// Which language to mail. Falls back to English when no template exists for it.
    pub language: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct VerifyEmailOwnershipPayload {
    #[schema(value_type = String)]
    pub code: DbSecret,
}

/// Outcome of submitting a code. Wrong, expired, superseded and spent are one value: they are
/// indistinguishable to someone typing digits, and telling them apart only helps a guesser.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum VerifyEmailOwnershipResult {
    Verified,
    AlreadyVerified,
    Invalid,
}

/**
GET `/api/v0/main-frontend/email-verification/status` - Whether the signed-in account's address is
proven, and what we last mailed about it.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/status",
    operation_id = "getMyEmailVerificationStatus",
    tag = "email-verification",
    responses(
        (status = 200, description = "Email verification status of the signed-in user", body = EmailVerificationStatus)
    )
)]
pub async fn get_my_email_verification_status(
    user: AuthUser,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<EmailVerificationStatus>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let details = user_details::get_user_details_by_user_id(&mut conn, user.id).await?;
    // An address change retires the code, so a live one always belongs to the current address.
    let live_code =
        user_email_codes::get_unused_user_email_code_with_user_id(&mut conn, user.id, PURPOSE)
            .await?;
    let template_configured = if app_conf.enable_email_ownership_verification {
        email_templates::generic_email_template_exists(
            &mut conn,
            EmailTemplateType::VerifyEmailAddress,
        )
        .await?
    } else {
        false
    };

    token.authorized_ok(web::Json(EmailVerificationStatus {
        verification_enabled: app_conf.enable_email_ownership_verification,
        template_configured,
        email: details.email,
        email_verified_at: details.email_verified_at,
        email_verified_method: details.email_verified_method,
        latest_verification_email: live_code.map(|code| EmailVerificationEmailInfo {
            sent_at: code.created_at,
            expires_at: code.expires_at,
        }),
    }))
}

/**
POST `/api/v0/main-frontend/email-verification/request` - Mails a fresh verification code to the
signed-in account's current address.
*/
#[instrument(skip(pool, payload, app_conf))]
#[utoipa::path(
    post,
    path = "/request",
    operation_id = "requestEmailVerificationCode",
    tag = "email-verification",
    request_body = RequestEmailVerificationPayload,
    responses(
        (status = 200, description = "What the request did", body = RequestEmailVerificationOutcome),
        (status = 404, description = "Email ownership verification is switched off")
    )
)]
pub async fn request_email_verification_code(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<RequestEmailVerificationPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<RequestEmailVerificationOutcome>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    if !app_conf.enable_email_ownership_verification {
        return Err(controller_err!(NotFound, "Not found.".to_string()));
    }

    let outcome = queue_verification_email(&mut conn, user.id, &payload.language).await?;

    token.authorized_ok(web::Json(match outcome {
        VerificationEmailOutcome::Queued => RequestEmailVerificationOutcome::Queued,
        VerificationEmailOutcome::AlreadyVerified => {
            RequestEmailVerificationOutcome::AlreadyVerified
        }
        VerificationEmailOutcome::RecentlySent => RequestEmailVerificationOutcome::RecentlySent,
    }))
}

/**
POST `/api/v0/main-frontend/email-verification/verify` - Spends a mailed code and records the proof.

Authenticated and scoped to the caller's own account, so the code is the only secret involved and it
never has to identify anybody on its own.
*/
#[instrument(skip(pool, payload, app_conf))]
#[utoipa::path(
    post,
    path = "/verify",
    operation_id = "verifyEmailOwnership",
    tag = "email-verification",
    request_body = VerifyEmailOwnershipPayload,
    responses(
        (status = 200, description = "Outcome of submitting the code", body = VerifyEmailOwnershipResult),
        (status = 404, description = "Email ownership verification is switched off")
    )
)]
pub async fn verify_email_ownership(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<VerifyEmailOwnershipPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<VerifyEmailOwnershipResult>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    if !app_conf.enable_email_ownership_verification {
        return Err(controller_err!(NotFound, "Not found.".to_string()));
    }

    // One transaction: spending the code without recording the proof would leave the account
    // unverified with nothing left to type.
    let mut tx = conn.begin().await?;

    let result = if user_details::get_email_verification(&mut tx, user.id)
        .await?
        .is_some()
    {
        VerifyEmailOwnershipResult::AlreadyVerified
    } else if !user_email_codes::is_reset_user_email_code_valid(
        &mut tx,
        user.id,
        PURPOSE,
        &payload.code,
    )
    .await?
    {
        user_email_codes::record_failed_attempt(&mut tx, user.id, PURPOSE, MAX_CODE_ATTEMPTS)
            .await?;
        VerifyEmailOwnershipResult::Invalid
    } else if user_email_codes::mark_user_email_code_used(&mut tx, user.id, PURPOSE, &payload.code)
        .await?
    {
        user_details::set_email_verified(
            &mut tx,
            user.id,
            EmailVerificationMethod::EmailedCode,
            Utc::now(),
        )
        .await?;
        VerifyEmailOwnershipResult::Verified
    } else {
        // The spend blocks on the winner's row lock and then matches nothing, so a concurrent
        // duplicate submission lands here rather than recording a second proof.
        VerifyEmailOwnershipResult::Invalid
    };

    tx.commit().await?;

    token.authorized_ok(web::Json(result))
}

/**
GET `/api/v0/main-frontend/email-verification/test-mode-code` - The signed-in account's own pending
verification code.

Exists because the system tests have no mail capture. 404 unless `TEST_MODE` is on, and scoped to the
caller's own account, so an accidentally open gate only ever hands you your own code.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/test-mode-code",
    operation_id = "getEmailVerificationCodeForTestMode",
    tag = "email-verification",
    responses(
        (status = 200, description = "The caller's pending verification code", body = String),
        (status = 404, description = "Not in test mode, or no pending code")
    )
)]
pub async fn get_email_verification_code_for_test_mode(
    user: AuthUser,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<String>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    if !app_conf.test_mode {
        return Err(controller_err!(NotFound, "Not found.".to_string()));
    }

    let live_code =
        user_email_codes::get_unused_user_email_code_with_user_id(&mut conn, user.id, PURPOSE)
            .await?
            .ok_or_else(|| {
                controller_err!(NotFound, "No pending email verification code.".to_string())
            })?;

    token.authorized_ok(web::Json(live_code.code.expose_secret().to_string()))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/status", web::get().to(get_my_email_verification_status))
        .service(
            web::resource("/request")
                .wrap(RateLimit::new(RateLimitConfig {
                    per_minute: None,
                    per_hour: Some(10),
                    per_day: Some(30),
                    per_month: None,
                    ..Default::default()
                }))
                .to(request_email_verification_code),
        )
        .service(
            web::resource("/verify")
                .wrap(RateLimit::new(RateLimitConfig {
                    per_minute: Some(10),
                    per_hour: Some(50),
                    per_day: None,
                    per_month: None,
                    ..Default::default()
                }))
                .to(verify_email_ownership),
        )
        .route(
            "/test-mode-code",
            web::get().to(get_email_verification_code_for_test_mode),
        );
}
