use headless_lms_chatbot::citations::CourseMaterialDocument;

use crate::prelude::*;

const DOCUMENT_3_CHUNK: &str = r#"More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long."#;

/// One document the mock storage serves.
pub(crate) struct MockDocument {
    /// The last path segment of the url the chatbot fetches the document from.
    pub(crate) id: &'static str,
    pub(crate) chunk_id: &'static str,
    pub(crate) title: &'static str,
    pub(crate) chunk: &'static str,
}

/// The whole course material the mock chatbot cites. The mock Azure API builds its search results
/// from these, so every document it points the chatbot at is one this endpoint serves.
pub(crate) static MOCK_DOCUMENTS: [MockDocument; 3] = [
    MockDocument {
        id: "document1",
        chunk_id: "1",
        title: "Cited course page",
        chunk: "Mock test page content\n This is test content blah",
    },
    MockDocument {
        id: "document2",
        chunk_id: "2",
        title: "Cited course page 2",
        chunk: "Mock test page content 2\n This is another test page.",
    },
    MockDocument {
        id: "document3",
        chunk_id: "3",
        title: "Cited course page",
        chunk: DOCUMENT_3_CHUNK,
    },
];

// GET /api/v0/mock_document_storage/test/documents/{document_id}
async fn mock_document_storage(
    app_conf: web::Data<ApplicationConfiguration>,
    document_id: web::Path<String>,
) -> ControllerResult<String> {
    assert!(app_conf.test_chatbot && app_conf.test_mode);
    trace!("In mock document storage");

    let base_url = app_conf.base_url.to_owned();

    let res = match MOCK_DOCUMENTS
        .iter()
        .find(|document| document.id == document_id.as_str())
    {
        Some(document) => serde_json::to_string(&CourseMaterialDocument {
            chunk_id: document.chunk_id.to_string(),
            title: document.title.to_string(),
            url: format!("{base_url}/{}", document.chunk_id),
            filepath: document.id.to_string(),
            chunk: document.chunk.to_string(),
        })?,
        None => "{}".to_string(),
    };

    let token = skip_authorize();
    token.authorized_ok(res)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/test/documents/{document_id}",
        web::get().to(mock_document_storage),
    );
}
