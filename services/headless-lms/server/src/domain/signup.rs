//! Signing up through the form. Nothing is created until the code mailed to the address is typed:
//! the form stores a [pending signup](headless_lms_models::pending_signups), and the code turns it
//! into an account.

use actix_session::Session;
use chrono::Duration;
use headless_lms_models::{
    email_deliveries,
    email_templates::{self, EmailTemplateType},
    pending_signups::{self, NewPendingSignup, PendingSignup},
    user_email_codes,
};
use headless_lms_utils::{
    prelude::UtilErrorType,
    services::tmc::{NewUserInfo, TmcClient},
};
use secrecy::{ExposeSecret, SecretString};
use utoipa::ToSchema;

use crate::domain::{
    account_form_checks::FormCheck,
    authentication,
    authorization::skip_authorize,
    email_ownership_verification::{MAX_CODE_ATTEMPTS, MIN_RESEND_INTERVAL_MINUTES},
    mail_budget,
};
use crate::prelude::*;

const PENDING_SIGNUP_KEY: &str = "pending_signup";
const PENDING_SIGNUP_LIFETIME_HOURS: i64 = 24;

/// Must match the signup form's check, which counts UTF-16 code units.
const MIN_PASSWORD_LENGTH: usize = 8;

/// Whether `email` passes the signup form's format check: `local@domain` without whitespace or a
/// second `@`, and a dot inside the domain.
fn is_plausible_email(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !domain.contains('@')
        && !email.chars().any(char::is_whitespace)
        && domain
            .char_indices()
            .any(|(i, c)| c == '.' && i > 0 && i + 1 < domain.len())
}

/// Repeats the form's checks of the address and the password, as a request need not come from it.
pub fn validate_form(
    email: &str,
    password: &SecretString,
    password_confirmation: &SecretString,
) -> Result<(), ControllerError> {
    if !is_plausible_email(email) {
        return Err(controller_err!(
            BadRequest,
            "Invalid email address.".to_string()
        ));
    }
    let password = password.expose_secret();
    if password.encode_utf16().count() < MIN_PASSWORD_LENGTH
        || password != password_confirmation.expose_secret()
    {
        return Err(controller_err!(
            BadRequest,
            "Invalid password or password confirmation.".to_string()
        ));
    }
    Ok(())
}

/// Outcome of typing the code. Wrong, expired, spent and "no such signup" are one value, so the
/// answer tells nothing about the code.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SignupConfirmationResult {
    Confirmed,
    Invalid,
    /// The address got an account while the signup waited, e.g. in tmc.mooc.fi.
    AccountExists,
}

/// What the form submitted, with the password already hashed.
pub struct SignupForm<'a> {
    pub email: &'a str,
    pub first_name: &'a str,
    pub last_name: &'a str,
    pub country: &'a str,
    pub language: &'a str,
    pub password_hash: &'a str,
    pub email_communication_consent: bool,
}

/// Starts a signup: stores it as pending, replacing an earlier pending signup for the address,
/// mails the code and remembers in the session what the code step confirms. Nothing is stored or
/// mailed for an address that already has an account or when `check` forbids mail, and the session
/// then remembers a signup no code matches.
pub async fn start(
    conn: &mut PgConnection,
    session: &Session,
    form: &SignupForm<'_>,
    check: FormCheck,
) -> anyhow::Result<()> {
    if !check.should_send_mail {
        return remember_pending_id(session, None);
    }
    match models::users::get_by_email(conn, form.email).await {
        Ok(_) => return remember_pending_id(session, None),
        Err(e)
            if matches!(
                e.error_type(),
                ModelErrorType::RecordNotFound | ModelErrorType::NotFound
            ) => {}
        Err(e) => return Err(e.into()),
    }
    let template = code_mail_template(conn, form.language).await?;
    let mut tx = conn.begin().await?;
    // Without budget the earlier pending signup stays, as its code may already be in the inbox.
    if !mail_budget::try_consume_for_address(&mut tx, form.email).await? {
        let is_same_address = pending_email(&mut tx, session)
            .await?
            .is_some_and(|email| email.eq_ignore_ascii_case(form.email));
        return if is_same_address {
            Ok(())
        } else {
            remember_pending_id(session, None)
        };
    }
    let code = user_email_codes::generate_code();
    let id = pending_signups::replace(
        &mut tx,
        &NewPendingSignup {
            email: form.email,
            first_name: form.first_name,
            last_name: form.last_name,
            country: form.country,
            language: form.language,
            password_hash: form.password_hash,
            email_communication_consent: form.email_communication_consent,
            expires_at: Utc::now() + Duration::hours(PENDING_SIGNUP_LIFETIME_HOURS),
        },
        code.expose_secret(),
    )
    .await?;
    queue_code_mail(&mut tx, id, form.email, template.id, code.expose_secret()).await?;
    tx.commit().await?;
    remember_pending_id(session, Some(id))
}

/// The address of the session's unexpired pending signup.
pub async fn pending_email(
    conn: &mut PgConnection,
    session: &Session,
) -> ModelResult<Option<String>> {
    let Some(id) = pending_id(session) else {
        return Ok(None);
    };
    Ok(pending_signups::get_unexpired_for_update(conn, id)
        .await?
        .map(|signup| signup.email))
}

/// Mails a fresh code for the session's pending signup, unless one went out moments ago. Does
/// nothing when the session has none.
pub async fn resend_code(conn: &mut PgConnection, session: &Session) -> anyhow::Result<()> {
    let Some(id) = pending_id(session) else {
        return Ok(());
    };
    let mut tx = conn.begin().await?;
    let Some(signup) = pending_signups::get_unexpired_for_update(&mut tx, id).await? else {
        return Ok(());
    };
    if Utc::now() - signup.code_sent_at < Duration::minutes(MIN_RESEND_INTERVAL_MINUTES) {
        return Ok(());
    }
    let template = code_mail_template(&mut tx, &signup.language).await?;
    // Checked before minting, which retires the code already mailed.
    if !mail_budget::try_consume_for_address(&mut tx, &signup.email).await? {
        return Ok(());
    }
    let code = user_email_codes::generate_code();
    pending_signups::replace_code(&mut tx, id, code.expose_secret()).await?;
    queue_code_mail(
        &mut tx,
        id,
        &signup.email,
        template.id,
        code.expose_secret(),
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

/// The code the session's pending signup was mailed, for the system tests. Test mode only.
pub async fn mailed_code_for_test_mode(
    conn: &mut PgConnection,
    session: &Session,
) -> ModelResult<Option<String>> {
    let Some(id) = pending_id(session) else {
        return Ok(None);
    };
    pending_signups::get_mailed_code(conn, id).await
}

fn pending_id(session: &Session) -> Option<Uuid> {
    session.get::<Uuid>(PENDING_SIGNUP_KEY).ok().flatten()
}

/// Stores `id`, or for `None` one no pending signup has, so the code step accepts no code.
fn remember_pending_id(session: &Session, id: Option<Uuid>) -> anyhow::Result<()> {
    session
        .insert(PENDING_SIGNUP_KEY, id.unwrap_or_else(Uuid::new_v4))
        .map_err(|_| anyhow::anyhow!("Failed to insert to session"))
}

async fn code_mail_template(
    conn: &mut PgConnection,
    language: &str,
) -> ModelResult<email_templates::EmailTemplate> {
    email_templates::get_generic_email_template_by_type_and_language(
        conn,
        EmailTemplateType::VerifyEmailAddress,
        language,
    )
    .await
}

/// Queues the mail carrying `code` for the pending signup `id`. The caller has consumed the mail
/// budget.
async fn queue_code_mail(
    conn: &mut PgConnection,
    id: Uuid,
    email: &str,
    template_id: Uuid,
    code: &str,
) -> ModelResult<()> {
    let delivery_id = email_deliveries::insert_email_delivery_to_address(
        conn,
        email,
        template_id,
        &serde_json::json!({ "CODE": code }),
    )
    .await?;
    pending_signups::set_email_delivery(conn, id, delivery_id).await?;
    Ok(())
}

/// Checks `code` against the session's pending signup and, on a match, creates the account, signs
/// in and deletes the pending signup. Five wrong codes delete the pending signup.
pub async fn confirm(
    conn: &mut PgConnection,
    session: &Session,
    code: &str,
    app_conf: &ApplicationConfiguration,
    tmc_client: &TmcClient,
) -> ControllerResult<web::Json<SignupConfirmationResult>> {
    let Some(id) = pending_id(session) else {
        return skip_authorize().authorized_ok(web::Json(SignupConfirmationResult::Invalid));
    };
    let mut tx = conn.begin().await?;
    let Some(signup) = pending_signups::get_unexpired_for_update(&mut tx, id).await? else {
        return skip_authorize().authorized_ok(web::Json(SignupConfirmationResult::Invalid));
    };
    if !authentication::constant_time_eq(&pending_signups::code_digest(code), &signup.code_digest) {
        if pending_signups::record_failed_attempt(&mut tx, id).await? >= MAX_CODE_ATTEMPTS {
            pending_signups::delete(&mut tx, id).await?;
        }
        tx.commit().await?;
        return skip_authorize().authorized_ok(web::Json(SignupConfirmationResult::Invalid));
    }
    // The row stays locked through the account creation, so a second request with the same code
    // waits and then finds nothing, and a failed creation leaves the signup to retry.
    pending_signups::delete(&mut tx, id).await?;
    let created = create_account(&mut tx, &signup, app_conf, tmc_client).await?;
    tx.commit().await?;
    session.remove(PENDING_SIGNUP_KEY);

    match created {
        Some(user) => {
            if let Some(upstream_id) = user.upstream_id {
                crate::controllers::tmc_server::notify_password_managed_with_retry(
                    tmc_client,
                    upstream_id.to_string(),
                    user.id,
                )
                .await;
            }
            authentication::remember(session, user)?;
            skip_authorize().authorized_ok(web::Json(SignupConfirmationResult::Confirmed))
        }
        None => skip_authorize().authorized_ok(web::Json(SignupConfirmationResult::AccountExists)),
    }
}

/// Creates the account of a confirmed signup, here and in tmc.mooc.fi. Returns `None` when the
/// address got an account in the meantime.
async fn create_account(
    conn: &mut PgConnection,
    signup: &PendingSignup,
    app_conf: &ApplicationConfiguration,
    tmc_client: &TmcClient,
) -> Result<Option<models::users::User>, ControllerError> {
    if models::users::get_by_email(conn, &signup.email)
        .await
        .is_ok()
    {
        return Ok(None);
    }

    let upstream_id = if app_conf.test_mode {
        None
    } else {
        // tmc.mooc.fi needs a password, but courses.mooc.fi manages it from the start, so the
        // account there gets one nobody knows.
        let placeholder_password = SecretString::new(
            base64::Engine::encode(
                &base64::engine::general_purpose::URL_SAFE_NO_PAD,
                rand::random::<[u8; 32]>(),
            )
            .into(),
        );
        match tmc_client
            .post_new_user_to_tmc(
                NewUserInfo {
                    first_name: signup.first_name.clone(),
                    last_name: signup.last_name.clone(),
                    email: signup.email.clone(),
                    password: placeholder_password.clone(),
                    password_confirmation: placeholder_password,
                    language: signup.language.clone(),
                },
                app_conf,
            )
            .await
        {
            Ok(upstream_id) => Some(upstream_id),
            Err(error) => {
                let message = error.message().to_string();
                return match error.error_type() {
                    UtilErrorType::TmcErrorResponse
                        if is_duplicate_email_error_message(&message) =>
                    {
                        Ok(None)
                    }
                    UtilErrorType::TmcErrorResponse => {
                        Err(controller_err!(BadRequest, message, anyhow::anyhow!(error)))
                    }
                    _ => Err(controller_err!(
                        InternalServerError,
                        message,
                        anyhow::anyhow!(error)
                    )),
                };
            }
        }
    };

    let mut tx = conn.begin().await?;
    let inserted = match upstream_id {
        None => {
            models::users::insert(
                &mut tx,
                PKeyPolicy::Generate,
                &signup.email,
                Some(&signup.first_name),
                Some(&signup.last_name),
            )
            .await
        }
        Some(upstream_id) => {
            // tmc.mooc.fi posts the new user back to /api/v0/tmc-server/users/create while
            // post_new_user_to_tmc is in flight, so that callback has usually created it already.
            match models::users::find_by_upstream_id(&mut tx, upstream_id).await? {
                Some(user) => Ok(user.id),
                None => models::users::insert_with_upstream_id_and_moocfi_id(
                    &mut tx,
                    &signup.email,
                    Some(&signup.first_name),
                    Some(&signup.last_name),
                    upstream_id,
                    PKeyPolicy::Generate.into_uuid(),
                )
                .await
                .map(|user| user.id),
            }
        }
    };
    let user_id = match inserted {
        Ok(user_id) => user_id,
        Err(error)
            if matches!(
                error.error_type(),
                ModelErrorType::DatabaseConstraint { constraint, .. } if constraint == "users_email"
            ) =>
        {
            return Ok(None);
        }
        Err(error) => return Err(error.into()),
    };
    models::user_details::update_user_country(&mut tx, user_id, &signup.country).await?;
    models::user_details::update_user_email_communication_consent(
        &mut tx,
        user_id,
        signup.email_communication_consent,
    )
    .await?;
    // After the callback above, which stores a hash of the placeholder password.
    models::user_passwords::upsert_user_password(
        &mut tx,
        user_id,
        &SecretString::from(signup.password_hash.clone()),
    )
    .await?;
    models::user_details::set_email_verified(
        &mut tx,
        user_id,
        models::user_details::EmailVerificationMethod::EmailedCode,
        Utc::now(),
    )
    .await?;
    let user = models::users::get_by_id(&mut tx, user_id).await?;
    tx.commit().await?;
    Ok(Some(user))
}

/// Whether a tmc.mooc.fi error says the address is taken.
fn is_duplicate_email_error_message(message: &str) -> bool {
    let normalized = message.to_lowercase();
    normalized.contains("email already exists")
        || normalized.contains("email is already registered")
        || normalized.contains("email already in use")
        || normalized.contains("duplicate email")
        || normalized.contains("unique constraint")
        || normalized.contains("duplicate key")
        || normalized.contains("users_email")
        || normalized.contains("email_key")
        || normalized.contains("has already been taken")
}
