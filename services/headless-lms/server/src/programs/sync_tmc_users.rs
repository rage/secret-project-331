/*!
Syncs tmc users
*/
use std::env;

use crate::setup_tracing;
use anyhow::Context;

use dotenv::dotenv;
use headless_lms_models as models;
use models::users::get_users_ids_in_db_from_upstream_ids;

use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, PgPool};

const URL: &str = "https://tmc.mooc.fi/api/v8/users/recently_changed_user_details";

#[derive(Debug, Serialize, Deserialize)]
pub struct TMCRecentChanges {
    pub changes: Vec<Change>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Change {
    pub change_type: String,
    pub new_value: Option<String>,
    pub old_value: Option<String>,
    pub created_at: String,
    pub id: i32,
    pub user_id: Option<i32>,
}

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let recent_changes = fetch_recently_changed_user_details().await?;
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    delete_users(&mut conn, &recent_changes).await?;
    Ok(())
}

pub async fn delete_users(
    conn: &mut PgConnection,
    recent_changes: &TMCRecentChanges,
) -> anyhow::Result<()> {
    let to_delete = recent_changes
        .changes
        .iter()
        .filter(|c| c.change_type == "deleted")
        .filter_map(|c| c.user_id)
        .collect::<Vec<_>>();
    info!("Making sure {} users are deleted", to_delete.len());
    let user_ids_in_db = get_users_ids_in_db_from_upstream_ids(&mut *conn, &to_delete).await?;
    info!("{} users need to be deleted", to_delete.len());
    for id in user_ids_in_db {
        models::users::delete_user(&mut *conn, id).await?;
    }
    info!("Deletions done");
    Ok(())
}

pub async fn fetch_recently_changed_user_details() -> anyhow::Result<TMCRecentChanges> {
    let access_token = env::var("TMC_ACCESS_TOKEN").expect("TMC_ACCESS_TOKEN must be defined");
    let ratelimit_api_key = env::var("RATELIMIT_PROTECTION_SAFE_API_KEY")
        .expect("RATELIMIT_PROTECTION_SAFE_API_KEY must be defined");
    let client = reqwest::Client::new();
    let res = client
        .get(URL)
        .header("RATELIMIT-PROTECTION-SAFE-API-KEY", ratelimit_api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Bearer {access_token}"),
        )
        .send()
        .await
        .context("Failed to send request to https://tmc.mooc.fi")?;
    if res.status().is_success() {
        let res: TMCRecentChanges = res.json().await?;
        info!("Fetched {} changes", res.changes.len());
        Ok(res)
    } else {
        let response_body = res.bytes().await?.to_vec();
        let response_body_string = String::from_utf8_lossy(&response_body);
        error!(
            ?response_body_string,
            "Failed to fetch recently changed user details",
        );
        Err(anyhow::anyhow!(
            "Failed to get recently changed user details from TMC"
        ))
    }
}
