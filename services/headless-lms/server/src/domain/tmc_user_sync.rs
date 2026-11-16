//! Copying a user's name and email to TMC, which keeps its own copy of both and signs the same
//! account in by the email. Callers run these last inside their transaction: TMC cannot be rolled
//! back, so a TMC failure must be the one that rolls the change back.

use headless_lms_utils::services::tmc::{TmcClient, tmc_sync_target};

use crate::prelude::*;

/// Copies a changed name to TMC. A no-op for an account without a TMC id.
pub async fn copy_name_to_tmc(
    upstream_id: Option<i32>,
    first_name: String,
    last_name: String,
    tmc_client: &TmcClient,
    app_conf: &ApplicationConfiguration,
) -> Result<(), ControllerError> {
    let Some(upstream_id) = tmc_sync_target(upstream_id, app_conf) else {
        return Ok(());
    };
    tmc_client
        .update_user_name(first_name, last_name, upstream_id)
        .await
        .map_err(|error| {
            controller_err!(
                InternalServerError,
                "Failed to update the name on TMC".to_string(),
                error
            )
        })
}

/// Makes TMC hold `email`, writing only when its copy differs. A no-op for an account without a
/// TMC id. Send only an address the user entered on the platform: an unchanged one may be older
/// than TMC's.
///
/// Fails with `BadRequest` when TMC refuses the address, e.g. because another account uses it.
pub async fn copy_email_to_tmc(
    upstream_id: Option<i32>,
    email: String,
    tmc_client: &TmcClient,
    app_conf: &ApplicationConfiguration,
) -> Result<(), ControllerError> {
    let Some(upstream_id) = tmc_sync_target(upstream_id, app_conf) else {
        return Ok(());
    };
    tmc_client
        .sync_user_email(email, upstream_id)
        .await
        .map_err(|error| {
            if error.is_tmc_refused_address() {
                controller_err!(
                    BadRequest,
                    "This email address cannot be used. It may belong to another account."
                        .to_string(),
                    error
                )
            } else {
                controller_err!(
                    InternalServerError,
                    "Failed to update the email on TMC".to_string(),
                    error
                )
            }
        })
}
