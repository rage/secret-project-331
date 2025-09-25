use std::str::FromStr;

use headless_lms_models::{oauth_client, oauth_shared_types::Digest};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

pub struct SeedOAuthClientsResult {
    pub client_db_id: Uuid,
}

pub async fn seed_oauth_clients(db_pool: Pool<Postgres>) -> anyhow::Result<SeedOAuthClientsResult> {
    info!("Inserting OAuth Clients");
    let mut conn = db_pool.acquire().await?;
    let new_client_parms = oauth_client::NewClientParams {
        client_id: "test-client-id",
        client_secret: &Digest::from_str(
            "396b544a35b29f7d613452a165dcaebf4d71b80e981e687e91ce6d9ba9679cb2",
        )
        .unwrap(), // "very-secret"
        pepper_id: 1,
        redirect_uris: &["http://127.0.0.1:8765/callback".to_string()],
        grant_types: &["user_info".to_string()],
        scope: Some("openid email profile"),
        origin: "http://localhost",
        bearer_allowed: true,
    };

    let client = oauth_client::OAuthClient::insert(&mut conn, new_client_parms).await?;

    Ok(SeedOAuthClientsResult {
        client_db_id: client,
    })
}
