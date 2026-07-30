/*!
Handlers for HTTP requests to `/api/v0/main-frontend/email-verification`.

Proving that an account can read the address it claims. Independent of any one feature: until this
existed, `user_details.email` was self-service editable with no verification at all, and the OIDC
discovery document advertised an `email_verified` claim we could not produce.
*/

use headless_lms_models::{
    email_deliveries::EmailSendStatusReport,
    email_ownership_verification_tokens,
    user_details::{self, EmailVerificationMethod},
};
use secrecy::{ExposeSecret, SecretString};
use utoipa::{OpenApi, ToSchema};

use crate::domain::email_ownership_verification::{
    VerificationEmailOutcome, queue_verification_email, verification_link,
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

/// What we last mailed about the address the account holds now, and what our queue says happened to
/// it. Never a delivery confirmation: we hand messages to an SMTP relay and cannot see an inbox.
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
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RequestEmailVerificationOutcome {
    Queued,
    AlreadyVerified,
    /// A link went to this address moments ago; sending another would only duplicate it.
    RecentlySent,
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

/// Why a claim did not record a proof. Distinct values because the remedy differs: a used link means
/// "you are already done", an expired one means "ask for a new one", and a changed address means "the
/// link was for your old address".
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ClaimEmailVerificationResult {
    Verified,
    AlreadyUsed,
    Expired,
    /// The account's address changed after the link was mailed, so the link no longer proves anything.
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

    // Only a link about the address the account holds right now is worth reporting. Reachable
    // otherwise: change the address away and back inside the resend cap, and the newest live token
    // still names the address that was abandoned in between. Saying "link sent to <that>" would point
    // the user at a mailbox this account no longer claims.
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
    }))
}

/**
POST `/api/v0/main-frontend/email-verification/request` - Mails a fresh verification link to the
signed-in account's current address.
*/
#[instrument(skip(pool, payload))]
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
) -> ControllerResult<web::Json<RequestEmailVerificationOutcome>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let details = user_details::get_user_details_by_user_id(&mut conn, user.id).await?;
    let outcome =
        queue_verification_email(&mut conn, user.id, &details.email, &payload.language).await?;

    token.authorized_ok(web::Json(match outcome {
        VerificationEmailOutcome::Queued => RequestEmailVerificationOutcome::Queued,
        VerificationEmailOutcome::AlreadyVerified => {
            RequestEmailVerificationOutcome::AlreadyVerified
        }
        VerificationEmailOutcome::RecentlySent => RequestEmailVerificationOutcome::RecentlySent,
    }))
}

/**
POST `/api/v0/main-frontend/email-verification/claim` - Consumes a mailed link and records the proof.

Deliberately unauthenticated: the token names the account, so no session is needed and requiring one
would fail the common case of opening the mail on a device that is not signed in. Deliberately a POST
rather than a GET, so a mail scanner or a link prefetcher cannot burn the link.
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
    let Some(existing) =
        email_ownership_verification_tokens::get_by_token(&mut conn, &token).await?
    else {
        return authorization_token.authorized_ok(web::Json(ClaimEmailVerificationResult::Invalid));
    };

    // Spending the link and recording the proof commit together or not at all. Split across two
    // statements, a failure between them would burn the token while leaving the account unverified,
    // and the dead link would then answer "already used" — telling the recipient they are done when
    // they are not.
    let mut tx = conn.begin().await?;

    // Classified before the claim so the copy can be specific, then re-derived from the claim's own
    // result: only the UPDATE is authoritative about who won a concurrent double click.
    let result =
        if let Some(claimed) = email_ownership_verification_tokens::claim(&mut tx, &token).await? {
            user_details::set_email_verified(
                &mut tx,
                claimed.user_id,
                EmailVerificationMethod::VerificationLink,
                Utc::now(),
            )
            .await?;
            ClaimEmailVerificationResult::Verified
        } else if existing.used_at.is_some() {
            ClaimEmailVerificationResult::AlreadyUsed
        } else if existing.expires_at <= Utc::now() || existing.deleted_at.is_some() {
            // A retired row was superseded by a newer request for the same account, which from the
            // recipient's side is the same story as an expired one: this link is no longer the good one.
            ClaimEmailVerificationResult::Expired
        } else {
            ClaimEmailVerificationResult::EmailChanged
        };

    tx.commit().await?;

    authorization_token.authorized_ok(web::Json(result))
}

/**
GET `/api/v0/main-frontend/email-verification/test-mode-link` - The signed-in account's own pending
verification link.

Exists because there is no mail capture in the system tests, so a spec cannot read the link out of an
inbox. Returns 404 unless `TEST_MODE` is on, and it is scoped to the caller's own account, so the
worst it can do with the gate accidentally open is hand you a link to your own mailbox.
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

    authorization_token.authorized_ok(web::Json(verification_link(latest.token.expose_secret())))
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
