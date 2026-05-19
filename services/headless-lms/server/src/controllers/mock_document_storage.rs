use headless_lms_chatbot::citations::CourseMaterialDocument;

use crate::prelude::*;

const DOCUMENT_3: &str = r#"More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long."#;

// GET /api/v0/mock_document_storage/test/documents/{document_id}
async fn mock_document_storage(
    app_conf: web::Data<ApplicationConfiguration>,
    document_id: web::Path<String>,
) -> ControllerResult<String> {
    assert!(app_conf.test_chatbot && app_conf.test_mode);
    trace!("In mock document storage");

    let base_url = app_conf.base_url.to_owned();

    let res = match document_id.as_str() {
        "document1" => serde_json::to_string(
            &(CourseMaterialDocument {
                chunk_id: "1".to_string(),
                title: "Cited course page".to_string(),
                url: base_url,
                filepath: "document1".to_string(),
                chunk: "Mock test page content\n This is test content blah".to_string(),
            }),
        ),
        "document2" => serde_json::to_string(
            &(CourseMaterialDocument {
                chunk_id: "2".to_string(),
                title: "Cited course page 2".to_string(),
                url: base_url,
                filepath: "document2".to_string(),
                chunk: "Mock test page content 2\n This is another test page.".to_string(),
            }),
        ),
        "document3" => serde_json::to_string(
            &(CourseMaterialDocument {
                chunk_id: "3".to_string(),
                title: "Cited course page".to_string(),
                url: base_url,
                filepath: "document3".to_string(),
                chunk: DOCUMENT_3.to_string(),
            }),
        ),
        _ => Ok("{}".to_string()),
    }?;

    let token = skip_authorize();
    token.authorized_ok(res)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/test/documents/{document_id}",
        web::get().to(mock_document_storage),
    );
}
