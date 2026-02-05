use headless_lms_models::marketing_consents::MarketingMailingListAccessToken;
use headless_lms_models::marketing_consents::UserMarketingConsentWithDetails;
use reqwest::Method;
use serde_json::json;
use std::time::Duration;
use uuid::Uuid;

use super::mailchimp_ops::{MailchimpExecutor, MailchimpOperation};

const CONSENTED_TAG: &str = "consented-to-marketing";
const NO_CONSENT_TAG: &str = "no-marketing-consent";

#[derive(Debug, Clone)]
struct PolicyTagTarget {
    user_id: Uuid,
    member_id: String,
    desired_language_tag: Option<String>,
    consent_active: bool,
}

#[derive(Debug, Clone)]
pub struct PolicyTagSyncResult {
    pub user_id: Uuid,
    pub success: bool,
    pub error: Option<String>,
}

fn normalize_locale_to_language_tag(locale: Option<&str>) -> Option<String> {
    let locale = locale?.trim();
    if locale.is_empty() {
        return None;
    }
    let normalized = locale.replace('_', "-").to_lowercase();
    if normalized.is_empty() {
        return None;
    }
    Some(format!("language-{}", normalized))
}

fn normalize_tag_status(status: Option<&str>) -> &str {
    status.unwrap_or("inactive")
}

fn extract_tag_status_map(
    response: &serde_json::Value,
) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let tags = response.get("tags").and_then(|v| v.as_array());
    if let Some(tags) = tags {
        for tag in tags {
            let name = match tag.get("name").and_then(|v| v.as_str()) {
                Some(name) => name,
                None => continue,
            };
            let status = normalize_tag_status(tag.get("status").and_then(|v| v.as_str()));
            map.insert(name.to_string(), status.to_string());
        }
    }
    map
}

fn current_status<'a>(
    status_map: &'a std::collections::HashMap<String, String>,
    tag_name: &str,
) -> &'a str {
    status_map
        .get(tag_name)
        .map(|s| s.as_str())
        .unwrap_or("inactive")
}

fn compute_policy_tag_updates(
    status_map: &std::collections::HashMap<String, String>,
    desired_language: Option<&str>,
    consent_active: bool,
) -> (Vec<(String, String)>, bool) {
    let mut updates = std::collections::HashMap::new();
    let mut needs_update = false;

    for (name, status) in status_map.iter() {
        if name.starts_with("language-")
            && Some(name.as_str()) != desired_language
            && status == "active"
        {
            updates.insert(name.clone(), "inactive".to_string());
            needs_update = true;
        }
    }
    if let Some(desired) = desired_language
        && current_status(status_map, desired) != "active"
    {
        updates.insert(desired.to_string(), "active".to_string());
        needs_update = true;
    }

    let desired_consent_status = if consent_active { "active" } else { "inactive" };
    let desired_no_consent_status = if consent_active { "inactive" } else { "active" };
    if current_status(status_map, CONSENTED_TAG) != desired_consent_status {
        updates.insert(
            CONSENTED_TAG.to_string(),
            desired_consent_status.to_string(),
        );
        needs_update = true;
    }
    if current_status(status_map, NO_CONSENT_TAG) != desired_no_consent_status {
        updates.insert(
            NO_CONSENT_TAG.to_string(),
            desired_no_consent_status.to_string(),
        );
        needs_update = true;
    }

    (
        updates.into_iter().collect::<Vec<(String, String)>>(),
        needs_update,
    )
}

fn build_targets(
    users_details: &[UserMarketingConsentWithDetails],
    mailchimp_id_by_user: &std::collections::HashMap<Uuid, String>,
) -> Vec<PolicyTagTarget> {
    let mut targets = Vec::new();
    for user in users_details {
        if let Some(ref status) = user.email_subscription_in_mailchimp
            && status == "subscribed"
            && let Some(member_id) = mailchimp_id_by_user.get(&user.user_id)
        {
            targets.push(PolicyTagTarget {
                user_id: user.user_id,
                member_id: member_id.clone(),
                desired_language_tag: normalize_locale_to_language_tag(user.locale.as_deref()),
                consent_active: user.consent,
            });
        }
    }
    targets
}

pub async fn sync_policy_tags_for_users(
    token: &MarketingMailingListAccessToken,
    users_details: &[UserMarketingConsentWithDetails],
    mailchimp_id_by_user: &std::collections::HashMap<Uuid, String>,
    timeout: Duration,
    poll_interval: Duration,
) -> anyhow::Result<Vec<PolicyTagSyncResult>> {
    if users_details.is_empty() {
        return Ok(vec![]);
    }

    let targets = build_targets(users_details, mailchimp_id_by_user);
    if targets.is_empty() {
        return Ok(vec![]);
    }

    let executor = MailchimpExecutor::new(timeout, poll_interval);
    let mut target_by_user: std::collections::HashMap<Uuid, &PolicyTagTarget> =
        std::collections::HashMap::new();
    for target in &targets {
        target_by_user.insert(target.user_id, target);
    }

    let get_ops: Vec<MailchimpOperation> = targets
        .iter()
        .map(|target| MailchimpOperation {
            method: Method::GET,
            path: format!(
                "/lists/{}/members/{}/tags",
                token.mailchimp_mailing_list_id, target.member_id
            ),
            body: None,
            operation_id: Some(target.user_id.to_string()),
        })
        .collect();

    let get_results = executor.execute(token, get_ops).await?;

    let mut results_map: std::collections::HashMap<Uuid, PolicyTagSyncResult> =
        std::collections::HashMap::new();
    let mut post_ops = Vec::new();
    let mut pending_post_user_ids = Vec::new();

    for result in get_results {
        let user_id = match result
            .operation_id
            .as_deref()
            .and_then(|id| Uuid::parse_str(id).ok())
        {
            Some(user_id) => user_id,
            None => continue,
        };
        let target = match target_by_user.get(&user_id) {
            Some(target) => target,
            None => continue,
        };

        if let Some(err) = result.error.as_deref() {
            results_map.insert(
                user_id,
                PolicyTagSyncResult {
                    user_id,
                    success: false,
                    error: Some(err.to_string()),
                },
            );
            continue;
        }
        if result.status_code != 200 {
            results_map.insert(
                user_id,
                PolicyTagSyncResult {
                    user_id,
                    success: false,
                    error: Some(format!("GET tags returned status {}", result.status_code)),
                },
            );
            continue;
        }

        let response_value = match result.response_json.as_ref() {
            Some(value) => value,
            None => {
                let snippet = match &result.response_raw {
                    serde_json::Value::String(raw) => raw.chars().take(200).collect::<String>(),
                    other => other.to_string().chars().take(200).collect::<String>(),
                };
                results_map.insert(
                    user_id,
                    PolicyTagSyncResult {
                        user_id,
                        success: false,
                        error: Some(format!(
                            "Unreadable GET tags response (snippet: {})",
                            snippet
                        )),
                    },
                );
                continue;
            }
        };

        let status_map = extract_tag_status_map(response_value);
        let (updates, needs_update) = compute_policy_tag_updates(
            &status_map,
            target.desired_language_tag.as_deref(),
            target.consent_active,
        );
        if !needs_update {
            results_map.insert(
                user_id,
                PolicyTagSyncResult {
                    user_id,
                    success: true,
                    error: None,
                },
            );
            continue;
        }

        let tags: Vec<serde_json::Value> = updates
            .into_iter()
            .map(|(name, status)| json!({ "name": name, "status": status }))
            .collect();
        let body = json!({ "tags": tags });
        post_ops.push(MailchimpOperation {
            method: Method::POST,
            path: format!(
                "/lists/{}/members/{}/tags",
                token.mailchimp_mailing_list_id, target.member_id
            ),
            body: Some(body),
            operation_id: Some(user_id.to_string()),
        });
        pending_post_user_ids.push(user_id);
    }

    if post_ops.is_empty() {
        return Ok(results_map.into_values().collect());
    }

    let post_results = executor.execute(token, post_ops).await?;
    for result in post_results {
        let user_id = match result
            .operation_id
            .as_deref()
            .and_then(|id| Uuid::parse_str(id).ok())
        {
            Some(user_id) => user_id,
            None => continue,
        };
        if let Some(err) = result.error.as_deref() {
            results_map.insert(
                user_id,
                PolicyTagSyncResult {
                    user_id,
                    success: false,
                    error: Some(err.to_string()),
                },
            );
            continue;
        }
        if !result.is_success() {
            results_map.insert(
                user_id,
                PolicyTagSyncResult {
                    user_id,
                    success: false,
                    error: Some(format!("POST tags returned status {}", result.status_code)),
                },
            );
            continue;
        }
        results_map.insert(
            user_id,
            PolicyTagSyncResult {
                user_id,
                success: true,
                error: None,
            },
        );
    }

    for user_id in pending_post_user_ids {
        results_map
            .entry(user_id)
            .or_insert_with(|| PolicyTagSyncResult {
                user_id,
                success: false,
                error: Some("Missing POST result".to_string()),
            });
    }

    let mut ordered_results = Vec::with_capacity(targets.len());
    for target in targets {
        ordered_results.push(results_map.get(&target.user_id).cloned().unwrap_or(
            PolicyTagSyncResult {
                user_id: target.user_id,
                success: false,
                error: Some("Missing result".to_string()),
            },
        ));
    }
    Ok(ordered_results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn compute_policy_tag_updates_builds_expected_deltas() {
        let mut existing = std::collections::HashMap::new();
        existing.insert("language-en".to_string(), "active".to_string());
        existing.insert("language-fi".to_string(), "inactive".to_string());
        existing.insert("no-marketing-consent".to_string(), "active".to_string());
        let (updates, needs_update) =
            compute_policy_tag_updates(&existing, Some("language-fi"), true);
        assert!(needs_update);
        let map: std::collections::HashMap<_, _> = updates.into_iter().collect();
        assert_eq!(map.get("language-en").map(|s| s.as_str()), Some("inactive"));
        assert_eq!(map.get("language-fi").map(|s| s.as_str()), Some("active"));
        assert_eq!(
            map.get("consented-to-marketing").map(|s| s.as_str()),
            Some("active")
        );
        assert_eq!(
            map.get("no-marketing-consent").map(|s| s.as_str()),
            Some("inactive")
        );
    }

    #[test]
    fn normalize_locale_to_language_tag_handles_basic_cases() {
        assert_eq!(
            normalize_locale_to_language_tag(Some("fi_FI")).as_deref(),
            Some("language-fi-fi")
        );
        assert_eq!(
            normalize_locale_to_language_tag(Some("EN-us")).as_deref(),
            Some("language-en-us")
        );
        assert_eq!(normalize_locale_to_language_tag(Some("  ")), None);
        assert_eq!(normalize_locale_to_language_tag(None), None);
    }

    #[test]
    fn compute_policy_tag_updates_no_changes_returns_empty() {
        let existing: HashSet<String> = [
            "language-fi".to_string(),
            "consented-to-marketing".to_string(),
        ]
        .into_iter()
        .collect();
        let mut status_map = std::collections::HashMap::new();
        for name in existing {
            status_map.insert(name, "active".to_string());
        }
        let (updates, needs_update) =
            compute_policy_tag_updates(&status_map, Some("language-fi"), true);
        assert!(!needs_update);
        assert!(updates.is_empty());
    }

    #[test]
    fn extract_tag_status_map_prefers_status_field() {
        let value = serde_json::json!({
            "tags": [
                { "name": "language-fi", "status": "inactive" },
                { "name": "consented-to-marketing", "status": "active" }
            ]
        });
        let map = extract_tag_status_map(&value);
        assert_eq!(map.get("language-fi").map(|s| s.as_str()), Some("inactive"));
        assert_eq!(
            map.get("consented-to-marketing").map(|s| s.as_str()),
            Some("active")
        );
    }
}
