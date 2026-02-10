use headless_lms_models::marketing_consents::MarketingMailingListAccessToken;
use headless_lms_utils::http::REQWEST_CLIENT;
use reqwest::Method;
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;

use super::batch_client::{
    BatchOperation, parse_batch_results_from_tar_gz, parse_operation_response_value,
    poll_batch_until_finished_with_response_url, submit_batch,
};

const DEFAULT_BATCH_THRESHOLD: usize = 5;

#[derive(Debug, Clone)]
pub struct MailchimpOperation {
    pub method: Method,
    pub path: String,
    pub body: Option<Value>,
    pub operation_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MailchimpOpResult {
    pub operation_id: Option<String>,
    pub status_code: u16,
    pub response_raw: Value,
    pub response_json: Option<Value>,
    pub error: Option<String>,
}

impl MailchimpOpResult {
    pub fn is_success(&self) -> bool {
        (200..=299).contains(&self.status_code) && self.error.is_none()
    }
}

pub struct MailchimpExecutor {
    batch_threshold: usize,
    timeout: Duration,
    poll_interval: Duration,
}

impl MailchimpExecutor {
    /// Executes Mailchimp operations via direct calls or the /batches API.
    pub fn new(timeout: Duration, poll_interval: Duration) -> Self {
        Self {
            batch_threshold: DEFAULT_BATCH_THRESHOLD,
            timeout,
            poll_interval,
        }
    }

    pub async fn execute(
        &self,
        token: &MarketingMailingListAccessToken,
        ops: Vec<MailchimpOperation>,
    ) -> anyhow::Result<Vec<MailchimpOpResult>> {
        if ops.is_empty() {
            return Ok(vec![]);
        }
        if ops.len() < self.batch_threshold {
            Ok(execute_direct(token, ops).await)
        } else {
            execute_batch(token, ops, self.timeout, self.poll_interval).await
        }
    }
}

async fn execute_direct(
    token: &MarketingMailingListAccessToken,
    ops: Vec<MailchimpOperation>,
) -> Vec<MailchimpOpResult> {
    let mut results = Vec::with_capacity(ops.len());
    for op in ops {
        let url = format!(
            "https://{}.api.mailchimp.com/3.0{}",
            token.server_prefix, op.path
        );
        let mut request = REQWEST_CLIENT
            .request(op.method.clone(), &url)
            .header("Authorization", format!("apikey {}", token.access_token));
        if let Some(body) = op.body.clone() {
            request = request.json(&body);
        }
        let response = match request.send().await {
            Ok(resp) => resp,
            Err(err) => {
                results.push(MailchimpOpResult {
                    operation_id: op.operation_id.clone(),
                    status_code: 0,
                    response_raw: Value::Null,
                    response_json: None,
                    error: Some(format!("Transport error: {}", err)),
                });
                continue;
            }
        };

        let status_code = response.status().as_u16();
        let body_bytes = match response.bytes().await {
            Ok(bytes) => bytes,
            Err(err) => {
                results.push(MailchimpOpResult {
                    operation_id: op.operation_id.clone(),
                    status_code,
                    response_raw: Value::Null,
                    response_json: None,
                    error: Some(format!("Body read error: {}", err)),
                });
                continue;
            }
        };

        let response_raw = match serde_json::from_slice::<Value>(&body_bytes) {
            Ok(json) => json,
            Err(_) => Value::String(String::from_utf8_lossy(&body_bytes).to_string()),
        };
        let response_json = parse_operation_response_value(&response_raw);
        results.push(MailchimpOpResult {
            operation_id: op.operation_id.clone(),
            status_code,
            response_raw,
            response_json,
            error: None,
        });
    }
    results
}

async fn execute_batch(
    token: &MarketingMailingListAccessToken,
    ops: Vec<MailchimpOperation>,
    timeout: Duration,
    poll_interval: Duration,
) -> anyhow::Result<Vec<MailchimpOpResult>> {
    if ops.is_empty() {
        return Ok(vec![]);
    }

    let batch_ops: Vec<BatchOperation> = ops
        .iter()
        .map(|op| BatchOperation {
            method: op.method.as_str().to_string(),
            path: op.path.clone(),
            body: op.body.as_ref().map(|b| b.to_string()).unwrap_or_default(),
            operation_id: op.operation_id.clone(),
        })
        .collect();

    let batch_ids = submit_batch(&token.server_prefix, &token.access_token, batch_ops).await?;

    let mut results = Vec::new();
    for batch_id in &batch_ids {
        let poll_result = poll_batch_until_finished_with_response_url(
            &token.server_prefix,
            &token.access_token,
            batch_id,
            timeout,
            poll_interval,
        )
        .await?;
        if poll_result.total_operations > 0 {
            info!(
                "Mailchimp batch {} finished with {} errored operations out of {}",
                batch_id, poll_result.errored_operations, poll_result.total_operations
            );
        }
        let response_url = match poll_result.response_body_url {
            Some(url) => url,
            None => {
                return Err(anyhow::anyhow!(
                    "Mailchimp batch {} finished without response_body_url",
                    batch_id
                ));
            }
        };
        let response = REQWEST_CLIENT.get(&response_url).send().await?;
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to fetch Mailchimp batch results: {}",
                error_text
            ));
        }
        let bytes = response.bytes().await?;
        let batch_results = parse_batch_results_from_tar_gz(&bytes)?;
        for result in batch_results {
            let response_json = parse_operation_response_value(&result.response);
            results.push(MailchimpOpResult {
                operation_id: result.operation_id.clone(),
                status_code: result.status_code,
                response_raw: result.response,
                response_json,
                error: None,
            });
        }
    }

    Ok(order_results(&ops, results))
}

fn order_results(
    ops: &[MailchimpOperation],
    results: Vec<MailchimpOpResult>,
) -> Vec<MailchimpOpResult> {
    let mut ordered = Vec::new();
    let mut results_by_id: HashMap<String, Vec<MailchimpOpResult>> = HashMap::new();
    let mut unmatched = Vec::new();

    for result in results {
        if let Some(ref op_id) = result.operation_id {
            results_by_id.entry(op_id.clone()).or_default().push(result);
        } else {
            unmatched.push(result);
        }
    }

    for op in ops {
        if let Some(ref op_id) = op.operation_id
            && let Some(mut entries) = results_by_id.remove(op_id)
        {
            ordered.append(&mut entries);
        }
    }

    for (_, mut entries) in results_by_id {
        ordered.append(&mut entries);
    }

    ordered.extend(unmatched);
    ordered
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn order_results_respects_input_order() {
        let ops = vec![
            MailchimpOperation {
                method: Method::GET,
                path: "/a".to_string(),
                body: None,
                operation_id: Some("u1".to_string()),
            },
            MailchimpOperation {
                method: Method::GET,
                path: "/b".to_string(),
                body: None,
                operation_id: Some("u2".to_string()),
            },
        ];
        let results = vec![
            MailchimpOpResult {
                operation_id: Some("u2".to_string()),
                status_code: 200,
                response_raw: Value::Null,
                response_json: None,
                error: None,
            },
            MailchimpOpResult {
                operation_id: Some("u1".to_string()),
                status_code: 200,
                response_raw: Value::Null,
                response_json: None,
                error: None,
            },
        ];
        let ordered = order_results(&ops, results);
        assert_eq!(ordered[0].operation_id.as_deref(), Some("u1"));
        assert_eq!(ordered[1].operation_id.as_deref(), Some("u2"));
    }
}
