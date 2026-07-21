use headless_lms_chatbot::{
    azure_chatbot::InputItem, cms_ai_suggestion::USER_PROMPT_PREFIX,
    course_description_summary::USER_PROMPT as DESCRIPTION_USER_PROMPT,
    llm_utils::AzureCompletionRequest, message_suggestion::USER_PROMPT,
};
use regex::Regex;

use crate::prelude::*;

fn get_response(base_url: String) -> Result<String, ControllerError> {
    let url1 = format!("{base_url}/api/v0/mock-document-storage/test/documents/document1");
    let url2 = format!("{base_url}/api/v0/mock-document-storage/test/documents/document2");
    let url3 = format!("{base_url}/api/v0/mock-document-storage/test/documents/document3");

    let re = Regex::new(r"!URLS!")
        .map_err(|e| controller_err!(InternalServerError, "Error in mock azure endpoint: ", e))?;
    let res = re
        .replace_all(
            RESPONSE,
            &format!("\\\"{url1}\\\",\\\"{url2}\\\",\\\"{url3}\\\""),
        )
        .to_string();

    Ok(res)
}

const RESPONSE: &str = r#"
event: response.created
data: {"type": "response.created","response": {"id": "resp_0","object": "response","created_at": 1774260901,"status": "in_progress","background": false,"completed_at": null,"content_filters": null,"error": null,"frequency_penalty": 0.0,"incomplete_details": null,"instructions": null,"max_output_tokens": null,"max_tool_calls": null,"model": "mock-gpt","output": [],"parallel_tool_calls": true,"presence_penalty": 0.0,"previous_response_id": null,"prompt_cache_key": null,"prompt_cache_retention": null,"reasoning": {"effort": "medium","summary": null},"safety_identifier": null,"service_tier": "auto","store": true,"temperature": 1.0,"text": {"format": {"type": "text"},"verbosity": "medium"},"tool_choice": null,"tools": [{"type": "azure_ai_search","azure_ai_search": {"indexes": [{"project_connection_id": "connection-id","index_name": "mock-index","query_type": "semantic","top_k": 5}]}}],"top_logprobs": 0,"top_logprobs": 0,"top_p": 0.85,"truncation": "disabled","usage": null,"user": null,"metadata": {}},"sequence_number": 0}

event: response.in_progress
data: {"type": "response.in_progress","response": {"id": "resp_0","object": "response","created_at": 1774260901,"status": "in_progress","background": false,"completed_at": null,"content_filters": null,"error": null,"frequency_penalty": 0.0,"incomplete_details": null,"instructions": null,"max_output_tokens": null,"max_tool_calls": null,"model": "mock-gpt","output": [],"parallel_tool_calls": true,"presence_penalty": 0.0,"previous_response_id": null,"prompt_cache_key": null,"prompt_cache_retention": null,"reasoning": {"effort": "medium","summary": null},"safety_identifier": null,"service_tier": "auto","store": true,"temperature": 1.0,"text": {"format": {"type": "text"},"verbosity": "medium"},"tool_choice": null,"tools": [{"type": "azure_ai_search","azure_ai_search": {"indexes": [{"project_connection_id": "connection-id","index_name": "mock-index","query_type": "semantic","top_k": 5}]}}],"top_logprobs": 0,"top_logprobs": 0,"top_p": 0.85,"truncation": "disabled","usage": null,"user": null,"metadata": {}},"sequence_number": 1}

event: response.output_item.added
data: {"type": "response.output_item.added","item": {"type": "reasoning","id": "rs_0","response_id": "resp_0","summary": []},"output_index": 0,"sequence_number": 2}

event: response.output_item.done
data: {"type": "response.output_item.done","item": {"type": "reasoning","id": "rs_0","response_id": "resp_0","summary": []},"output_index": 0,"sequence_number": 3}

event: response.output_item.added
data: {"type": "response.output_item.added","item": {"type": "azure_ai_search_call","id": "fc_0","response_id": "resp_0","call_id": "call_0","arguments": "","status": "in_progress"},"output_index": 1,"sequence_number": 4}

event: response.output_item.done
data: {"type": "response.output_item.done","item": {"type": "azure_ai_search_call","id": "fc_0","response_id": "resp_0","call_id": "call_0","arguments": "{\"query\":\"tell me more\"}","status": "completed"},"output_index": 1,"sequence_number": 5}

event: response.output_item.added
data: {"type": "response.output_item.added","item": {"type": "azure_ai_search_call_output","id": "fco_0","response_id": "resp_0","call_id": "call_0","output": "[]","status": "in_progress"},"output_index": 2,"sequence_number": 6}

event: response.output_item.done
data: {"type": "response.output_item.done","item": {"type": "azure_ai_search_call_output","id": "fco_0","response_id": "resp_0","call_id": "call_0","output": "{\"documents\": [{\"id\": \"doc1\", \"content\": \"This chunk is a snippet from page {} of the course {}. Mock test page content This is test content blah\", \"filepath\": \"document1\", \"title\": \"Cited course page\", \"url\": \"\",\"score\": 0.016666668, \"knowledgeSourceIndex\": 0},{\"id\": \"doc2\",\"content\": \"Mock test page content 2 This is another test page.\",\"filepath\": \"document2\",\"title\": \"Cited course page 2\",\"url\": \"\",\"score\": 0.016666668,\"knowledgeSourceIndex\": 0},{\"id\": \"doc3\",\"content\": \"More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long.\",\"filepath\": \"document1\",\"title\": \"Cited course page\",\"url\": \"\",\"score\": 0.016666668,\"knowledgeSourceIndex\": 0}],\"get_urls\": [!URLS!]}","status": "completed"},"output_index": 2,"sequence_number": 7}

event: response.output_item.added
data: {"type": "response.output_item.added","item": {"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [],"status": "in_progress"},"output_index": 3,"sequence_number": 8}

event: response.content_part.added
data: {"type": "response.content_part.added","content_index": 0,"item_id": "msg_0","output_index": 3,"part": {"type": "output_text","annotations": [],"logprobs": [],"text": ""},"sequence_number": 9}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": "Hello","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 10}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": "!","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 11}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " How","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 12}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " can","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 13}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " I","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 14}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " assist","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 15}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " 【0:3†source】","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 16}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " you","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 17}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " 【0:2†source】","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 18}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " today","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 19}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": "?","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 20}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": "【0:3†source】","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 21}

event: response.output_text.done
data: {"type": "response.output_text.done","content_index": 0,"item_id": "msg_0","logprobs": [],"output_index": 3,"sequence_number": 22,"text": "Hello! How can I assist 【0:3†source】 you 【0:2†source】 today? 【0:3†source】"}

event: response.content_part.done
data: {"type": "response.content_part.done","content_index": 0,"item_id": "msg_0","output_index": 3,"part": {"type": "output_text","annotations": [],"logprobs": [],"text": "Hello! How can I assist 【0:3†source】 you 【0:2†source】 today? 【0:3†source】"},"sequence_number": 23}

event: response.output_item.done
data: {"type": "response.output_item.done","item": {"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{"type": "output_text","text": "Hello! How can I assist 【0:3†source】 you 【0:2†source】 today? 【0:3†source】","annotations": [],"logprobs": []}],"status": "completed"},"output_index": 3,"sequence_number": 24}

event: response.completed
data: {"type": "response.completed","response": {"id": "resp_0","object": "response","created_at": 1774422684,"status": "completed","background": false,"completed_at": 1774422685,"content_filters": [{"blocked": false,"source_type": "prompt","content_filter_raw": [],"content_filter_results": {"jailbreak": {"filtered": false,"detected": false},"self_harm": {"filtered": false,"severity": "safe"},"hate": {"filtered": false,"severity": "safe"},"violence": {"filtered": false,"severity": "safe"},"sexual": {"filtered": false,"severity": "safe"}},"content_filter_offsets": {"start_offset": 918,"end_offset": 930,"check_offset": 0}}],"error": null,"frequency_penalty": 0.0,"incomplete_details": null,"instructions": null,"max_output_tokens": null,"max_tool_calls": null,"model": "gpt-5.4-nano","output": [{"type": "reasoning","id": "rs_0","response_id": "resp_0","summary": []},{"type": "azure_ai_search_call","id": "fc_0","response_id": "resp_0","call_id": "call_0","arguments": "{\"query\":\"tell me more\"}","status": "completed"},{"type": "azure_ai_search_call_output","id": "fco_0","response_id": "resp_0","call_id": "call_0","output": "{\"documents\":[{\"id\": \"doc1\",\"content\": \"This chunk is a snippet from page {} of the course {}. ,|||,Mock test page content\n This is test content blah\",\"filepath\": \"document1\",\"title\": \"Cited course page\",\"url\": \"\",\"score\": 0.016666668,\"knowledgeSourceIndex\": 0},{\"id\": \"doc2\",\"content\": \"Mock test page content 2\n This is another test page.\",\"filepath\": \"document2\",\"title\": \"Cited course page 2\",\"url\": \"\",\"score\": 0.016666668,\"knowledgeSourceIndex\": 0},{\"id\": \"doc3\",\"content\": \"More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long.\",\"filepath\": \"document1\",\"title\": \"Cited course page\",\"url\": \"\",\"score\": 0.016666668,\"knowledgeSourceIndex\": 0},],\"get_urls\":[!URLS!]}","status": "completed"},{"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{"type": "output_text","text": "Hello! How can I assist 【0:3†source】 you 【0:2†source】 today? 【0:3†source】","annotations": [],"logprobs": []}],"status": "completed"}],"parallel_tool_calls": true,"presence_penalty": 0.0,"previous_response_id": null,"prompt_cache_key": null,"prompt_cache_retention": null,"reasoning": {"effort": "high","summary": null},"safety_identifier": null,"service_tier": "auto","store": true,"temperature": 1.0,"text": {"format": {"type": "text"},"verbosity": "medium"},"tool_choice": "required","tools": [{"type": "azure_ai_search","azure_ai_search": {"indexes": [{"project_connection_id": "connection-id","index_name": "mock-index","query_type": "semantic","top_k": 5}]}}],"top_logprobs": 0,"top_logprobs": 0,"top_p": 0.85,"truncation": "disabled","usage": {"input_tokens": 38,"input_tokens_details": {"cached_tokens": 0},"output_tokens": 79,"output_tokens_details": {"reasoning_tokens": 64},"total_tokens": 117},"user": null,"metadata": {}},"sequence_number": 25}
"#;

const SUGGESTION: &str = r#"{"metadata": {},"top_logprobs": 0,"temperature": 1,"top_p": 0.98,"service_tier": "default","model": "mock-gpt","reasoning": {"effort": "medium","summary": "detailed"},"background": false,"text": {"format": {"type": "text"},"verbosity": "medium"},"tools": [],"tool_choice": "auto","truncation": "disabled","id": "resp_0","object": "response","status": "completed","created_at": 1776144780,"completed_at": 1776144781,"error": null,"incomplete_details": null,"output": [{"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{"type": "output_text","text": "{\"suggestions\":[\"Can you pls help me?\",\"Nice weather we're having.\",\"Hello?\"]}","annotations": [],"logprobs": []}],"status": "completed"}],"instructions": null,"usage": {"input_tokens": 30,"input_tokens_details": {"cached_tokens": 0},"output_tokens": 15,"output_tokens_details": {"reasoning_tokens": 0},"total_tokens": 45},"parallel_tool_calls": true,"agent_reference": null}
"#;

const CMS_SUGGESTION: &str = r#"{"metadata": {},"top_logprobs": 0,"temperature": 1,"top_p": 0.98,"service_tier": "default","model": "mock-gpt","reasoning": {"effort": "medium","summary": "detailed"},"background": false,"text": {"format": {"type": "text"},"verbosity": "medium"},"tools": [],"tool_choice": "auto","truncation": "disabled","id": "resp_0","object": "response","status": "completed","created_at": 1776144780,"completed_at": 1776144781,"error": null,"incomplete_details": null,"output": [{"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{"type": "output_text","text": "{\"suggestions\":[\"Mock suggestion 1: The paragraph has been improved.\",\"Mock suggestion 2: Here is an alternative version of the paragraph.\",\"Mock suggestion 3: A third distinct rewrite of the paragraph.\"]}","annotations": [],"logprobs": []}],"status": "completed"}],"instructions": null,"usage": {"input_tokens": 30,"input_tokens_details": {"cached_tokens": 0},"output_tokens": 15,"output_tokens_details": {"reasoning_tokens": 0},"total_tokens": 45},"parallel_tool_calls": true,"agent_reference": null}"#;

const DESCRIPTION_SUGGESTION: &str = r#"{"metadata": {},"top_logprobs": 0,"temperature": 1,"top_p": 0.98,"service_tier": "default","model": "mock-gpt","reasoning": {"effort": "medium","summary": "detailed"},"background": false,"text": {"format": {"type": "text"},"verbosity": "medium"},"tools": [],"tool_choice": "auto","truncation": "disabled","id": "resp_0","object": "response","status": "completed","created_at": 1776144780,"completed_at": 1776144781,"error": null,"incomplete_details": null,"output": [{"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{ "text": "{\"modules\":[{\"description\":\"Introductory course to containers and containerization with Docker. Introduces containerization with Docker and relevant concepts such as image and volume. After completion, students are able to run containerized applications, containerize applications, utilize volumes to store data persistently outside containers, use port mapping to enable access via TCP to containerized applications, and share their own containers publicly. No hard prerequisites; Linux operating systems and web development experience are useful.\",\"prerequisites\":[\"No hard prerequisites\",\"Linux operating systems and web development experience are useful\"],\"course_code\":\"TKT21036\"}],\"audience\":[\"everyone\"],\"course_description\":\"Introductory course to containers and containerization with Docker. Introduces containerization with Docker and relevant concepts such as image and volume. After completion, students are able to run containerized applications, containerize applications, utilize volumes to store data persistently outside containers, use port mapping to enable access via TCP to containerized applications, and share their own containers publicly.\"}"}],"annotations": [],"logprobs": []}],"instructions": null,"usage": {"input_tokens": 30,"input_tokens_details": {"cached_tokens": 0},"output_tokens": 15,"output_tokens_details": {"reasoning_tokens": 0},"total_tokens": 45},"parallel_tool_calls": true,"agent_reference": null}"#;

// GET /api/v0/mock_azure/test/v1/responses
// POST /api/v0/mock_azure/test/v1/responses
async fn mock_azure_chat_responses(
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<AzureCompletionRequest>,
) -> ControllerResult<String> {
    assert!(app_conf.test_chatbot && app_conf.test_mode);
    let message_suggestion_user_prompt = USER_PROMPT;

    let message_kind = &payload
        .base
        .input
        .last()
        .ok_or(ControllerError::new(
            ControllerErrorType::BadRequest,
            "No messages in request, there should be at least one.",
            None,
        ))?
        .message_type;
    let message = match message_kind {
        InputItem::Message {
            role: _role,
            content,
        } => Ok(content.to_owned()),
        _ => Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "The request had a tool call or tool response. This shouldn't happen when using message suggestion LLM.",
            None,
        )),
    }?.get_content_text();

    let suggest_prompt_match = message
        .matches(message_suggestion_user_prompt)
        .collect::<Vec<&str>>();
    let cms_suggest_match = message.contains(USER_PROMPT_PREFIX);
    let description_suggestion_match = message.contains(DESCRIPTION_USER_PROMPT);
    let res = if !suggest_prompt_match.is_empty() {
        SUGGESTION.to_string()
    } else if cms_suggest_match {
        CMS_SUGGESTION.to_string()
    } else if description_suggestion_match {
        DESCRIPTION_SUGGESTION.to_string()
    } else {
        get_response(app_conf.base_url.clone())?
    };
    let token = skip_authorize();
    token.authorized_ok(res)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/test/v1/responses",
        web::get().to(mock_azure_chat_responses),
    )
    .route(
        "/test/v1/responses",
        web::post().to(mock_azure_chat_responses),
    );
}
