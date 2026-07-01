/*!
Handlers for HTTP requests to `/api/v0/tmc-server`.

These endpoints are used by the TMC server so that it can integrate with this system.
*/

pub mod users;
pub mod users_by_upstream_id;

use crate::prelude::*;
use headless_lms_utils::services::tmc::TmcClient;

/// Add controllers from all the submodules.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/users-by-upstream-id").configure(users_by_upstream_id::_add_routes))
        .service(web::scope("/users").configure(users::_add_routes));
}

/// Notify TMC that a user's password is now managed by courses.mooc.fi.
///
/// This is **best-effort and never fails the caller**: by the time it runs the password has
/// already been stored locally, so a transient TMC outage must not turn a successful
/// signup/login/migration into an error. It retries a few times inline (so common blips are
/// resolved before the HTTP response) and, if those are exhausted, hands off to a background
/// task that keeps retrying with backoff.
pub async fn notify_password_managed_with_retry(
    tmc_client: &TmcClient,
    upstream_id: String,
    user_id: Uuid,
) {
    const MAX_ATTEMPTS_INLINE: u32 = 3;
    const MAX_DELAY_MS_INLINE: u64 = 2_000;
    for attempt in 1..=MAX_ATTEMPTS_INLINE {
        match tmc_client
            .set_user_password_managed_by_courses_mooc_fi(upstream_id.clone(), user_id)
            .await
        {
            Ok(_) => return,
            Err(e) if attempt < MAX_ATTEMPTS_INLINE => {
                let delay = std::time::Duration::from_millis(
                    200u64
                        .saturating_mul(2u64.pow(attempt - 1))
                        .min(MAX_DELAY_MS_INLINE),
                );
                warn!(
                    "Failed to notify TMC that user's password is saved in courses.mooc.fi (inline attempt {}/{}), retrying in {:?}: upstream_id={}, user_id={}, error={}",
                    attempt, MAX_ATTEMPTS_INLINE, delay, upstream_id, user_id, e
                );
                tokio::time::sleep(delay).await;
            }
            Err(e) => {
                warn!(
                    "Inline TMC notification attempts exhausted, handing off to background task: upstream_id={}, user_id={}, error={}",
                    upstream_id, user_id, e
                );
            }
        }
    }

    let tmc_client = tmc_client.clone();
    tokio::spawn(async move {
        const MAX_ATTEMPTS_BG: u32 = 10;
        const MAX_DELAY_MS_BG: u64 = 30_000;
        for attempt in 1..=MAX_ATTEMPTS_BG {
            match tmc_client
                .set_user_password_managed_by_courses_mooc_fi(upstream_id.clone(), user_id)
                .await
            {
                Ok(_) => {
                    info!(
                        "Background TMC notification succeeded on attempt {}: upstream_id={}, user_id={}",
                        attempt, upstream_id, user_id
                    );
                    return;
                }
                Err(e) if attempt < MAX_ATTEMPTS_BG => {
                    let delay = std::time::Duration::from_millis(
                        200u64
                            .saturating_mul(2u64.pow(attempt - 1))
                            .min(MAX_DELAY_MS_BG),
                    );
                    warn!(
                        "Background TMC notification failed (attempt {}/{}), retrying in {:?}: upstream_id={}, user_id={}, error={}",
                        attempt, MAX_ATTEMPTS_BG, delay, upstream_id, user_id, e
                    );
                    tokio::time::sleep(delay).await;
                }
                Err(e) => {
                    error!(
                        "Background TMC notification exhausted all {} retries: upstream_id={}, user_id={}, error={}",
                        MAX_ATTEMPTS_BG, upstream_id, user_id, e
                    );
                }
            }
        }
    });
}
