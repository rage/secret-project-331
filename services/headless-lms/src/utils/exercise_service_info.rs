/*!
For fetching information about exercise services.
*/

use anyhow::Result;
use reqwest::IntoUrl;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct FetchedExerciseServiceInfo {
    pub service_name: String,
    pub editor_iframe_path: String,
    pub exercise_iframe_path: String,
    pub grade_endpoint_path: String,
}

pub async fn fetch_service_info(url: impl IntoUrl) -> Result<()> {
    let client = reqwest::Client::new();
    let res = client
        .get(url) // http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info
        .timeout(Duration::from_secs(120))
        .send()
        .await?;
    let status = res.status();
    if !status.is_success() {
        anyhow::bail!("Could not fetch service info.")
    }
    let _obj = res.json::<FetchedExerciseServiceInfo>().await?;
    Ok(())
}
