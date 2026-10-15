use headless_lms_models::users;
use sqlx::{Pool, Postgres};

use crate::domain::session_verification::remember_test_mode_browser;

/// Remembers every user's test-mode browser token, which the saved Playwright logins carry from
/// before the reseed. Runs last so it covers the users every other seed step creates.
pub async fn seed_verified_browsers(db_pool: Pool<Postgres>) -> anyhow::Result<()> {
    info!("inserting verified browsers");
    let mut conn = db_pool.acquire().await?;
    for user_id in users::get_all_ids(&mut conn).await? {
        remember_test_mode_browser(&mut conn, user_id).await?;
    }
    Ok(())
}
