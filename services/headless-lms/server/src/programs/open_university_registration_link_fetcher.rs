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
    // TODO: Audit that the environment access only happens in single-threaded code.
    if env::var("RUST_LOG").is_err() {
        unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    }
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
    tracing::info!("Fetching new completion links from EduWeb.");

    let mut updates = 0;
    let mut errors = 0;
    let mut skipped = 0;
    let client = Client::default();
    let now = Utc::now().naive_utc();

    let course_codes =
        models::course_modules::get_all_uh_course_codes_for_open_university(conn).await?;
    tracing::info!("Found {} course codes to process", course_codes.len());

    for (index, uh_course_code) in course_codes.iter().enumerate() {
        let trimmed_code = uh_course_code.trim();

        if trimmed_code.is_empty() {
            tracing::warn!(
                "Skipping empty course code at index {} ({}/{})",
                index + 1,
                index + 1,
                course_codes.len()
            );
            skipped += 1;
            continue;
        }

        tracing::debug!(
            "Processing course code {} ({}/{})",
            trimmed_code,
            index + 1,
            course_codes.len()
        );

        let url = format!("{}{}", &open_university_course_url, &trimmed_code);
        tracing::debug!("Fetching data from URL: {}", url);

        // TODO: Handle error if no info found for single course code
        let infos =
            get_open_university_info_for_course_code(&client, &url, open_university_token).await;
        match infos {
            Ok(infos) => {
                tracing::debug!(
                    "Retrieved {} registration alternatives for course code {}",
                    infos.len(),
                    trimmed_code
                );

                // Select link that has already started and has the latest end date.
                let best_candidate = select_best_candidate(now, infos.clone());
                match best_candidate {
                    Some(open_university_info) => {
                        tracing::debug!(
                            "Selected best candidate for course {}: start_date={}, end_date={}, link={}",
                            trimmed_code,
                            open_university_info.start_date,
                            open_university_info.end_date,
                            open_university_info.link
                        );

                        // Only update link if there is a new one.
                        let res = update_course_registration_link(
                            conn,
                            trimmed_code,
                            &open_university_info,
                        )
                        .await;
                        match res {
                            Ok(_) => {
                                tracing::info!(
                                    "Successfully updated registration link for course code {}",
                                    trimmed_code
                                );
                                updates += 1;
                            }
                            Err(err) => {
                                tracing::error!(
                                    "Failed to update link for course code {}: {:#?}",
                                    trimmed_code,
                                    err
                                );
                                errors += 1;
                            }
                        }
                    }
                    None => {
                        tracing::warn!(
                            "No suitable registration candidate found for course code {}",
                            trimmed_code
                        );

                        tracing::info!(
                            "Analyzing {} registration alternatives for course {}:",
                            infos.len(),
                            trimmed_code
                        );

                        let mut future_courses = 0;
                        let mut past_courses = 0;
                        let mut current_courses = 0;

                        for (idx, info) in infos.iter().enumerate() {
                            if info.start_date > now {
                                future_courses += 1;
                                tracing::info!(
                                    "  Alternative {}: FUTURE - start_date={}, end_date={}, link={} (starts in {} days)",
                                    idx + 1,
                                    info.start_date,
                                    info.end_date,
                                    info.link,
                                    (info.start_date - now).num_days()
                                );
                            } else if info.end_date < now {
                                past_courses += 1;
                                tracing::info!(
                                    "  Alternative {}: PAST - start_date={}, end_date={}, link={} (ended {} days ago)",
                                    idx + 1,
                                    info.start_date,
                                    info.end_date,
                                    info.link,
                                    (now - info.end_date).num_days()
                                );
                            } else {
                                current_courses += 1;
                                tracing::info!(
                                    "  Alternative {}: CURRENT - start_date={}, end_date={}, link={} (active for {} more days)",
                                    idx + 1,
                                    info.start_date,
                                    info.end_date,
                                    info.link,
                                    (info.end_date - now).num_days()
                                );
                            }
                        }

                        tracing::info!(
                            "Course {} candidate analysis: {} total alternatives, {} future, {} past, {} current",
                            trimmed_code,
                            infos.len(),
                            future_courses,
                            past_courses,
                            current_courses
                        );

                        if current_courses > 0 {
                            tracing::warn!(
                                "Course {} has {} current alternatives but none were selected - this may indicate a bug in selection logic",
                                trimmed_code,
                                current_courses
                            );
                        } else if future_courses > 0 {
                            tracing::info!(
                                "Course {} has {} future alternatives but no current ones - registration may not be open yet",
                                trimmed_code,
                                future_courses
                            );
                        } else if past_courses > 0 {
                            tracing::info!(
                                "Course {} has {} past alternatives but no current ones - registration period may have ended",
                                trimmed_code,
                                past_courses
                            );
                        } else {
                            tracing::warn!(
                                "Course {} has no registration alternatives at all - this may indicate a data issue",
                                trimmed_code
                            );
                        }

                        skipped += 1;
                    }
                }
            }
            Err(err) => {
                tracing::error!(
                    "Failed to get completion registration info for course code '{}': {:#?}",
                    trimmed_code,
                    err
                );
                errors += 1;
            }
        }
    }

    tracing::info!(
        "Completed Open University completion link fetch and update process. Updates: {}, Errors: {}, Skipped: {}",
        updates,
        errors,
        skipped
    );

    Ok(updates)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
