use crate::prelude::*;
use headless_lms_chatbot::{
    azure_chatbot::InputItem,
    chatbot_tools::{
        ChatbotToolDeclaration,
        client_tools::ask_multiple_choice_question::AskMultipleChoiceQuestionTool,
        custom_tools::course_structure::CourseStructureTool,
    },
    cms_ai_suggestion::USER_PROMPT_PREFIX,
    course_description_summary::USER_PROMPT as DESCRIPTION_USER_PROMPT,
    llm_utils::AzureCompletionRequest,
    message_suggestion::USER_PROMPT,
};
use headless_lms_utils::azure_embedding::{
    Embedding, EmbeddingRequest, EmbeddingResponse, EmbeddingResponseUsage,
};
use serde_json::{Value, json};

/// Anywhere in a chat message, this makes the mock answer with a function call instead of a
/// text answer, which is how a test drives the chatbot's tool loop. The chatbot then runs the
/// tool and asks again with the tool output as the last input item, and the mock answers that
/// with a text round, completing a two-round turn.
const TOOL_CALL_TRIGGER: &str = "!MOCK_TOOL_CALL!";

/// Like [TOOL_CALL_TRIGGER], but the call is one only the client can answer, so the chatbot
/// suspends the turn instead of running anything. The turn is finished by the tool-response
/// endpoint, whose request ends in the tool output and so gets the same text round.
const CLIENT_TOOL_CALL_TRIGGER: &str = "!MOCK_CLIENT_TOOL_CALL!";

/// GET /api/v0/mock-azure/api/projects/test/openai/v1/responses
/// POST /api/v0/mock-azure/api/projects/test/openai/v1/responses
///
/// Stands in for the Azure Responses API while the chatbot runs in test mode. Dispatches on the
/// shape of the request:
///
/// - last input item is a function call output: the text answer that follows a tool run,
/// - message containing the message suggestion, CMS suggestion or course description prompt:
///   that feature's canned structured output,
/// - message containing [`TOOL_CALL_TRIGGER`] or [`CLIENT_TOOL_CALL_TRIGGER`]: a function call
///   round, for a server-run tool or for a client-answered one,
/// - any other message: the default Azure AI Search and text answer.
async fn mock_azure_chat_responses(
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<AzureCompletionRequest>,
) -> ControllerResult<String> {
    assert!(app_conf.test_chatbot && app_conf.test_mode);

    let last_input_item = &payload
        .base
        .input
        .last()
        .ok_or_else(|| {
            controller_err!(
                BadRequest,
                "No messages in request, there should be at least one."
            )
        })?
        .message_type;

    let res = match last_input_item {
        InputItem::Message { content, .. } => {
            chat_message_response(&content.clone().get_content_text(), &app_conf.base_url)
        }
        InputItem::FunctionCallOutput { .. } => tool_answer_round(),
        InputItem::FunctionCall { .. } | InputItem::Reasoning { .. } => {
            return Err(controller_err!(
                BadRequest,
                "The mock has no response for a request that ends in a function call or a reasoning item."
            ));
        }
    };

    let token = skip_authorize();
    token.authorized_ok(res)
}

/// Picks the response for a chat message. The structured output prompts are matched first so
/// that the features using them keep working regardless of what the message contains.
fn chat_message_response(message: &str, base_url: &str) -> String {
    if message.contains(USER_PROMPT) {
        SUGGESTION.to_string()
    } else if message.contains(USER_PROMPT_PREFIX) {
        CMS_SUGGESTION.to_string()
    } else if message.contains(DESCRIPTION_USER_PROMPT) {
        DESCRIPTION_SUGGESTION.to_string()
    } else if message.contains(CLIENT_TOOL_CALL_TRIGGER) {
        function_call_round(
            <AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::NAME,
            MOCK_MULTIPLE_CHOICE_ARGUMENTS,
        )
    } else if message.contains(TOOL_CALL_TRIGGER) {
        function_call_round(<CourseStructureTool as ChatbotToolDeclaration>::NAME, "{}")
    } else {
        search_and_text_response(base_url)
    }
}

/// The default chat answer: an Azure AI Search call, its results, and a cited text answer.
fn search_and_text_response(base_url: &str) -> String {
    let urls = [1, 2, 3]
        .map(|n| {
            format!("\\\"{base_url}/api/v0/mock-document-storage/test/documents/document{n}\\\"")
        })
        .join(",");
    RESPONSE.replace("!URLS!", &urls)
}

/// Renders `events` as a Server-Sent Events body in the order given. The chatbot reads the
/// `event:` line to decide what the `data:` line after it means, so the pairing and the order
/// are what make a round parse as a tool call or as text.
fn sse_body(events: Vec<(&str, Value)>) -> String {
    events
        .into_iter()
        .map(|(event, data)| format!("event: {event}\ndata: {data}\n\n"))
        .collect()
}

/// The response object of a lifecycle event before the last one. Only `id` and a possible `error`
/// are read by the chatbot; Azure sends the full request parameters here as well. See
/// [`completed_response_object`] for the terminal event.
fn response_object(response_id: &str, status: &str) -> Value {
    json!({
        "id": response_id,
        "object": "response",
        "status": status,
        "usage": null,
    })
}

/// The response object of the `response.completed` event, the only lifecycle event Azure reports
/// token usage and the reasoning context on.
fn completed_response_object(response_id: &str, usage: Value) -> Value {
    json!({
        "id": response_id,
        "object": "response",
        "status": "completed",
        "reasoning": {"effort": "medium", "summary": null, "context": "current_turn"},
        "usage": usage,
    })
}

/// The question [CLIENT_TOOL_CALL_TRIGGER] makes the mock ask. Has to pass the tool's own
/// argument validation, which the chatbot runs before it suspends the turn.
const MOCK_MULTIPLE_CHOICE_ARGUMENTS: &str =
    r#"{"question":"Which loop do you mean?","choices":["while","for"]}"#;

/// A round in which the model calls `tool_name` with `arguments`.
///
/// Every tool it is used with works without a user, so the round works for an anonymous course
/// material visitor.
///
/// The chatbot picks its parser from the first delta event and passes the tool parser only what
/// follows it, so the completed function call has to arrive in a later `output_item.done`, and
/// the round must contain no text delta at all.
fn function_call_round(tool_name: &str, arguments: &str) -> String {
    let response_id = format!("resp_{}", Uuid::new_v4());
    let item_id = format!("fc_{}", Uuid::new_v4());
    let call_id = format!("call_{}", Uuid::new_v4());

    let function_call = |arguments: &str, status: &str| {
        json!({
            "type": "function_call",
            "id": item_id,
            "response_id": response_id,
            "call_id": call_id,
            "name": tool_name,
            "arguments": arguments,
            "status": status,
        })
    };
    let reasoning = json!({
        "type": "reasoning",
        "id": format!("rs_{}", Uuid::new_v4()),
        "response_id": response_id,
        "summary": [],
        // Azure returns this whenever `store` is false, and the chatbot only replays a reasoning
        // item that has it, so without it the mock never exercises the replay path.
        "encrypted_content": "mock-encrypted-reasoning",
    });

    sse_body(vec![
        (
            "response.created",
            json!({
                "type": "response.created",
                "response": response_object(&response_id, "in_progress"),
            }),
        ),
        (
            "response.output_item.added",
            json!({
                "type": "response.output_item.added",
                "output_index": 0,
                "item": reasoning,
            }),
        ),
        (
            "response.output_item.done",
            json!({
                "type": "response.output_item.done",
                "output_index": 0,
                "item": reasoning,
            }),
        ),
        (
            "response.output_item.added",
            json!({
                "type": "response.output_item.added",
                "output_index": 1,
                "item": function_call("", "in_progress"),
            }),
        ),
        (
            "response.function_call_arguments.delta",
            json!({
                "type": "response.function_call_arguments.delta",
                "item_id": item_id,
                "output_index": 1,
                "delta": arguments,
            }),
        ),
        (
            "response.function_call_arguments.done",
            json!({
                "type": "response.function_call_arguments.done",
                "item_id": item_id,
                "output_index": 1,
                "arguments": arguments,
            }),
        ),
        (
            "response.output_item.done",
            json!({
                "type": "response.output_item.done",
                "output_index": 1,
                "item": function_call(arguments, "completed"),
            }),
        ),
        (
            "response.completed",
            json!({
                "type": "response.completed",
                "response": completed_response_object(
                    &response_id,
                    json!({
                        "input_tokens": 42,
                        "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 42},
                        "output_tokens": 88,
                        "output_tokens_details": {"reasoning_tokens": 64},
                        "total_tokens": 130,
                    }),
                ),
            }),
        ),
    ])
}

/// The text answer the model gives once a tool has run.
fn tool_answer_round() -> String {
    let response_id = format!("resp_{}", Uuid::new_v4());
    let item_id = format!("msg_{}", Uuid::new_v4());
    let deltas = [
        "Here", " is", " the", " mock", " answer", " after", " a", " tool", " ran.",
    ];
    let text = deltas.concat();

    let message = |content: Value, status: &str| {
        json!({
            "type": "message",
            "id": item_id,
            "response_id": response_id,
            "phase": "final_answer",
            "role": "assistant",
            "content": content,
            "status": status,
        })
    };

    let mut events = vec![
        (
            "response.created",
            json!({
                "type": "response.created",
                "response": response_object(&response_id, "in_progress"),
            }),
        ),
        (
            "response.output_item.added",
            json!({
                "type": "response.output_item.added",
                "output_index": 0,
                "item": message(json!([]), "in_progress"),
            }),
        ),
        (
            "response.content_part.added",
            json!({
                "type": "response.content_part.added",
                "content_index": 0,
                "item_id": item_id,
                "output_index": 0,
                "part": { "type": "output_text", "text": "" },
            }),
        ),
    ];
    events.extend(deltas.iter().map(|delta| {
        (
            "response.output_text.delta",
            json!({
                "type": "response.output_text.delta",
                "content_index": 0,
                "item_id": item_id,
                "output_index": 0,
                "delta": delta,
            }),
        )
    }));
    events.extend([
        (
            "response.output_text.done",
            json!({
                "type": "response.output_text.done",
                "content_index": 0,
                "item_id": item_id,
                "output_index": 0,
                "text": text,
            }),
        ),
        (
            "response.output_item.done",
            json!({
                "type": "response.output_item.done",
                "output_index": 0,
                "item": message(json!([{ "type": "output_text", "text": text }]), "completed"),
            }),
        ),
        (
            "response.completed",
            json!({
                "type": "response.completed",
                "response": completed_response_object(
                    &response_id,
                    // Second round of the same turn, so what the first round wrote to the cache
                    // comes back as a cache read here.
                    json!({
                        "input_tokens": 96,
                        "input_tokens_details": {"cached_tokens": 42, "cache_write_tokens": 54},
                        "output_tokens": 24,
                        "output_tokens_details": {"reasoning_tokens": 8},
                        "total_tokens": 120,
                    }),
                ),
            }),
        ),
    ]);

    sse_body(events)
}

const RESPONSE: &str = r#"
event: response.created
data: {"type": "response.created","response": {"id": "resp_0","object": "response","created_at": 1774260901,"status": "in_progress","background": false,"completed_at": null,"content_filters": null,"error": null,"frequency_penalty": 0.0,"incomplete_details": null,"instructions": null,"max_output_tokens": null,"max_tool_calls": null,"model": "mock-gpt","output": [],"parallel_tool_calls": true,"presence_penalty": 0.0,"previous_response_id": null,"prompt_cache_key": null,"prompt_cache_retention": null,"reasoning": {"effort": "medium","summary": null,"context": "current_turn"},"safety_identifier": null,"service_tier": "auto","store": true,"temperature": 1.0,"text": {"format": {"type": "text"},"verbosity": "medium"},"tool_choice": null,"tools": [{"type": "azure_ai_search","azure_ai_search": {"indexes": [{"project_connection_id": "connection-id","index_name": "mock-index","query_type": "semantic","top_k": 5}]}}],"top_logprobs": 0,"top_logprobs": 0,"top_p": 0.85,"truncation": "disabled","usage": null,"user": null,"metadata": {}},"sequence_number": 0}

event: response.in_progress
data: {"type": "response.in_progress","response": {"id": "resp_0","object": "response","created_at": 1774260901,"status": "in_progress","background": false,"completed_at": null,"content_filters": null,"error": null,"frequency_penalty": 0.0,"incomplete_details": null,"instructions": null,"max_output_tokens": null,"max_tool_calls": null,"model": "mock-gpt","output": [],"parallel_tool_calls": true,"presence_penalty": 0.0,"previous_response_id": null,"prompt_cache_key": null,"prompt_cache_retention": null,"reasoning": {"effort": "medium","summary": null,"context": "current_turn"},"safety_identifier": null,"service_tier": "auto","store": true,"temperature": 1.0,"text": {"format": {"type": "text"},"verbosity": "medium"},"tool_choice": null,"tools": [{"type": "azure_ai_search","azure_ai_search": {"indexes": [{"project_connection_id": "connection-id","index_name": "mock-index","query_type": "semantic","top_k": 5}]}}],"top_logprobs": 0,"top_logprobs": 0,"top_p": 0.85,"truncation": "disabled","usage": null,"user": null,"metadata": {}},"sequence_number": 1}

event: response.output_item.added
data: {"type": "response.output_item.added","item": {"type": "reasoning","id": "rs_0","response_id": "resp_0","summary": [],"encrypted_content": "mock-encrypted-reasoning"},"output_index": 0,"sequence_number": 2}

event: response.output_item.done
data: {"type": "response.output_item.done","item": {"type": "reasoning","id": "rs_0","response_id": "resp_0","summary": [],"encrypted_content": "mock-encrypted-reasoning"},"output_index": 0,"sequence_number": 3}

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
data: {"type": "response.output_text.delta","content_index": 0,"delta": " 【0:2†source】","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 16}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " you","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 17}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " 【0:1†source】","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 18}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": " today","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 19}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": "?","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 20}

event: response.output_text.delta
data: {"type": "response.output_text.delta","content_index": 0,"delta": "【0:2†source】","item_id": "msg_0","logprobs": [],"obfuscation": "","output_index": 3,"sequence_number": 21}

event: response.output_text.done
data: {"type": "response.output_text.done","content_index": 0,"item_id": "msg_0","logprobs": [],"output_index": 3,"sequence_number": 22,"text": "Hello! How can I assist 【0:2†source】 you 【0:1†source】 today? 【0:2†source】"}

event: response.content_part.done
data: {"type": "response.content_part.done","content_index": 0,"item_id": "msg_0","output_index": 3,"part": {"type": "output_text","annotations": [],"logprobs": [],"text": "Hello! How can I assist 【0:2†source】 you 【0:1†source】 today? 【0:2†source】"},"sequence_number": 23}

event: response.output_item.done
data: {"type": "response.output_item.done","item": {"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{"type": "output_text","text": "Hello! How can I assist 【0:2†source】 you 【0:1†source】 today? 【0:2†source】","annotations": [],"logprobs": []}],"status": "completed"},"output_index": 3,"sequence_number": 24}

event: response.completed
data: {"type": "response.completed","response": {"id": "resp_0","object": "response","created_at": 1774422684,"status": "completed","background": false,"completed_at": 1774422685,"content_filters": [{"blocked": false,"source_type": "prompt","content_filter_raw": [],"content_filter_results": {"jailbreak": {"filtered": false,"detected": false},"self_harm": {"filtered": false,"severity": "safe"},"hate": {"filtered": false,"severity": "safe"},"violence": {"filtered": false,"severity": "safe"},"sexual": {"filtered": false,"severity": "safe"}},"content_filter_offsets": {"start_offset": 918,"end_offset": 930,"check_offset": 0}}],"error": null,"frequency_penalty": 0.0,"incomplete_details": null,"instructions": null,"max_output_tokens": null,"max_tool_calls": null,"model": "gpt-5.4-nano","output": [{"type": "reasoning","id": "rs_0","response_id": "resp_0","summary": [],"encrypted_content": "mock-encrypted-reasoning"},{"type": "azure_ai_search_call","id": "fc_0","response_id": "resp_0","call_id": "call_0","arguments": "{\"query\":\"tell me more\"}","status": "completed"},{"type": "azure_ai_search_call_output","id": "fco_0","response_id": "resp_0","call_id": "call_0","output": "{\"documents\":[{\"id\": \"doc1\",\"content\": \"This chunk is a snippet from page {} of the course {}. ,|||,Mock test page content\n This is test content blah\",\"filepath\": \"document1\",\"title\": \"Cited course page\",\"url\": \"\",\"score\": 0.016666668,\"knowledgeSourceIndex\": 0},{\"id\": \"doc2\",\"content\": \"Mock test page content 2\n This is another test page.\",\"filepath\": \"document2\",\"title\": \"Cited course page 2\",\"url\": \"\",\"score\": 0.016666668,\"knowledgeSourceIndex\": 0},{\"id\": \"doc3\",\"content\": \"More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long. More content on the same mock course page. Another snippet. Long.\",\"filepath\": \"document1\",\"title\": \"Cited course page\",\"url\": \"\",\"score\": 0.016666668,\"knowledgeSourceIndex\": 0},],\"get_urls\":[!URLS!]}","status": "completed"},{"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{"type": "output_text","text": "Hello! How can I assist 【0:2†source】 you 【0:1†source】 today? 【0:2†source】","annotations": [],"logprobs": []}],"status": "completed"}],"parallel_tool_calls": true,"presence_penalty": 0.0,"previous_response_id": null,"prompt_cache_key": null,"prompt_cache_retention": null,"reasoning": {"effort": "high","summary": null,"context": "current_turn"},"safety_identifier": null,"service_tier": "auto","store": true,"temperature": 1.0,"text": {"format": {"type": "text"},"verbosity": "medium"},"tool_choice": "required","tools": [{"type": "azure_ai_search","azure_ai_search": {"indexes": [{"project_connection_id": "connection-id","index_name": "mock-index","query_type": "semantic","top_k": 5}]}}],"top_logprobs": 0,"top_logprobs": 0,"top_p": 0.85,"truncation": "disabled","usage": {"input_tokens": 38,"input_tokens_details": {"cached_tokens": 0,"cache_write_tokens": 38},"output_tokens": 79,"output_tokens_details": {"reasoning_tokens": 64},"total_tokens": 117},"user": null,"metadata": {}},"sequence_number": 25}
"#;

const SUGGESTION: &str = r#"{"metadata": {},"top_logprobs": 0,"temperature": 1,"top_p": 0.98,"service_tier": "default","model": "mock-gpt","reasoning": {"effort": "medium","summary": "detailed","context": "current_turn"},"background": false,"text": {"format": {"type": "text"},"verbosity": "medium"},"tools": [],"tool_choice": "auto","truncation": "disabled","id": "resp_0","object": "response","status": "completed","created_at": 1776144780,"completed_at": 1776144781,"error": null,"incomplete_details": null,"output": [{"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{"type": "output_text","text": "{\"suggestions\":[\"Can you pls help me?\",\"Nice weather we're having.\",\"Hello?\"]}","annotations": [],"logprobs": []}],"status": "completed"}],"instructions": null,"usage": {"input_tokens": 30,"input_tokens_details": {"cached_tokens": 0,"cache_write_tokens": 30},"output_tokens": 15,"output_tokens_details": {"reasoning_tokens": 0},"total_tokens": 45},"parallel_tool_calls": true,"agent_reference": null}
"#;

const CMS_SUGGESTION: &str = r#"{"metadata": {},"top_logprobs": 0,"temperature": 1,"top_p": 0.98,"service_tier": "default","model": "mock-gpt","reasoning": {"effort": "medium","summary": "detailed","context": "current_turn"},"background": false,"text": {"format": {"type": "text"},"verbosity": "medium"},"tools": [],"tool_choice": "auto","truncation": "disabled","id": "resp_0","object": "response","status": "completed","created_at": 1776144780,"completed_at": 1776144781,"error": null,"incomplete_details": null,"output": [{"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{"type": "output_text","text": "{\"suggestions\":[\"Mock suggestion 1: The paragraph has been improved.\",\"Mock suggestion 2: Here is an alternative version of the paragraph.\",\"Mock suggestion 3: A third distinct rewrite of the paragraph.\"]}","annotations": [],"logprobs": []}],"status": "completed"}],"instructions": null,"usage": {"input_tokens": 30,"input_tokens_details": {"cached_tokens": 0,"cache_write_tokens": 30},"output_tokens": 15,"output_tokens_details": {"reasoning_tokens": 0},"total_tokens": 45},"parallel_tool_calls": true,"agent_reference": null}"#;

const DESCRIPTION_SUGGESTION: &str = r#"{"metadata": {},"top_logprobs": 0,"temperature": 1,"top_p": 0.98,"service_tier": "default","model": "mock-gpt","reasoning": {"effort": "medium","summary": "detailed","context": "current_turn"},"background": false,"text": {"format": {"type": "text"},"verbosity": "medium"},"tools": [],"tool_choice": "auto","truncation": "disabled","id": "resp_0","object": "response","status": "completed","created_at": 1776144780,"completed_at": 1776144781,"error": null,"incomplete_details": null,"output": [{"type": "message","id": "msg_0","response_id": "resp_0","phase": "final_answer","role": "assistant","content": [{ "text": "{\"modules\":[{\"description\":\"Introductory course to containers and containerization with Docker. Introduces containerization with Docker and relevant concepts such as image and volume. After completion, students are able to run containerized applications, containerize applications, utilize volumes to store data persistently outside containers, use port mapping to enable access via TCP to containerized applications, and share their own containers publicly. No hard prerequisites; Linux operating systems and web development experience are useful.\",\"prerequisites\":[\"No hard prerequisites\",\"Linux operating systems and web development experience are useful\"],\"course_code\":\"TKT21036\"}],\"audience\":[\"everyone\"],\"course_description\":\"Introductory course to containers and containerization with Docker. Introduces containerization with Docker and relevant concepts such as image and volume. After completion, students are able to run containerized applications, containerize applications, utilize volumes to store data persistently outside containers, use port mapping to enable access via TCP to containerized applications, and share their own containers publicly.\"}"}],"annotations": [],"logprobs": []}],"instructions": null,"usage": {"input_tokens": 30,"input_tokens_details": {"cached_tokens": 0,"cache_write_tokens": 30},"output_tokens": 15,"output_tokens_details": {"reasoning_tokens": 0},"total_tokens": 45},"parallel_tool_calls": true,"agent_reference": null}"#;

// GET /api/v0/mock_azure/openai/v1/embeddings
// POST /api/v0/mock_azure/openai/v1/embeddings
async fn mock_azure_embeddings(
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<EmbeddingRequest>,
) -> ControllerResult<String> {
    assert!(app_conf.test_chatbot && app_conf.test_mode);

    let mock_response = EmbeddingResponse {
        object: "list".to_string(),
        model: "mock-embedder-3-small".to_string(),
        usage: EmbeddingResponseUsage {
            prompt_tokens: payload.input.len() as i32,
            total_tokens: payload.input.len() as i32,
        },
        data: payload
            .input
            .iter()
            .enumerate()
            .map(|(index, _)| Embedding {
                index: index as i32,
                embedding: vec![0.0; 1536],
                object: "embedding".to_string(),
            })
            .collect(),
    };
    let res = serde_json::to_string(&mock_response)?;
    let token = skip_authorize();
    token.authorized_ok(res)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/api/projects/test/openai/v1/responses",
        web::get().to(mock_azure_chat_responses),
    )
    .route(
        "/api/projects/test/openai/v1/responses",
        web::post().to(mock_azure_chat_responses),
    )
    .route("openai/v1/embeddings", web::get().to(mock_azure_embeddings))
    .route(
        "openai/v1/embeddings",
        web::post().to(mock_azure_embeddings),
    );
}

#[cfg(test)]
mod tests {
    use headless_lms_chatbot::{
        azure_chatbot::{AISearchOutput, OutputItem, ResponseOutput},
        chatbot_tools::{
            AzureLLMToolDefinition, ClientChatbotTool, get_chatbot_tool_definitions,
            tool_is_answered_by_client,
        },
        llm_utils::{LLMResponse, parse_text_completion},
    };

    use super::*;

    const BASE_URL: &str = "http://project-331.local";

    /// Pairs every `event:` line of a Server-Sent Events body with the `data:` line after it.
    fn sse_events(body: &str) -> Vec<(&str, &str)> {
        let mut events = Vec::new();
        let mut pending = None;
        for line in body.lines() {
            if let Some(event) = line.strip_prefix("event: ") {
                pending = Some(event);
            } else if let Some(data) = line.strip_prefix("data: ")
                && let Some(event) = pending.take()
            {
                events.push((event, data));
            }
        }
        events
    }

    /// Every streamed body the mock can return, named for failure messages.
    fn streamed_bodies() -> Vec<(&'static str, String)> {
        vec![
            (
                "the default chat answer",
                chat_message_response("Tell me more", BASE_URL),
            ),
            (
                "the function call round",
                chat_message_response(TOOL_CALL_TRIGGER, BASE_URL),
            ),
            (
                "the client tool call round",
                chat_message_response(CLIENT_TOOL_CALL_TRIGGER, BASE_URL),
            ),
            ("the answer after a tool ran", tool_answer_round()),
        ]
    }

    /// The tools called by the function call items among `events`.
    fn called_tool_names(events: &[(&str, &str)]) -> Vec<String> {
        events
            .iter()
            .filter_map(|(_, data)| {
                match serde_json::from_str::<ResponseOutput>(data).ok()?.item? {
                    OutputItem::FunctionCall { tool_name, .. } => Some(tool_name),
                    _ => None,
                }
            })
            .collect()
    }

    /// The names of the tools the chatbot runs itself.
    fn registered_tool_names() -> Vec<String> {
        get_chatbot_tool_definitions()
            .into_iter()
            .filter_map(|definition| match definition {
                AzureLLMToolDefinition::Function(function) => Some(function.name),
                AzureLLMToolDefinition::Search(_) => None,
            })
            .collect()
    }

    /// The chatbot parses every streamed `data:` line into its own types and kills the whole
    /// conversation on one it cannot read, so a mistyped field here is otherwise only visible by
    /// running the whole stack.
    #[test]
    fn every_streamed_data_line_parses_into_chatbot_types() {
        for (name, body) in streamed_bodies() {
            let events = sse_events(&body);
            assert!(!events.is_empty(), "{name} streams no events");
            for (event, data) in events {
                let parsed: ResponseOutput = serde_json::from_str(data).unwrap_or_else(|e| {
                    panic!("{name} streams a {event} the chatbot cannot parse: {e}\n{data}")
                });
                if event.starts_with("response.output_item.") {
                    assert!(
                        parsed.item.is_some(),
                        "{name}: {event} carries no item\n{data}"
                    );
                }
                if event == "response.created" {
                    assert!(
                        parsed.response.and_then(|response| response.id).is_some(),
                        "{name}: {event} carries no response id\n{data}"
                    );
                }
            }
        }
    }

    /// The structured output features parse the text content again as their own response shape,
    /// so both layers have to hold.
    #[test]
    fn structured_output_constants_parse_into_chatbot_types() {
        for (name, body) in [
            ("The message suggestion response", SUGGESTION),
            ("The CMS suggestion response", CMS_SUGGESTION),
            ("The course description response", DESCRIPTION_SUGGESTION),
        ] {
            let completion: LLMResponse = serde_json::from_str(body)
                .unwrap_or_else(|e| panic!("{name} does not parse as an LLM response: {e}"));
            let content = parse_text_completion(completion)
                .unwrap_or_else(|e| panic!("{name} has no text content: {e}"));
            serde_json::from_str::<Value>(&content).unwrap_or_else(|e| {
                panic!("{name} content is not the JSON the feature parses: {e}\n{content}")
            });
        }
    }

    /// The chatbot decides how to parse the rest of the stream from the first delta event and
    /// hands the tool parser only what comes after it. The tool parser needs a completed function
    /// call and a `response.completed`, and errors on a text delta.
    #[test]
    fn the_function_call_round_drives_the_tool_call_parser() {
        let body = chat_message_response(TOOL_CALL_TRIGGER, BASE_URL);
        let events = sse_events(&body);

        let first_delta = events
            .iter()
            .position(|(event, _)| event.ends_with(".delta"))
            .expect("The round streams a delta event");
        assert_eq!(
            events[first_delta].0,
            "response.function_call_arguments.delta"
        );
        assert!(
            events[..first_delta]
                .iter()
                .any(|(event, _)| *event == "response.created"),
            "The response id has to be known before the first delta"
        );
        assert!(
            !events
                .iter()
                .any(|(event, _)| *event == "response.output_text.delta"),
            "A text delta makes the tool parser error out"
        );
        assert_eq!(
            events.last().map(|(event, _)| *event),
            Some("response.completed")
        );

        let called = called_tool_names(&events[first_delta + 1..]);
        assert!(
            !called.is_empty(),
            "The tool parser only sees function calls delivered after the first delta"
        );

        let registered = registered_tool_names();
        for tool_name in called {
            assert!(
                registered.contains(&tool_name),
                "The mock calls {tool_name}, which no chatbot tool is registered under"
            );
        }
    }

    /// The round that suspends a turn: the tool it calls has to be one the client answers, and
    /// must not be one the chatbot would run itself instead of suspending.
    #[test]
    fn the_client_tool_call_round_calls_a_tool_only_the_client_answers() {
        let body = chat_message_response(CLIENT_TOOL_CALL_TRIGGER, BASE_URL);

        let called = called_tool_names(&sse_events(&body));
        assert!(!called.is_empty(), "The round calls no tool");
        let registered = registered_tool_names();
        for tool_name in called {
            assert!(
                tool_is_answered_by_client(&tool_name),
                "The mock calls {tool_name} to suspend a turn, but the client does not answer it"
            );
            assert!(
                !registered.contains(&tool_name),
                "{tool_name} is registered as a chatbot tool, so the turn would never suspend"
            );
        }
    }

    /// The chatbot validates a client tool's arguments before it suspends, so a round the tool
    /// would reject never reaches the client: it becomes a failure reported to the LLM instead.
    #[test]
    fn the_client_tool_call_round_asks_a_question_the_tool_accepts() {
        AskMultipleChoiceQuestionTool::parse_arguments(MOCK_MULTIPLE_CHOICE_ARGUMENTS)
            .expect("the mock's question passes the tool's own validation");
    }

    #[test]
    fn the_answer_after_a_tool_ran_drives_the_text_parser() {
        let body = tool_answer_round();
        let events = sse_events(&body);

        let first_delta = events
            .iter()
            .position(|(event, _)| event.ends_with(".delta"))
            .expect("The round streams a delta event");
        assert_eq!(events[first_delta].0, "response.output_text.delta");
        assert!(
            events[..first_delta]
                .iter()
                .any(|(event, _)| *event == "response.created"),
            "The response id has to be known before the first delta"
        );
        assert_eq!(
            events.last().map(|(event, _)| *event),
            Some("response.completed")
        );

        let streamed: String = events
            .iter()
            .filter(|(event, _)| *event == "response.output_text.delta")
            .filter_map(|(_, data)| serde_json::from_str::<ResponseOutput>(data).ok()?.delta)
            .collect();
        assert!(!streamed.is_empty(), "The round streams no text");
    }

    /// `!URLS!` is substituted into a JSON string nested in a JSON string, so a missed escape
    /// only surfaces when the chatbot parses the search output to save citations.
    #[test]
    fn the_search_response_substitutes_document_urls() {
        let body = search_and_text_response(BASE_URL);
        assert!(!body.contains("!URLS!"));

        let search_outputs: Vec<String> = sse_events(&body)
            .into_iter()
            .filter_map(|(_, data)| {
                match serde_json::from_str::<ResponseOutput>(data).ok()?.item? {
                    OutputItem::AzureAiSearchCallOutput { output, .. }
                        if output.contains("get_urls") =>
                    {
                        Some(output)
                    }
                    _ => None,
                }
            })
            .collect();
        assert!(
            !search_outputs.is_empty(),
            "The search response streams no search output with urls"
        );
        for output in search_outputs {
            let parsed: AISearchOutput = serde_json::from_str(&output)
                .unwrap_or_else(|e| panic!("The search output does not parse: {e}\n{output}"));
            assert_eq!(parsed.get_urls.len(), 3);
            for url in parsed.get_urls {
                assert!(url.as_str().starts_with(BASE_URL), "{url}");
            }
        }
    }
}
