use std::time::Duration;

use crate::{controllers::prelude::*, utils::url_to_oembed_endpoint::url_to_oembed_endpoint};

#[derive(Deserialize)]
pub struct OEmbedRequest {
    url: String,
}

// Needed for Spotify oembed, should be fetched from env?
static APP_USER_AGENT: &str = concat!("moocfi", "/", "0.1.0",);

/**
GET `/api/v0/cms/oembed/preview?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3D123123123` - Fetch oembed response from correct provider.
Endpoint for proxying oembed requests to correct provider using url query param.

# Example

Request:
```http
GET /api/v0/cms/oembed/preview?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3D123123123 HTTP/1.1
Content-Type: text/html

```

Response:
```json
{
    "title":"AUTHOR - Title (OFFICIAL)",
    "author_name":"Author Name",
    "author_url":"https://www.youtube.com/author",
    "type":"video",
    "height":439,
    "width":780,
    "version":"1.0",
    "provider_name":"YouTube",
    "provider_url":"https://www.youtube.com/",
    "thumbnail_height":360,"thumbnail_width":480,
    "thumbnail_url":"https://i.ytimg.com/vi/JWBo/hqdefault.jpg",
    "html":"<iframe width=\"780\" height=\"439\" src=\"https://www.youtube.com/embed/JYjVo?feature=oembed\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen></iframe>"}
}

```
*/
async fn get_oembed_data_from_provider(
    query_params: web::Query<OEmbedRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<serde_json::Value>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Teach, user.id, Res::AnyCourse).await?;
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
    Ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/preview", web::get().to(get_oembed_data_from_provider));
}
