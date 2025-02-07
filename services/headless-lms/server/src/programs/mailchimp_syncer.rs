use crate::setup_tracing;
use dotenv::dotenv;
use headless_lms_models::marketing_consents::MarketingMailingListAccessToken;
use headless_lms_models::marketing_consents::UserEmailSubscription;
use headless_lms_models::marketing_consents::UserMarketingConsentWithDetails;
use headless_lms_utils::http::REQWEST_CLIENT;
use serde::Deserialize;
use serde_json::json;
use sqlx::{PgConnection, PgPool};
use std::{
    env,
    time::{Duration, Instant},
};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
struct MailchimpField {
    field_id: String,
    field_name: String,
}

#[derive(Debug)]
struct FieldSchema {
    tag: &'static str,
    name: &'static str,
    default_value: &'static str,
}

const REQUIRED_FIELDS: &[FieldSchema] = &[
    FieldSchema {
        tag: "FNAME",
        name: "First Name",
        default_value: "",
    },
    FieldSchema {
        tag: "LNAME",
        name: "Last Name",
        default_value: "",
    },
    FieldSchema {
        tag: "MARKETING",
        name: "Accepts Marketing",
        default_value: "disallowed",
    },
    FieldSchema {
        tag: "LOCALE",
        name: "Locale",
        default_value: "en",
    },
    FieldSchema {
        tag: "GRADUATED",
        name: "Graduated",
        default_value: "",
    },
    FieldSchema {
        tag: "COURSEID",
        name: "Course ID",
        default_value: "",
    },
    FieldSchema {
        tag: "LANGGRPID",
        name: "Course language Group ID",
        default_value: "",
    },
    FieldSchema {
        tag: "USERID",
        name: "User ID",
        default_value: "",
    },
    FieldSchema {
        tag: "RESEARCH",
        name: "Research consent",
        default_value: "false",
    },
];

/// These fields are excluded from removing all fields that are not in the schema
const FIELDS_EXCLUDED_FROM_REMOVING: &[&str] = &["PHONE", "PACE", "COUNTRY", "MMERGE9"];
const REMOVE_UNSUPPORTED_FIELDS: bool = false;
const PROCESS_UNSUBSCRIBES_INTERVAL_SECS: u64 = 10_800;

const SYNC_INTERVAL_SECS: u64 = 10;
const PRINT_STILL_RUNNING_MESSAGE_TICKS_THRESHOLD: u32 = 60;

/// The main function that initializes environment variables, config, and sync process.
pub async fn main() -> anyhow::Result<()> {
    initialize_environment()?;

    let config = initialize_configuration().await?;

    let db_pool = initialize_database_pool(&config.database_url).await?;
    let mut conn = db_pool.acquire().await?;

    let mut interval = tokio::time::interval(Duration::from_secs(SYNC_INTERVAL_SECS));
    let mut ticks = 0;

    let access_tokens =
        headless_lms_models::marketing_consents::fetch_all_marketing_mailing_list_access_tokens(
            &mut conn,
        )
        .await?;

    // Iterate through access tokens and ensure Mailchimp schema is set up
    for token in &access_tokens {
        if let Err(e) = ensure_mailchimp_schema(
            &token.mailchimp_mailing_list_id,
            &token.server_prefix,
            &token.access_token,
        )
        .await
        {
            error!(
                "Failed to set up Mailchimp schema for list '{}': {:?}",
                token.mailchimp_mailing_list_id, e
            );
            return Err(e);
        }
    }

    info!("Starting mailchimp syncer.");

    let mut last_time_unsubscribes_processed = Instant::now();

    loop {
        interval.tick().await;
        ticks += 1;

        if ticks >= PRINT_STILL_RUNNING_MESSAGE_TICKS_THRESHOLD {
            ticks = 0;
            info!("Still syncing.");
        }
        let mut process_unsubscribes = false;
        if last_time_unsubscribes_processed.elapsed().as_secs()
            >= PROCESS_UNSUBSCRIBES_INTERVAL_SECS
        {
            process_unsubscribes = true;
            last_time_unsubscribes_processed = Instant::now();
        };
        if let Err(e) = sync_contacts(&mut conn, &config, process_unsubscribes).await {
            error!("Error during synchronization: {:?}", e);
        }
    }
}

/// Initializes environment variables, logging, and tracing setup.
fn initialize_environment() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    Ok(())
}

/// Structure to hold the configuration settings, such as the database URL.
struct SyncerConfig {
    database_url: String,
}

/// Initializes and returns configuration settings (database URL).
async fn initialize_configuration() -> anyhow::Result<SyncerConfig> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());

    Ok(SyncerConfig { database_url })
}

/// Initializes the PostgreSQL connection pool from the provided database URL.
async fn initialize_database_pool(database_url: &str) -> anyhow::Result<PgPool> {
    PgPool::connect(database_url).await.map_err(|e| {
        anyhow::anyhow!(
            "Failed to connect to the database at {}: {:?}",
            database_url,
            e
        )
    })
}

/// Ensures the Mailchimp schema is up to date, adding required fields and removing any extra ones.
async fn ensure_mailchimp_schema(
    list_id: &str,
    server_prefix: &str,
    access_token: &str,
) -> anyhow::Result<()> {
    let existing_fields =
        fetch_current_mailchimp_fields(list_id, server_prefix, access_token).await?;

    if REMOVE_UNSUPPORTED_FIELDS {
        // Remove extra fields not in REQUIRED_FIELDS or FIELDS_EXCLUDED_FROM_REMOVING
        for field in existing_fields.iter() {
            if !REQUIRED_FIELDS
                .iter()
                .any(|r| r.tag == field.field_name.as_str())
                && !FIELDS_EXCLUDED_FROM_REMOVING.contains(&field.field_name.as_str())
            {
                if let Err(e) = remove_field_from_mailchimp(
                    list_id,
                    &field.field_id,
                    server_prefix,
                    access_token,
                )
                .await
                {
                    warn!("Could not remove field '{}': {}", field.field_name, e);
                } else {
                    info!("Removed field '{}'", field.field_name);
                }
            }
        }
    }

    // Add any required fields that are missing
    for required_field in REQUIRED_FIELDS.iter() {
        if !existing_fields
            .iter()
            .any(|f| f.field_name == required_field.tag)
        {
            if let Err(e) =
                add_field_to_mailchimp(list_id, required_field, server_prefix, access_token).await
            {
                warn!(
                    "Failed to add required field '{}': {}",
                    required_field.name, e
                );
            } else {
                info!(
                    "Successfully added required field '{}'",
                    required_field.name
                );
            }
        } else {
            info!(
                "Field '{}' already exists, skipping addition.",
                required_field.name
            );
        }
    }

    Ok(())
}

/// Fetches the current merge fields from the Mailchimp list schema.
async fn fetch_current_mailchimp_fields(
    list_id: &str,
    server_prefix: &str,
    access_token: &str,
) -> Result<Vec<MailchimpField>, anyhow::Error> {
    let url = format!(
        "https://{}.api.mailchimp.com/3.0/lists/{}/merge-fields",
        server_prefix, list_id
    );

    let response = REQWEST_CLIENT
        .get(&url)
        .header("Authorization", format!("apikey {}", access_token))
        .send()
        .await?;

    if response.status().is_success() {
        let json = response.json::<serde_json::Value>().await?;

        let fields: Vec<MailchimpField> = json["merge_fields"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|field| {
                let field_id = field["merge_id"].as_u64();
                let field_name = field["tag"].as_str();

                if let (Some(field_id), Some(field_name)) = (field_id, field_name) {
                    Some(MailchimpField {
                        field_id: field_id.to_string(),
                        field_name: field_name.to_string(),
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(fields)
    } else {
        let error_text = response.text().await?;
        error!("Error fetching merge fields: {}", error_text);
        Err(anyhow::anyhow!("Failed to fetch current Mailchimp fields."))
    }
}

/// Adds a new merge field to the Mailchimp list.
async fn add_field_to_mailchimp(
    list_id: &str,
    field_schema: &FieldSchema,
    server_prefix: &str,
    access_token: &str,
) -> anyhow::Result<()> {
    let url = format!(
        "https://{}.api.mailchimp.com/3.0/lists/{}/merge-fields",
        server_prefix, list_id
    );

    let body = json!({
        "tag": field_schema.tag,
        "name": field_schema.name,
        "type": "text",
        "default_value": field_schema.default_value,
    });

    let response = REQWEST_CLIENT
        .post(&url)
        .header("Authorization", format!("apikey {}", access_token))
        .json(&body)
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "No additional error info.".to_string());
        Err(anyhow::anyhow!(
            "Failed to add field to Mailchimp. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}

/// Removes a merge field from the Mailchimp list by with a field ID.
async fn remove_field_from_mailchimp(
    list_id: &str,
    field_id: &str,
    server_prefix: &str,
    access_token: &str,
) -> anyhow::Result<()> {
    let url = format!(
        "https://{}.api.mailchimp.com/3.0/lists/{}/merge-fields/{}",
        server_prefix, list_id, field_id
    );

    let response = REQWEST_CLIENT
        .delete(&url)
        .header("Authorization", format!("apikey {}", access_token))
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "No additional error info.".to_string());
        Err(anyhow::anyhow!(
            "Failed to remove field from Mailchimp. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}

/// Synchronizes the user contacts with Mailchimp.
/// Added a boolean flag to determine whether to process unsubscribes.
async fn sync_contacts(
    conn: &mut PgConnection,
    _config: &SyncerConfig,
    process_unsubscribes: bool,
) -> anyhow::Result<()> {
    let access_tokens =
        headless_lms_models::marketing_consents::fetch_all_marketing_mailing_list_access_tokens(
            conn,
        )
        .await?;

    let mut successfully_synced_user_ids = Vec::new();

    // Iterate through tokens and fetch and send user details to Mailchimp
    for token in access_tokens {
        // Fetch all users from Mailchimp and sync possible changes locally
        if process_unsubscribes {
            let mailchimp_data = fetch_unsubscribed_users_from_mailchimp_in_chunks(
                &token.mailchimp_mailing_list_id,
                &token.server_prefix,
                &token.access_token,
                1000,
            )
            .await?;

            info!(
                "Processing Mailchimp data for list: {}",
                token.mailchimp_mailing_list_id
            );

            process_unsubscribed_users_from_mailchimp(conn, mailchimp_data).await?;
        }

        // Fetch unsynced emails and update them in Mailchimp
        let users_with_unsynced_emails =
            headless_lms_models::marketing_consents::fetch_all_unsynced_updated_emails(
                conn,
                token.course_language_group_id,
            )
            .await?;

        info!(
            "Found {} unsynced user email(s) for course language group: {}",
            users_with_unsynced_emails.len(),
            token.course_language_group_id
        );

        if !users_with_unsynced_emails.is_empty() {
            let email_synced_user_ids = update_emails_in_mailchimp(
                users_with_unsynced_emails,
                &token.mailchimp_mailing_list_id,
                &token.server_prefix,
                &token.access_token,
            )
            .await?;

            // Store the successfully synced user IDs from updating emails
            successfully_synced_user_ids.extend(email_synced_user_ids);
        }

        let tags_for_token = headless_lms_models::marketing_consents::fetch_tags_with_course_language_group_id_and_marketing_mailing_list_access_token_id(conn, token.course_language_group_id, token.id).await?;

        let tag_objects: Vec<serde_json::Value> = tags_for_token
            .into_iter()
            .map(|(tag_name, tag_id)| {
                json!({
                    "name": tag_name,
                    "id": tag_id,
                    "status": "active"
                })
            })
            .collect();

        // Fetch unsynced user consents and update them in Mailchimp
        let unsynced_users_details =
            headless_lms_models::marketing_consents::fetch_all_unsynced_user_marketing_consents_by_course_language_group_id(
                conn,
                token.course_language_group_id,
            )
            .await?;

        info!(
            "Found {} unsynced user consent(s) for course language group: {}",
            unsynced_users_details.len(),
            token.course_language_group_id
        );

        if !unsynced_users_details.is_empty() {
            let consent_synced_user_ids =
                send_users_to_mailchimp(conn, token, unsynced_users_details, tag_objects).await?;

            // Store the successfully synced user IDs from syncing user consents
            successfully_synced_user_ids.extend(consent_synced_user_ids);
        }
    }

    // If there are any successfully synced users, update the database to mark them as synced
    if !successfully_synced_user_ids.is_empty() {
        match headless_lms_models::marketing_consents::update_synced_to_mailchimp_at_to_all_synced_users(
        conn,
        &successfully_synced_user_ids,
    )
    .await
    {
        Ok(_) => {
            info!(
                "Successfully updated synced status for {} users.",
                successfully_synced_user_ids.len()
            );
        }
        Err(e) => {
            error!(
                "Failed to update synced status for {} users: {:?}",
                successfully_synced_user_ids.len(),
                e
            );
        }
    }
    }

    Ok(())
}

/// Sends a batch of users to Mailchimp for synchronization.
pub async fn send_users_to_mailchimp(
    conn: &mut PgConnection,
    token: MarketingMailingListAccessToken,
    users_details: Vec<UserMarketingConsentWithDetails>,
    tag_objects: Vec<serde_json::Value>,
) -> anyhow::Result<Vec<Uuid>> {
    let mut users_data_in_json = vec![];
    let mut user_ids = vec![];
    let mut successfully_synced_user_ids = Vec::new();
    let mut user_id_contact_id_pairs = Vec::new();

    // Prepare each user's data for Mailchimp
    for user in &users_details {
        // Check user has given permission to send data to mailchimp
        if let Some(ref subscription) = user.email_subscription_in_mailchimp {
            if subscription == "subscribed" {
                let user_details = json!({
                    "email_address": user.email,
                    "status": user.email_subscription_in_mailchimp,
                    "merge_fields": {
                        "FNAME": user.first_name.clone().unwrap_or("".to_string()),
                        "LNAME": user.last_name.clone().unwrap_or("".to_string()),
                        "MARKETING": if user.consent { "allowed" } else { "disallowed" },
                        "LOCALE": user.locale,
                        // If the course is not completed, we pass an empty string to mailchimp to remove the value
                        "GRADUATED": user.completed_course_at.map(|cca| cca.to_rfc3339()).unwrap_or("".to_string()),
                        "USERID": user.user_id,
                        "COURSEID": user.course_id,
                        "LANGGRPID": user.course_language_group_id,
                        "RESEARCH" : if user.research_consent.unwrap_or(false) { "allowed" } else { "disallowed" },
                    },
                    "tags": tag_objects.clone()
                });
                users_data_in_json.push(user_details);
                user_ids.push(user.id);
            }
        }
    }

    let batch_request = json!({
        "members": users_data_in_json,
        "update_existing":true
    });

    let url = format!(
        "https://{}.api.mailchimp.com/3.0/lists/{}",
        token.server_prefix, token.mailchimp_mailing_list_id
    );

    // Check if batch is empty before sending
    if users_data_in_json.is_empty() {
        info!("No new users to sync.");
        return Ok(vec![]);
    }

    // Send the batch request to Mailchimp
    let response = REQWEST_CLIENT
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("apikey {}", token.access_token))
        .json(&batch_request)
        .send()
        .await?;

    if response.status().is_success() {
        let response_data: serde_json::Value = response.json().await?;

        // Iterate over both new_members and updated_members to extract user_ids and contact_ids
        for key in &["new_members", "updated_members"] {
            if let Some(members) = response_data[key].as_array() {
                for member in members {
                    if let Some(user_id) = member["merge_fields"]["USERID"].as_str() {
                        if let Ok(uuid) = uuid::Uuid::parse_str(user_id) {
                            successfully_synced_user_ids.push(uuid);
                        }
                        if let Some(contact_id) = member["contact_id"].as_str() {
                            user_id_contact_id_pairs
                                .push((user_id.to_string(), contact_id.to_string()));
                        }
                    }
                }
            }
        }
        // Update the users contact_id from Mailchimp to the database as user_mailchimp_id
        headless_lms_models::marketing_consents::update_user_mailchimp_id_at_to_all_synced_users(
            conn,
            user_id_contact_id_pairs,
        )
        .await?;

        // Return the list of successfully synced user_ids
        Ok(successfully_synced_user_ids)
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(anyhow::anyhow!(
            "Error syncing users to Mailchimp. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}

/// Updates the email addresses of multiple users in a Mailchimp mailing list.
async fn update_emails_in_mailchimp(
    users: Vec<UserEmailSubscription>,
    list_id: &str,
    server_prefix: &str,
    access_token: &str,
) -> anyhow::Result<Vec<Uuid>> {
    let mut successfully_synced_user_ids = Vec::new();
    let mut failed_user_ids = Vec::new();

    for user in users {
        if let Some(ref user_mailchimp_id) = user.user_mailchimp_id {
            if let Some(ref status) = user.email_subscription_in_mailchimp {
                if status != "subscribed" {
                    continue; // Skip this user if they are not subscribed because Mailchimp only updates emails that are subscribed
                }
            }

            let url = format!(
                "https://{}.api.mailchimp.com/3.0/lists/{}/members/{}",
                server_prefix, list_id, user_mailchimp_id
            );

            // Prepare the body for the PUT request
            let body = serde_json::json!({
                "email_address": &user.email,
                "status": &user.email_subscription_in_mailchimp,
            });

            // Update the email
            let update_response = REQWEST_CLIENT
                .put(&url)
                .header("Authorization", format!("apikey {}", access_token))
                .json(&body)
                .send()
                .await?;

            if update_response.status().is_success() {
                successfully_synced_user_ids.push(user.user_id);
            } else {
                failed_user_ids.push(user.user_id);
            }
        } else {
            continue;
        }
    }

    if !failed_user_ids.is_empty() {
        info!("Failed to update the following users:");
        for user_id in &failed_user_ids {
            error!("User ID: {}", user_id);
        }
    }

    Ok(successfully_synced_user_ids)
}

/// Fetches data from Mailchimp in chunks.
async fn fetch_unsubscribed_users_from_mailchimp_in_chunks(
    list_id: &str,
    server_prefix: &str,
    access_token: &str,
    chunk_size: usize,
) -> anyhow::Result<Vec<(String, String, String, String)>> {
    let mut all_data = Vec::new();
    let mut offset = 0;

    loop {
        let url = format!(
            "https://{}.api.mailchimp.com/3.0/lists/{}/members?offset={}&count={}&fields=members.merge_fields,members.status,members.last_changed&status=unsubscribed,non-subscribed",
            server_prefix, list_id, offset, chunk_size
        );

        let response = REQWEST_CLIENT
            .get(&url)
            .header("Authorization", format!("apikey {}", access_token))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let empty_vec = vec![];
        let members = response["members"].as_array().unwrap_or(&empty_vec);
        if members.is_empty() {
            break;
        }

        for member in members {
            // Process the member, but only if necessary fields are present and valid
            if let (Some(status), Some(last_changed), Some(merge_fields)) = (
                member["status"].as_str(),
                member["last_changed"].as_str(),
                member["merge_fields"].as_object(),
            ) {
                // Ensure both USERID and LANGGRPID are present and valid
                if let (Some(user_id), Some(language_group_id)) = (
                    merge_fields.get("USERID").and_then(|v| v.as_str()),
                    merge_fields.get("LANGGRPID").and_then(|v| v.as_str()),
                ) {
                    // Avoid adding data if any field is missing or empty
                    if !user_id.is_empty() && !language_group_id.is_empty() {
                        all_data.push((
                            user_id.to_string(),
                            last_changed.to_string(),
                            language_group_id.to_string(),
                            status.to_string(),
                        ));
                    }
                }
            }
        }

        // Check the pagination info from the response
        let total_items = response["total_items"].as_u64().unwrap_or(0) as usize;
        if offset + chunk_size >= total_items {
            break;
        }

        offset += chunk_size;
    }

    Ok(all_data)
}

const BATCH_SIZE: usize = 1000;

async fn process_unsubscribed_users_from_mailchimp(
    conn: &mut PgConnection,
    mailchimp_data: Vec<(String, String, String, String)>,
) -> anyhow::Result<()> {
    // Log the total size of the Mailchimp data
    let total_records = mailchimp_data.len();

    for chunk in mailchimp_data.chunks(BATCH_SIZE) {
        if chunk.is_empty() {
            continue;
        }

        // Attempt to process the current chunk
        if let Err(e) = headless_lms_models::marketing_consents::update_unsubscribed_users_from_mailchimp_in_bulk(
            conn,
            chunk.to_vec(),
        )
        .await
        {
            error!(
                "Error while processing chunk {}/{}: ",
                (total_records + BATCH_SIZE - 1) / BATCH_SIZE,
                e
            );
        }
    }

    Ok(())
}
