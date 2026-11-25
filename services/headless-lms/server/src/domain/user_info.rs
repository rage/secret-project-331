//! The profile form shared by the main frontend and the course material.

use headless_lms_models::account_form_decisions::AccountFormAction;
use headless_lms_utils::ip_to_country::IpToCountryMapper;
use headless_lms_utils::services::tmc::{TmcClient, email_change_reaches_tmc_now};
use models::user_details::UserDetail;
use utoipa::ToSchema;

use crate::{
    domain::{account_form_checks, tmc_user_sync},
    prelude::*,
};

/// The profile form as both frontends submit it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct UserInfoPayload {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub country: String,
    pub email_communication_consent: bool,
    /// The form's opaque report about the browser, for the account form log.
    pub client_info: Option<String>,
}

/// Whether the save that returned `updated` may mail a verification code: only when it changed the
/// address, and the [account form checks](account_form_checks) allow mailing the stored one.
pub async fn may_mail_changed_email(
    conn: &mut PgConnection,
    ip_to_country: &IpToCountryMapper,
    request: &HttpRequest,
    user_id: Uuid,
    payload: &UserInfoPayload,
    updated: &UpdatedUserInfo,
) -> bool {
    updated.email_changed
        && account_form_checks::may_send_mail(
            conn,
            ip_to_country,
            &account_form_checks::Submission {
                action: AccountFormAction::EmailChange,
                request,
                client_report: payload.client_info.as_deref(),
                email: Some(&updated.user_details.email),
                user_id: Some(user_id),
                profile: None,
            },
        )
        .await
}

/// A saved profile form.
pub struct UpdatedUserInfo {
    pub user_details: UserDetail,
    /// The address changed, so the caller should mail a verification code for the new one.
    pub email_changed: bool,
}

/// Saves the profile form and copies a changed name to TMC, where the same account signs in.
///
/// A changed email reaches TMC here only when email ownership verification is off; otherwise
/// [`crate::controllers::main_frontend::email_verification::verify_email_ownership`] sends it once
/// the user proves the address with a verification code. Commits only after TMC accepts, so a TMC
/// failure leaves the profile as it was, and an address TMC refuses fails with `BadRequest`.
pub async fn update_user_info(
    conn: &mut PgConnection,
    user_id: Uuid,
    payload: &UserInfoPayload,
    tmc_client: &TmcClient,
    app_conf: &ApplicationConfiguration,
) -> Result<UpdatedUserInfo, ControllerError> {
    let mut tx = conn.begin().await?;

    let existing = models::user_details::get_user_details_by_user_id_for_update(&mut tx, user_id)
        .await
        .context("Failed to fetch existing user data")?;

    let user_details = models::user_details::update_user_info(
        &mut tx,
        user_id,
        &payload.email,
        &payload.first_name,
        &payload.last_name,
        &payload.country,
        payload.email_communication_consent,
    )
    .await
    .context("Failed to update database")?;

    let email_changed = existing.email != user_details.email;
    let name_changed = existing.first_name.as_deref() != Some(payload.first_name.as_str())
        || existing.last_name.as_deref() != Some(payload.last_name.as_str());

    let email_reaches_tmc = email_changed
        && email_change_reaches_tmc_now(app_conf.enable_email_ownership_verification, false);
    if name_changed || email_reaches_tmc {
        let upstream_id = models::users::get_by_id(&mut tx, user_id)
            .await
            .context("Failed to fetch user")?
            .upstream_id;
        tmc_user_sync::copy_profile_to_tmc(
            upstream_id,
            name_changed.then(|| (payload.first_name.clone(), payload.last_name.clone())),
            email_reaches_tmc.then(|| user_details.email.clone()),
            tmc_client,
            app_conf,
        )
        .await?;
    }

    tx.commit().await?;

    Ok(UpdatedUserInfo {
        user_details,
        email_changed,
    })
}
