use headless_lms_chatbot::{
    llm_utils::{APIMessageKind, AzureCompletionRequest},
    message_suggestion::USER_PROMPT,
};

use crate::prelude::*;

const COMPLETION: &str = r#"
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

data: [DONE]"#;

const SUGGESTION: &str = r#"
{"id":"mock_id","model":"gpt-4o","created":1757592280,  "object":"extensions.chat.completion.chunk","choices":[{"index":0,"message":{"role":"assistant","content": "{\"suggestions\":[\"Can you pls help me?\",\"Nice weather we're having.\",\"Hello?\"]}"},"end_turn": true,"finish_reason":"stop"}]}"#;

// GET /api/v0/mock_azure/test/{deployment_name}/chat/completions
// POST /api/v0/mock_azure/test/{deployment_name}/chat/completions
async fn mock_azure_chat_completions(
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<AzureCompletionRequest>,
) -> ControllerResult<String> {
    assert!(app_conf.test_chatbot && app_conf.test_mode);
    let message_suggestion_user_prompt = USER_PROMPT;

    let request = payload;
    let message_kind = &request
        .base
        .messages
        .last()
        .ok_or(ControllerError::new(
            ControllerErrorType::BadRequest,
            "No messages in request, there should be at least one.",
            None,
        ))?
        .fields;
    let message = match message_kind {
        APIMessageKind::Text(m) => Ok(m.content.to_owned()),
        _ => Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "The request had a tool call or tool response. This shouldn't happen when using message suggestion LLM.",
            None,
        )),
    }?;

    let suggest_prompt_match = message
        .matches(message_suggestion_user_prompt)
        .collect::<Vec<&str>>();
    let res = if !suggest_prompt_match.is_empty() {
        SUGGESTION.to_string()
    } else {
        COMPLETION.to_string()
    };
    let token = skip_authorize();
    token.authorized_ok(res)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/test/{deployment_name}/chat/completions",
        web::get().to(mock_azure_chat_completions),
    )
    .route(
        "/test/{deployment_name}/chat/completions",
        web::post().to(mock_azure_chat_completions),
    );
}
