use std::{collections::HashMap, time::Duration};

use headless_lms_utils::url_to_oembed_endpoint::url_to_oembed_endpoint;
use serde::{Deserialize, Serialize};
use url::Url;

use crate::controllers::prelude::*;

#[derive(Deserialize)]
pub struct OEmbedRequest {
    url: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct ThemeSupports {
    pub responsive_embeds: bool,
}

#[derive(Deserialize, Serialize)]
pub struct ThemeResponse {
    pub theme_supports: ThemeSupports,
}

#[derive(Deserialize, Serialize)]
pub struct OEmbedResponse {
    pub author_name: String,
    pub author_url: String,
    // pub height: i32,
    pub html: String,
    pub provider_name: String,
    pub provider_url: String,
    // pub thumbnail_height: i32,
    // pub thumbnail_url: String,
    // pub thumbnail_width: i32,
    pub title: String,
    // pub "type": String,
    pub version: String,
    // pub width: i32,
}

// Needed for Spotify oembed, should be fetched from env?
static APP_USER_AGENT: &str = concat!("moocfi", "/", "0.1.0",);

/**
GET `/api/v0/cms/gutenberg/oembed/preview?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3D123123123` - Fetch oembed response from correct provider.
Endpoint for proxying oembed requests to correct provider using url query param.

# Example

Request:
```http
GET /api/v0/cms/gutenberg/oembed/preview?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3D123123123 HTTP/1.1
Content-Type: application/json

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
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<serde_json::Value>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    let endpoint = url_to_oembed_endpoint(
        query_params.url.to_string(),
        Some(app_conf.base_url.to_string()),
    )?;
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
GET `/api/v0/cms/gutenberg/themes?context=edit&status=active&_locale=user` - Mock themes response
Endpoint for proxying themes requests.
https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/embed/test/index.native.js#L128

# Example

Request:
```http
GET /api/v0/cms/gutenberg/themes?context=edit&status=active&_locale=user HTTP/1.1
Content-Type: application/json

```

Response:
```json
{
    {
        "theme_supports": {
                "responsive-embeds": true
            }
        }
}

```
*/
async fn get_theme_settings(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ThemeResponse>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    let response = ThemeResponse {
        theme_supports: ThemeSupports {
            responsive_embeds: true,
        },
    };
    Ok(web::Json(response))
}

async fn get_mentimeter_oembed_data(
    query_params: web::Query<OEmbedRequest>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<OEmbedResponse>> {
    // let mut conn = pool.acquire().await?;
    // authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    let url = query_params.url.to_string();
    let parsed_url = Url::parse(url.as_str()).unwrap();
    let params: HashMap<_, _> = parsed_url.query_pairs().into_owned().collect();
    let response = OEmbedResponse {
        author_name: "Mooc.fi".to_string(),
        author_url: app_conf.base_url.to_string(),
        html: format!(
            "<iframe src={} style='width: 99%' height={:?} title={:?}> </iframe>",
            url,
            params.get("height").unwrap_or(&"500".to_string()),
            params
                .get("title")
                .unwrap_or(&"Mentimeter embed".to_string())
        ),
        provider_name: "mentimeter".to_string(),
        provider_url: parsed_url
            .host_str()
            .unwrap_or(&"https://www.mentimeter.com")
            .to_string(),
        title: params
            .get("title")
            .unwrap_or(&"Mentimeter embed".to_string())
            .to_string(),
        version: "1.0".to_string(),
    };
    Ok(web::Json(response))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/oembed/preview",
        web::get().to(get_oembed_data_from_provider),
    )
    .route("/themes", web::get().to(get_theme_settings))
    .route(
        "/oembed/mentimeter",
        web::get().to(get_mentimeter_oembed_data),
    );
}
