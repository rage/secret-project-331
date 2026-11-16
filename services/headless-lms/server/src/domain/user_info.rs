//! The profile form shared by the main frontend and the course material.

use headless_lms_utils::services::tmc::TmcClient;
use models::user_details::UserDetail;
use utoipa::ToSchema;

use crate::{controllers, prelude::*};

/// The profile form as both frontends submit it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct UserInfoPayload {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub country: String,
    pub email_communication_consent: bool,
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
/// the address is proven. Commits only after TMC accepts, so a TMC failure leaves the profile as it
/// was.
pub async fn update_user_info(
    conn: &mut PgConnection,
    user_id: Uuid,
    payload: &UserInfoPayload,
    tmc_client: &TmcClient,
    app_conf: &ApplicationConfiguration,
) -> Result<UpdatedUserInfo, ControllerError> {
    let mut tx = conn.begin().await?;

    let existing = models::user_details::get_user_details_by_user_id(&mut tx, user_id)
        .await
        .context("Failed to fetch existing user data")?;
    let user = models::users::get_by_id(&mut tx, user_id)
        .await
        .context("Failed to fetch user")?;

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

    if email_changed || name_changed {
        controllers::auth::update_user_information_to_tmc(
            user.upstream_id,
            payload.first_name.clone(),
            payload.last_name.clone(),
            (email_changed && !app_conf.enable_email_ownership_verification)
                .then(|| payload.email.clone()),
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
