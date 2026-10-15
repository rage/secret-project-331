use headless_lms_models::users;
use sqlx::{Pool, Postgres};

use crate::domain::session_verification::remember_test_mode_browsers;

/// Remembers every user's test-mode browser token, which the saved Playwright logins carry from
/// before the reseed. Runs last so it covers the users every other seed step creates.
pub async fn seed_verified_browsers(db_pool: Pool<Postgres>) -> anyhow::Result<()> {
    info!("inserting verified browsers");
    let mut conn = db_pool.acquire().await?;
    let user_ids = users::get_all_ids(&mut conn).await?;
    remember_test_mode_browsers(&mut conn, &user_ids).await?;
    Ok(())
}
