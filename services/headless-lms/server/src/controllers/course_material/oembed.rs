use crate::prelude::*;

use headless_lms_utils::url_to_oembed_endpoint::{
    OEmbedRequest, OEmbedResponse, mentimeter_oembed_response_builder,
};
use utoipa::{OpenApi, ToSchema};

#[derive(OpenApi)]
#[openapi(paths(get_mentimeter_oembed_data))]
pub(crate) struct CourseMaterialOembedApiDoc;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialOEmbedResponse {
    pub author_name: String,
    pub author_url: String,
    pub html: String,
    pub provider_name: String,
    pub provider_url: String,
    pub title: String,
    pub version: String,
}

impl From<OEmbedResponse> for CourseMaterialOEmbedResponse {
    fn from(value: OEmbedResponse) -> Self {
        Self {
            author_name: value.author_name,
            author_url: value.author_url,
            html: value.html,
            provider_name: value.provider_name,
            provider_url: value.provider_url,
            title: value.title,
            version: value.version,
        }
    }
}

/**
GET `/api/v0/course-material/oembed/mentimeter?url=https://menti.com/123qwerty`
*/
#[utoipa::path(
    get,
    path = "/mentimeter",
    operation_id = "getCourseMaterialMentimeterOembed",
    tag = "course-material-oembed",
    params(
        ("url" = String, Query, description = "Mentimeter URL")
    ),
    responses(
        (
            status = 200,
            description = "Mentimeter oEmbed response",
            body = CourseMaterialOEmbedResponse
        )
    )
)]
async fn get_mentimeter_oembed_data(
    query_params: web::Query<OEmbedRequest>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CourseMaterialOEmbedResponse>> {
    let mut conn = pool.acquire().await?;
    let url = query_params.url.to_string();
    let response = mentimeter_oembed_response_builder(url, app_conf.base_url.to_string())?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(response.into()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/mentimeter", web::get().to(get_mentimeter_oembed_data));
}
