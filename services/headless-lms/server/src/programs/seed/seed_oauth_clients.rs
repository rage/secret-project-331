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
    let client = oauth_client::OAuthClient::insert(
        &mut conn,
        "test-client-id",
        Digest::from_str("very-secret").unwrap(), // TODO this has to actually be hashed
        1,
        Vec::from(["http://localhost".to_string()]),
        Vec::from(["user_info".to_string()]),
        "openid email profile",
        "http://localhost",
    )
    .await?;

    Ok(SeedOAuthClientsResult {
        client_db_id: client,
    })
}
