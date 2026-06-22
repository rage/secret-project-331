use headless_lms_utils::services::sisu::{CourseUnitSearchResults, SearchResult};

use crate::prelude::*;

async fn mock_sisu_id_query(
    app_conf: web::Data<ApplicationConfiguration>,
    course_code: web::Path<String>,
) -> ControllerResult<String> {
    let sisu_ids: Vec<SearchResult> = vec![
        SearchResult {
            id: "otm-bf6ac455-c74b-48a9-8079-1e26272d8594".to_string(),
        },
        SearchResult {
            id: "otm-3bd18218-b2f1-443a-89c6-5d6b7b02700e".to_string(),
        },
    ];
    let json = CourseUnitSearchResults {
        search_results: sisu_ids,
    };
    return todo!();
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/kori/api/{code}", web::get().to(mock_sisu_id_query));
}
