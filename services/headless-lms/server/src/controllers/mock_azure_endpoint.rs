use crate::prelude::*;

// GET /api/v0/idk/test
// POST /api/v0/idk/test
async fn mock_azure_endpoint() -> ControllerResult<String> {
    //let mut conn = pool.acquire().await?;
    let a = r#"
data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","context":{"citations":[],"intent":"[]"}},"end_turn":false,"finish_reason":null}]}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":"!"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" How"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" can"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" I"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" assist"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" you"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":" today"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{"content":"?"},"end_turn":false,"finish_reason":null}],"system_fingerprint":"mock_fingerprint"}

data: {"id":"mock_id","model":"gpt-4o","created":1757592280,"object":"extensions.chat.completion.chunk","choices":[{"index":0,"delta":{},"end_turn":true,"finish_reason":"stop"}],"system_fingerprint":"mock_fingerprint"}

data: [DONE]"#
    .to_string();
    let token = skip_authorize();
    token.authorized_ok(a)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/test", web::get().to(mock_azure_endpoint))
        .route("/test", web::post().to(mock_azure_endpoint));
}
