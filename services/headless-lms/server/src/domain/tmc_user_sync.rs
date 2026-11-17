//! Copying a user's name and email to TMC, which keeps its own copy of both and signs the same
//! account in by the email. Callers run these last inside their transaction: TMC cannot be rolled
//! back, so a TMC failure must be the one that rolls the change back.

use headless_lms_utils::services::tmc::{TmcClient, tmc_sync_target};

use crate::prelude::*;

/// Copies a changed name and/or email to TMC in one write, so TMC takes both or neither. A no-op
/// for an account without a TMC id. Send only an email the user entered on the platform: an
/// unchanged one may be older than TMC's.
///
/// Fails with `BadRequest` when TMC refuses the address, e.g. because another account uses it.
pub async fn copy_profile_to_tmc(
    upstream_id: Option<i32>,
    name: Option<(String, String)>,
    email: Option<String>,
    tmc_client: &TmcClient,
    app_conf: &ApplicationConfiguration,
) -> Result<(), ControllerError> {
    let Some(upstream_id) = tmc_sync_target(upstream_id, app_conf) else {
        return Ok(());
    };
    let sends_email = email.is_some();
    tmc_client
        .sync_user_profile(upstream_id, name, email)
        .await
        .map_err(|error| {
            if sends_email && error.is_tmc_refused_address() {
                controller_err!(
                    BadRequest,
                    "This email address cannot be used. It may belong to another account."
                        .to_string(),
                    error
                )
            } else {
                controller_err!(
                    InternalServerError,
                    "Failed to update the account on TMC".to_string(),
                    error
                )
            }
        })
}
