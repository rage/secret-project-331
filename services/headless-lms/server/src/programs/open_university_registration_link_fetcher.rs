use std::env;

use crate::setup_tracing;
use anyhow::Context;
use chrono::{NaiveDateTime, Utc};
use dotenv::dotenv;
use headless_lms_models as models;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, PgPool};

const OPEN_UNIVERSITY_REGISTRATION_BASE_URL: &str =
    "https://www.avoin.helsinki.fi/palvelut/esittely.aspx?s=";
const OPEN_UNIVERSITY_COURSE_URL: &str = "OPEN_UNIVERSITY_COURSE_URL";
const OPEN_UNIVERSITY_TOKEN: &str = "OPEN_UNIVERSITY_TOKEN";

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let open_university_course_url = env::var(OPEN_UNIVERSITY_COURSE_URL);
    let open_university_token = env::var(OPEN_UNIVERSITY_TOKEN);
    match (open_university_course_url, open_university_token) {
        (Ok(url), Ok(token)) => {
            tracing::info!("Fetching and updating Open University completion links.");
            let db_pool = PgPool::connect(&database_url).await?;
            let mut conn = db_pool.acquire().await?;
            let res = fetch_and_update_completion_links(&mut conn, &url, &token).await;
            match res {
                Ok(updates) => {
                    tracing::info!("{} registration completion links were updated.", updates)
                }
                Err(err) => tracing::error!(
                    "Updating open university completion links resulted in an error: {:#?}",
                    err,
                ),
            };
        }
        _ => {
            tracing::info!(
                "Open university completion link fetch job was a no-op; environment values {} and {} need to be defined.",
                OPEN_UNIVERSITY_COURSE_URL,
                OPEN_UNIVERSITY_TOKEN,
            );
        }
    }
    Ok(())
}

/// Fetches up-to-date Open University completion registration links, upserts them to database and
/// returns to amount of updated records.
async fn fetch_and_update_completion_links(
    conn: &mut PgConnection,
    open_university_course_url: &str,
    open_university_token: &str,
) -> anyhow::Result<u32> {
    let mut updates = 0;
    let client = Client::default();
    let now = Utc::now().naive_utc();
    for uh_course_code in
        models::course_modules::get_all_uh_course_codes_for_open_university(conn).await?
    {
        let url = format!("{}{}", &open_university_course_url, &uh_course_code);
        // TODO: Handle error if no info found for single course code
        let infos =
            get_open_university_info_for_course_code(&client, &url, open_university_token).await;
        if let Ok(infos) = infos {
            // Select link that has already started and has the latest end date.
            let best_candidate = select_best_candidate(now, infos);
            if let Some(open_university_info) = best_candidate {
                // Only update link if there is a new one.
                let res =
                    update_course_registration_link(conn, &uh_course_code, &open_university_info)
                        .await;
                if res.is_err() {
                    tracing::error!("Failed to update link for course code {}", &uh_course_code);
                } else {
                    updates += 1;
                }
            }
        } else {
            tracing::error!(
                "Failed to get completion registration info for course code '{}'.",
                uh_course_code,
            );
        }
    }
    Ok(updates)
}

#[derive(Serialize, Deserialize, Debug)]
struct OpenUniversityInfo {
    #[serde(rename = "oodi_id")]
    link: String,
    #[serde(rename = "alkupvm")]
    start_date: NaiveDateTime,
    #[serde(rename = "loppupvm")]
    end_date: NaiveDateTime,
}

async fn get_open_university_info_for_course_code(
    client: &Client,
    course_url: &str,
    token: &str,
) -> anyhow::Result<Vec<OpenUniversityInfo>> {
    let res = client
        .get(course_url)
        .header("Authorized", format!("Basic {}", token))
        .send()
        .await
        .context("Failed to send a request to Open University.")?;
    let alternatives: Vec<OpenUniversityInfo> = res.json().await?;
    Ok(alternatives)
}

fn select_best_candidate(
    now: NaiveDateTime,
    c: Vec<OpenUniversityInfo>,
) -> Option<OpenUniversityInfo> {
    c.into_iter()
        .filter(|x| x.start_date <= now)
        .max_by(|a, b| a.end_date.cmp(&b.end_date))
}

async fn update_course_registration_link(
    conn: &mut PgConnection,
    uh_course_code: &str,
    open_university_info: &OpenUniversityInfo,
) -> anyhow::Result<()> {
    let full_url = format!(
        "{}{}",
        OPEN_UNIVERSITY_REGISTRATION_BASE_URL, open_university_info.link,
    );
    models::open_university_registration_links::upsert(conn, uh_course_code, &full_url).await?;
    Ok(())
}
