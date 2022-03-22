use crate::controllers::prelude::*;

use headless_lms_utils::url_to_oembed_endpoint::{
    mentimeter_oembed_response_builder, OEmbedRequest, OEmbedResponse,
};

/**
GET `/api/v0/course-material/oembed-edits/mentimeter?url=https://menti.com/123qwerty`
*/
async fn get_mentimeter_oembed_data(
    query_params: web::Query<OEmbedRequest>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<OEmbedResponse>> {
    let url = query_params.url.to_string();
    let response = mentimeter_oembed_response_builder(url, app_conf.base_url.to_string())?;
    Ok(web::Json(response))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/oembed/mentimeter",
        web::get().to(get_mentimeter_oembed_data),
    );
}
