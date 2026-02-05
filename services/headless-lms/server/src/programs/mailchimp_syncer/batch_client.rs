use crate::prelude::*;
use flate2::read::GzDecoder;
use headless_lms_utils::http::REQWEST_CLIENT;
use serde_json::json;
use std::{
    io::{Cursor, Read},
    time::{Duration, Instant},
};
use tar::Archive;

#[derive(Debug, Clone, Serialize)]
pub struct BatchOperation {
    pub method: String,
    pub path: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,
}

#[derive(Debug)]
pub struct BatchPollResponse {
    pub response_body_url: Option<String>,
    pub errored_operations: u64,
    pub total_operations: u64,
}

#[derive(Debug)]
pub struct BatchOperationResult {
    pub operation_id: Option<String>,
    pub status_code: u16,
    pub response: serde_json::Value,
}

/// Mailchimp API limit for batch operations and batch subscribe (500 items/members per request).
pub const MAX_MAILCHIMP_BATCH_SIZE: usize = 500;

/// Submits operations to Mailchimp POST /batches. Chunks at MAX_MAILCHIMP_BATCH_SIZE. Returns batch IDs.
pub async fn submit_batch(
    server_prefix: &str,
    access_token: &str,
    operations: Vec<BatchOperation>,
) -> anyhow::Result<Vec<String>> {
    if operations.is_empty() {
        return Ok(vec![]);
    }
    let total_chunks = operations.len().div_ceil(MAX_MAILCHIMP_BATCH_SIZE);
    let mut batch_ids = Vec::new();
    for (chunk_index, chunk) in operations.chunks(MAX_MAILCHIMP_BATCH_SIZE).enumerate() {
        info!(
            "Submitting batch with {} operations (chunk {}/{})",
            chunk.len(),
            chunk_index + 1,
            total_chunks
        );
        let body = json!({ "operations": chunk });
        let url = format!("https://{}.api.mailchimp.com/3.0/batches", server_prefix);
        let response = REQWEST_CLIENT
            .post(&url)
            .header("Authorization", format!("apikey {}", access_token))
            .json(&body)
            .send()
            .await?;
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Mailchimp batch submit failed: {}",
                error_text
            ));
        }
        let data: serde_json::Value = response.json().await?;
        let id = data["id"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Mailchimp batch response missing id"))?
            .to_string();
        batch_ids.push(id);
    }
    Ok(batch_ids)
}

/// Polls GET /batches/{batch_id} until status is "finished", or timeout. Logs batch error counts when finished.
pub async fn poll_batch_until_finished(
    server_prefix: &str,
    access_token: &str,
    batch_id: &str,
    timeout: Duration,
    poll_interval: Duration,
) -> anyhow::Result<()> {
    poll_batch_until_finished_with_response_url(
        server_prefix,
        access_token,
        batch_id,
        timeout,
        poll_interval,
    )
    .await?;
    Ok(())
}

/// Polls GET /batches/{batch_id} until status is "finished", or timeout. Returns response_body_url and error counts.
pub async fn poll_batch_until_finished_with_response_url(
    server_prefix: &str,
    access_token: &str,
    batch_id: &str,
    timeout: Duration,
    poll_interval: Duration,
) -> anyhow::Result<BatchPollResponse> {
    let deadline = Instant::now() + timeout;
    let start = Instant::now();
    let mut last_logged_minute = 0u64;
    let mut interval = tokio::time::interval(poll_interval);
    loop {
        interval.tick().await;
        if Instant::now() >= deadline {
            return Err(anyhow::anyhow!(
                "Mailchimp batch {} did not finish within {:?}",
                batch_id,
                timeout
            ));
        }
        let url = format!(
            "https://{}.api.mailchimp.com/3.0/batches/{}",
            server_prefix, batch_id
        );
        let response = REQWEST_CLIENT
            .get(&url)
            .header("Authorization", format!("apikey {}", access_token))
            .send()
            .await?;
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Mailchimp batch status check failed: {}",
                error_text
            ));
        }
        let data: serde_json::Value = response.json().await?;
        let status = data["status"].as_str().unwrap_or("");
        let elapsed = start.elapsed();
        if elapsed.as_secs() >= 60 {
            let minute = elapsed.as_secs() / 60;
            if minute > last_logged_minute {
                last_logged_minute = minute;
                info!(
                    "Batch {} still processing after {}s (status: {})",
                    batch_id,
                    elapsed.as_secs(),
                    status
                );
            }
        }
        match status {
            "finished" => {
                let response_body_url = data["response_body_url"].as_str().map(|s| s.to_string());
                if let Some(ref url) = response_body_url {
                    info!("Batch {} results available at: {}", batch_id, url);
                }
                let errored = data["errored_operations"].as_u64().unwrap_or(0);
                let total = data["total_operations"].as_u64().unwrap_or(0);
                if errored > 0 {
                    warn!(
                        "Mailchimp batch {} finished with {} errored operations out of {}",
                        batch_id, errored, total
                    );
                }
                return Ok(BatchPollResponse {
                    response_body_url,
                    errored_operations: errored,
                    total_operations: total,
                });
            }
            "error" | "expired" => {
                return Err(anyhow::anyhow!(
                    "Mailchimp batch {} ended with status: {}",
                    batch_id,
                    status
                ));
            }
            _ => {}
        }
    }
}

fn extract_batch_results_from_value(
    value: serde_json::Value,
    results: &mut Vec<BatchOperationResult>,
) -> anyhow::Result<()> {
    match value {
        serde_json::Value::Array(items) => {
            for item in items {
                extract_batch_results_from_value(item, results)?;
            }
        }
        serde_json::Value::Object(map) => {
            let status_code = if let Some(code) = map.get("status_code").and_then(|v| v.as_u64()) {
                Some(code as u16)
            } else if let Some(code) = map.get("status_code").and_then(|v| v.as_str()) {
                code.parse::<u16>().ok()
            } else {
                None
            };
            if let Some(status_code) = status_code {
                let operation_id = map
                    .get("operation_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let response = map
                    .get("response")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);
                results.push(BatchOperationResult {
                    operation_id,
                    status_code,
                    response,
                });
            } else if let Some(ops) = map.get("operations") {
                extract_batch_results_from_value(ops.clone(), results)?;
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn parse_batch_results_from_tar_gz(bytes: &[u8]) -> anyhow::Result<Vec<BatchOperationResult>> {
    let decoder = GzDecoder::new(Cursor::new(bytes));
    let mut archive = Archive::new(decoder);
    let mut results = Vec::new();
    for entry in archive.entries()? {
        let mut entry = entry?;
        if !entry.header().entry_type().is_file() {
            continue;
        }
        let mut contents = String::new();
        entry.read_to_string(&mut contents)?;
        if contents.trim().is_empty() {
            continue;
        }
        let value: serde_json::Value = serde_json::from_str(&contents)?;
        extract_batch_results_from_value(value, &mut results)?;
    }
    Ok(results)
}

pub fn parse_operation_response_value(value: &serde_json::Value) -> Option<serde_json::Value> {
    match value {
        serde_json::Value::String(raw) => serde_json::from_str(raw).ok(),
        other => Some(other.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::Compression;
    use flate2::write::GzEncoder;
    use std::io::Write;
    use tar::Header;

    fn build_tar_gz(files: &[(&str, &str)]) -> Vec<u8> {
        let mut tar_buf = Vec::new();
        {
            let mut builder = tar::Builder::new(&mut tar_buf);
            for (name, contents) in files {
                let bytes = contents.as_bytes();
                let mut header = Header::new_gnu();
                header.set_path(name).expect("set path");
                header.set_size(bytes.len() as u64);
                header.set_mode(0o644);
                header.set_mtime(0);
                header.set_cksum();
                builder.append(&header, bytes).expect("append tar entry");
            }
            builder.finish().expect("finish tar");
        }
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(&tar_buf)
            .expect("write tar to gzip encoder");
        encoder.finish().expect("finish gzip")
    }

    #[test]
    fn parse_batch_results_from_tar_gz_reads_array_entries() {
        let json = r#"[{ "status_code": 200, "operation_id": "u1", "response": "{\"tags\":[]}" }]"#;
        let bytes = build_tar_gz(&[("result.json", json)]);
        let results = parse_batch_results_from_tar_gz(&bytes).expect("parse tar.gz");
        assert_eq!(results.len(), 1);
        let result = &results[0];
        assert_eq!(result.operation_id.as_deref(), Some("u1"));
        assert_eq!(result.status_code, 200);
        let parsed = parse_operation_response_value(&result.response).expect("parse response");
        assert!(parsed.get("tags").is_some());
    }

    #[test]
    fn parse_batch_results_from_tar_gz_reads_multiple_files() {
        let part1 =
            r#"[{ "status_code": 200, "operation_id": "u1", "response": "{\"ok\":true}" }]"#;
        let part2 = r#"[{ "status_code": "204", "operation_id": "u2", "response": "{}" }]"#;
        let bytes = build_tar_gz(&[("part1.json", part1), ("part2.json", part2)]);
        let results = parse_batch_results_from_tar_gz(&bytes).expect("parse tar.gz");
        assert_eq!(results.len(), 2);
        let mut ids: Vec<_> = results
            .iter()
            .map(|r| r.operation_id.clone().unwrap_or_default())
            .collect();
        ids.sort();
        assert_eq!(ids, vec!["u1".to_string(), "u2".to_string()]);
        let status_u2 = results
            .iter()
            .find(|r| r.operation_id.as_deref() == Some("u2"));
        assert_eq!(status_u2.unwrap().status_code, 204);
    }

    #[test]
    fn parse_batch_results_from_tar_gz_allows_paged_results() {
        let page1 = r#"[{ "status_code": 200, "operation_id": "u1", "response": "{\"page\":1}" }]"#;
        let page2 = r#"[{ "status_code": 200, "operation_id": "u1", "response": "{\"page\":2}" }]"#;
        let bytes = build_tar_gz(&[("page1.json", page1), ("page2.json", page2)]);
        let results = parse_batch_results_from_tar_gz(&bytes).expect("parse tar.gz");
        let count = results
            .iter()
            .filter(|r| r.operation_id.as_deref() == Some("u1"))
            .count();
        assert_eq!(count, 2);
    }

    #[test]
    fn parse_batch_results_from_tar_gz_reads_operations_wrapper() {
        let json = r#"
        {
            "operations": [
                { "status_code": 200, "operation_id": "u1", "response": "{\"ok\":true}" }
            ]
        }
        "#;
        let bytes = build_tar_gz(&[("ops.json", json)]);
        let results = parse_batch_results_from_tar_gz(&bytes).expect("parse tar.gz");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].operation_id.as_deref(), Some("u1"));
    }

    #[test]
    fn parse_operation_response_value_handles_string_json() {
        let value = serde_json::Value::String(r#"{"ok":true}"#.to_string());
        let parsed = parse_operation_response_value(&value).expect("parse response");
        assert_eq!(parsed.get("ok").and_then(|v| v.as_bool()), Some(true));
    }
}
