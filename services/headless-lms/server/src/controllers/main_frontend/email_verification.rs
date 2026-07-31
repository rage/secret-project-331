/*!
Handlers for HTTP requests to `/api/v0/main-frontend/email-verification`.

Proving that an account can read the address it claims: `user_details.email` is self-service editable,
and the OIDC discovery document advertises an `email_verified` claim.
*/

use headless_lms_models::{
    email_deliveries::EmailSendStatusReport,
    email_ownership_verification_tokens,
    user_details::{self, EmailVerificationMethod},
};
use secrecy::{ExposeSecret, SecretString};
use utoipa::{OpenApi, ToSchema};

use crate::domain::email_ownership_verification::{
    VerificationEmailOutcome, queue_verification_email, verification_email_configured,
    verification_link,
};
use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(
    get_my_email_verification_status,
    request_email_verification_link,
    claim_email_verification_link,
    get_email_verification_link_for_test_mode
))]
pub(crate) struct MainFrontendEmailVerificationApiDoc;

/// What we last mailed about the address the account holds now. Never a delivery confirmation: we
/// hand messages to an SMTP relay and cannot see an inbox.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EmailVerificationEmailInfo {
    pub emailed_to: String,
    pub sent_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub send_status: Option<EmailSendStatusReport>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EmailVerificationStatus {
    pub email: String,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub email_verified_method: Option<EmailVerificationMethod>,
    pub latest_verification_email: Option<EmailVerificationEmailInfo>,
    /// Whether this deployment can mail verification links at all. False until a
    /// `verify_email_address` template exists; the account UI then shows nothing about verification.
    pub verification_configured: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RequestEmailVerificationOutcome {
    Queued,
    AlreadyVerified,
    /// A link went to this address moments ago.
    RecentlySent,
    /// This deployment has no verification email template, so there is nothing to mail.
    NotConfigured,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RequestEmailVerificationPayload {
    /// Which language to mail. Falls back to English when no template exists for it.
    pub language: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ClaimEmailVerificationPayload {
    #[schema(value_type = String)]
    pub token: SecretString,
}

/// Outcome of claiming a link. The failures are distinct values because the remedy differs for each.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ClaimEmailVerificationResult {
    Verified,
    AlreadyUsed,
    Expired,
    /// The account's address changed after the link was mailed.
    EmailChanged,
    Invalid,
}

/**
GET `/api/v0/main-frontend/email-verification/status` - Whether the signed-in account's address is
proven, and what we last mailed about it.
*/
#[instrument(skip(pool))]
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
) -> ControllerResult<web::Json<EmailVerificationStatus>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let details = user_details::get_user_details_by_user_id(&mut conn, user.id).await?;
    let latest =
        email_ownership_verification_tokens::get_latest_for_user(&mut conn, user.id).await?;

    // Changing the address away and back can leave the newest token naming the abandoned address.
    let latest =
        latest.filter(|latest| latest.email.to_lowercase() == details.email.to_lowercase());

    let mut latest_verification_email = None;
    if let Some(latest) = latest {
        let send_status = match latest.email_delivery_id {
            Some(delivery_id) => {
                models::email_deliveries::get_send_status(&mut conn, delivery_id).await?
            }
            None => None,
        };
        latest_verification_email = Some(EmailVerificationEmailInfo {
            emailed_to: latest.email,
            sent_at: latest.created_at,
            expires_at: latest.expires_at,
            send_status,
        });
    }

    token.authorized_ok(web::Json(EmailVerificationStatus {
        email: details.email,
        email_verified_at: details.email_verified_at,
        email_verified_method: details.email_verified_method,
        latest_verification_email,
        verification_configured: verification_email_configured(&mut conn).await?,
    }))
}

/**
POST `/api/v0/main-frontend/email-verification/request` - Mails a fresh verification link to the
signed-in account's current address.
*/
#[instrument(skip(pool, payload, app_conf))]
#[utoipa::path(
    post,
    path = "/request",
    operation_id = "requestEmailVerificationLink",
    tag = "email-verification",
    request_body = RequestEmailVerificationPayload,
    responses(
        (status = 200, description = "What the request did", body = RequestEmailVerificationOutcome)
    )
)]
pub async fn request_email_verification_link(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<RequestEmailVerificationPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<RequestEmailVerificationOutcome>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let details = user_details::get_user_details_by_user_id(&mut conn, user.id).await?;
    let outcome = queue_verification_email(
        &mut conn,
        &app_conf.base_url,
        user.id,
        &details.email,
        &payload.language,
    )
    .await?;

    token.authorized_ok(web::Json(match outcome {
        VerificationEmailOutcome::Queued => RequestEmailVerificationOutcome::Queued,
        VerificationEmailOutcome::AlreadyVerified => {
            RequestEmailVerificationOutcome::AlreadyVerified
        }
        VerificationEmailOutcome::RecentlySent => RequestEmailVerificationOutcome::RecentlySent,
        VerificationEmailOutcome::NotConfigured => RequestEmailVerificationOutcome::NotConfigured,
    }))
}

/**
POST `/api/v0/main-frontend/email-verification/claim` - Consumes a mailed link and records the proof.

Unauthenticated because the token names the account and the mail is often opened on a device that is
not signed in. A POST rather than a GET so a mail scanner or a link prefetcher cannot burn the link.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/claim",
    operation_id = "claimEmailVerificationLink",
    tag = "email-verification",
    request_body = ClaimEmailVerificationPayload,
    responses(
        (status = 200, description = "Outcome of the claim", body = ClaimEmailVerificationResult)
    )
)]
pub async fn claim_email_verification_link(
    pool: web::Data<PgPool>,
    payload: web::Json<ClaimEmailVerificationPayload>,
) -> ControllerResult<web::Json<ClaimEmailVerificationResult>> {
    let mut conn = pool.acquire().await?;
    let authorization_token = skip_authorize();

    let token = DbSecret::new(payload.token.expose_secret().to_string());

    // One transaction: spending the token without recording the proof would answer "already used"
    // while the account stays unverified.
    let mut tx = conn.begin().await?;

    let result = match email_ownership_verification_tokens::claim(&mut tx, &token).await? {
        Some(claimed) => {
            user_details::set_email_verified(
                &mut tx,
                claimed.user_id,
                EmailVerificationMethod::VerificationLink,
                Utc::now(),
            )
            .await?;
            ClaimEmailVerificationResult::Verified
        }
        // Read after the claim, not before: the claiming UPDATE blocks on the winner's row lock, so a
        // no-rows result means the winner has committed and this read sees its `used_at`.
        None => match email_ownership_verification_tokens::get_by_token(&mut tx, &token).await? {
            None => ClaimEmailVerificationResult::Invalid,
            Some(row) if row.used_at.is_some() => ClaimEmailVerificationResult::AlreadyUsed,
            // A retired row was superseded by a newer request, which reads the same to the recipient.
            Some(row) if row.expires_at <= Utc::now() || row.deleted_at.is_some() => {
                ClaimEmailVerificationResult::Expired
            }
            Some(_) => ClaimEmailVerificationResult::EmailChanged,
        },
    };

    tx.commit().await?;

    authorization_token.authorized_ok(web::Json(result))
}

/**
GET `/api/v0/main-frontend/email-verification/test-mode-link` - The signed-in account's own pending
verification link.

Exists because the system tests have no mail capture. 404 unless `TEST_MODE` is on, and scoped to the
caller's own account, so an accidentally open gate only ever hands you your own link.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/test-mode-link",
    operation_id = "getEmailVerificationLinkForTestMode",
    tag = "email-verification",
    responses(
        (status = 200, description = "The caller's pending verification link", body = String),
        (status = 404, description = "Not in test mode, or no pending link")
    )
)]
pub async fn get_email_verification_link_for_test_mode(
    user: AuthUser,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<String>> {
    let mut conn = pool.acquire().await?;
    let authorization_token = skip_authorize();

    if !app_conf.test_mode {
        return Err(controller_err!(NotFound, "Not found.".to_string()));
    }

    let latest = email_ownership_verification_tokens::get_latest_for_user(&mut conn, user.id)
        .await?
        .filter(email_ownership_verification_tokens::is_valid)
        .ok_or_else(|| {
            controller_err!(NotFound, "No pending email verification link.".to_string())
        })?;

    authorization_token.authorized_ok(web::Json(verification_link(
        &app_conf.base_url,
        latest.token.expose_secret(),
    )))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/status", web::get().to(get_my_email_verification_status))
        .route("/request", web::post().to(request_email_verification_link))
        .route("/claim", web::post().to(claim_email_verification_link))
        .route(
            "/test-mode-link",
            web::get().to(get_email_verification_link_for_test_mode),
        );
}
