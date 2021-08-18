use std::time::Duration;

use crate::controllers::ControllerError;
use crate::controllers::ControllerResult;
use crate::utils::url_to_oembed_endpoint::url_to_oembed_endpoint;
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct OEmbedRequest {
    url: String,
}

// Needed for Spotify oembed, should be fetched from env?
static APP_USER_AGENT: &str = concat!("moocfi", "/", "0.1.0",);

async fn get_oembed(
    query_params: web::Query<OEmbedRequest>,
) -> ControllerResult<Json<serde_json::Value>> {
    let endpoint = url_to_oembed_endpoint(query_params.url.to_string())?;
    let client = reqwest::Client::builder()
        .user_agent(APP_USER_AGENT)
        .build()
        .map_err(|oe| anyhow::anyhow!(oe.to_string()))?;
    let res = client
        .get(endpoint)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|oe| ControllerError::BadRequest(oe.to_string()))?;
    let status = res.status();
    if !status.is_success() {
        let response_url = res.url().to_string();
        let body = res
            .text()
            .await
            .map_err(|oe| ControllerError::BadRequest(oe.to_string()))?;
        warn!(url=?response_url, status=?status, body=?body, "Could not fetch oembed data from provider");
        return Err(ControllerError::BadRequest(
            "Could not fetch oembed data from provider".to_string(),
        ));
    }
    let res = res
        .json::<serde_json::Value>()
        .await
        .map_err(|oe| ControllerError::BadRequest(oe.to_string()))?;
    Ok(Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_oembed_routes(cfg: &mut ServiceConfig) {
    cfg.route("/preview", web::get().to(get_oembed));
}
