use crate::prelude::*;

// GET /api/v0/mock_azure/test/{deployment_name}/
// POST /api/v0/mock_azure/test/{deployment_name/
async fn mock_azure(app_conf: web::Data<ApplicationConfiguration>) -> ControllerResult<String> {
    assert!(app_conf.test_chatbot && app_conf.test_mode);
    let a = r#"
data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","context":{"citations":[{"content": "This chunk is a snippet from page {} of the course {}. ,|||,Mock test page content\n This is test content blah.", "title": "Cited course page", "url": "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course/chapter-1", "filepath": "null", "chunk_id": "0"}, {"content": "This chunk is a snippet from page {} of the course {}. ,|||,Mock test page content 2\n This is another test page.", "title": "Cited course page 2", "url": "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course", "filepath": "null", "chunk_id": "0"},{"content": "This chunk is a snippet from page {} of the course {}. ,|||,More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long.", "title": "Cited course page", "url": "http://project-331.local/org/uh-mathstat/courses/advanced-chatbot-course/chapter-1", "filepath": "null", "chunk_id": "0"}],"intent":"[]"}},"end_turn":false,"finish_reason":null}]}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":"!"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" How"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" can"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" I"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" assist"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" [doc1]"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" you"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" [doc2]"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" today"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":"?"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" [doc3]"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{},"end_turn":true,"finish_reason":"stop"}],"system_fingerprint":"mock_fingerprint"}

data: [DONE]"#
    .to_string();
    let token = skip_authorize();
    token.authorized_ok(a)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/test/{deployment_name}/", web::get().to(mock_azure))
        .route("/test/{deployment_name}/", web::post().to(mock_azure));
}
