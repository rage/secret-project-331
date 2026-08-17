use crate::controllers::mock_document_storage::{MOCK_DOCUMENTS, MockDocument};
use crate::prelude::*;
use headless_lms_chatbot::{
    azure_chatbot::InputItem,
    chatbot_tools::{
        ChatbotToolDeclaration,
        client_tools::ask_multiple_choice_question::AskMultipleChoiceQuestionTool,
        custom_tools::course_structure::CourseStructureTool,
    },
    cms_ai_suggestion::RESPONSE_FORMAT_NAME as CMS_SUGGESTION_FORMAT,
    course_description_summary::RESPONSE_FORMAT_NAME as COURSE_DESCRIPTION_FORMAT,
    llm_utils::AzureCompletionRequest,
    message_suggestion::RESPONSE_FORMAT_NAME as MESSAGE_SUGGESTION_FORMAT,
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

/// The parts of a request the mock picks its answer from.
struct MockRequest {
    /// The text of the last input message, or `None` when the request ends in a tool output
    /// instead. The other two endings never reach here.
    message: Option<String>,
    /// The structured output schema the answer has to parse as, `None` for a chat request.
    format_name: Option<String>,
    /// Whether the caller reads the answer as a Server-Sent Events stream or as one JSON object.
    stream: bool,
}

impl MockRequest {
    /// A streamed chat request carrying `message`.
    fn chat(message: &str) -> Self {
        MockRequest {
            message: Some(message.to_string()),
            format_name: None,
            stream: true,
        }
    }

    /// A streamed request resuming a tool loop, which ends in the tool's output rather than in a
    /// message.
    fn after_tool_run() -> Self {
        MockRequest {
            message: None,
            format_name: None,
            stream: true,
        }
    }

    /// A request for structured output in `format_name`. Its message is one that would drive a
    /// function call round if the message decided anything here, which it must not.
    fn structured_output(format_name: &str) -> Self {
        MockRequest {
            message: Some(TOOL_CALL_TRIGGER.to_string()),
            format_name: Some(format_name.to_string()),
            stream: false,
        }
    }

    /// Whether this asks for the structured output named `format_name`. False for a streamed
    /// request even when it names the schema, since the answer to one is a whole JSON object that
    /// a streaming caller cannot read.
    fn wants_format(&self, format_name: &str) -> bool {
        !self.stream && self.format_name.as_deref() == Some(format_name)
    }

    /// Whether this is a streamed chat message containing `trigger`.
    fn message_contains(&self, trigger: &str) -> bool {
        self.stream
            && self
                .message
                .as_deref()
                .is_some_and(|message| message.contains(trigger))
    }
}

/// One shape of request the mock answers, and the answer it gives.
///
/// The tests drive every registered scenario through its own [`example`](Scenario::example), so
/// registering a round here is what gets it verified at all.
struct Scenario {
    /// Names the scenario in the handler's log line and in test failures.
    name: &'static str,
    matches: fn(&MockRequest) -> bool,
    /// Builds the answer against the base url its document urls have to point at.
    respond: fn(&str) -> String,
    /// A request this scenario answers.
    #[cfg_attr(not(test), allow(dead_code))]
    example: fn() -> MockRequest,
}

/// The first scenario that matches answers, so the default chat answer, which takes any streamed
/// message at all, comes last.
///
/// A blocking caller parses the whole body as one JSON object and a streaming one reads it event by
/// event, so no answer suits both, and every scenario says which kind it is. Among the blocking
/// ones the schema alone decides: a learner is free to type anything into the chat, so no part of a
/// message may reach a feature's answer.
const SCENARIOS: &[Scenario] = &[
    Scenario {
        name: "the next message suggestion",
        matches: |request| request.wants_format(MESSAGE_SUGGESTION_FORMAT),
        respond: |_| blocking_response(MESSAGE_SUGGESTION_PAYLOAD),
        example: || MockRequest::structured_output(MESSAGE_SUGGESTION_FORMAT),
    },
    Scenario {
        name: "the CMS paragraph suggestion",
        matches: |request| request.wants_format(CMS_SUGGESTION_FORMAT),
        respond: |_| blocking_response(CMS_SUGGESTION_PAYLOAD),
        example: || MockRequest::structured_output(CMS_SUGGESTION_FORMAT),
    },
    Scenario {
        name: "the course description summary",
        matches: |request| request.wants_format(COURSE_DESCRIPTION_FORMAT),
        respond: |_| blocking_response(COURSE_DESCRIPTION_PAYLOAD),
        example: || MockRequest::structured_output(COURSE_DESCRIPTION_FORMAT),
    },
    Scenario {
        name: "the client tool call round",
        matches: |request| request.message_contains(CLIENT_TOOL_CALL_TRIGGER),
        respond: |_| {
            function_call_round(
                <AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::NAME,
                MOCK_MULTIPLE_CHOICE_ARGUMENTS,
            )
        },
        example: || MockRequest::chat(CLIENT_TOOL_CALL_TRIGGER),
    },
    Scenario {
        name: "the function call round",
        matches: |request| request.message_contains(TOOL_CALL_TRIGGER),
        respond: |_| {
            function_call_round(<CourseStructureTool as ChatbotToolDeclaration>::NAME, "{}")
        },
        example: || MockRequest::chat(TOOL_CALL_TRIGGER),
    },
    Scenario {
        name: "the answer after a tool ran",
        matches: |request| request.stream && request.message.is_none(),
        respond: |_| tool_answer_round(),
        example: MockRequest::after_tool_run,
    },
    Scenario {
        name: "the default chat answer",
        matches: |request| request.stream && request.message.is_some(),
        respond: search_and_text_round,
        example: || MockRequest::chat("Tell me more"),
    },
];

/// The scenario that answers `request`, or `None` when the mock answers nothing like it.
fn pick_scenario(request: &MockRequest) -> Option<&'static Scenario> {
    SCENARIOS
        .iter()
        .find(|scenario| (scenario.matches)(request))
}

/// GET /api/v0/mock-azure/api/projects/test/openai/v1/responses
/// POST /api/v0/mock-azure/api/projects/test/openai/v1/responses
///
/// Stands in for the Azure Responses API while the chatbot runs in test mode. Answers with the
/// first scenario in [`SCENARIOS`] whose request shape matches, and 400s on a request no scenario
/// answers.
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

    let message = match last_input_item {
        InputItem::Message { content, .. } => Some(content.clone().get_content_text()),
        InputItem::FunctionCallOutput { .. } => None,
        InputItem::FunctionCall { .. } | InputItem::Reasoning { .. } => {
            return Err(controller_err!(
                BadRequest,
                "The mock has no response for a request that ends in a function call or a reasoning item."
            ));
        }
    };

    let request = MockRequest {
        message,
        format_name: payload
            .base
            .text
            .as_ref()
            .and_then(|text| text.format.as_ref())
            .map(|format| format.name.clone()),
        stream: payload.stream,
    };
    let scenario = pick_scenario(&request).ok_or_else(|| {
        controller_err!(
            BadRequest,
            "The mock has no response for this shape of request."
        )
    })?;
    debug!(scenario = scenario.name, "Answering as the mock Azure API");
    let res = (scenario.respond)(&app_conf.base_url);

    let token = skip_authorize();
    token.authorized_ok(res)
}

/// Renders `events` as a Server-Sent Events body in the order given, stamping every `data:` object
/// with its own event name as `type`, the way Azure repeats it. The chatbot reads the `event:` line
/// to decide what the `data:` line after it means, so the pairing and the order are what make a
/// round parse as a tool call or as text.
fn sse_body(events: Vec<(&str, Value)>) -> String {
    events
        .into_iter()
        .map(|(event, mut data)| {
            if let Some(object) = data.as_object_mut() {
                object.insert("type".to_string(), json!(event));
            }
            format!("event: {event}\ndata: {data}\n\n")
        })
        .collect()
}

/// Wraps a round's own `events` in the lifecycle events every round shares: `response.created`,
/// which is where the chatbot picks up the response id it needs before the first delta, and the
/// terminal `response.completed`.
fn round(response_id: &str, events: Vec<(&'static str, Value)>, usage: Value) -> String {
    let mut all = vec![(
        "response.created",
        json!({"response": response_object(response_id)}),
    )];
    all.extend(events);
    all.push((
        "response.completed",
        json!({"response": completed_response_object(response_id, usage)}),
    ));
    sse_body(all)
}

/// What one round was billed for. `cached_tokens` is the part of the input Azure served from the
/// prompt cache, and the rest of it is what the round wrote there.
fn usage(
    input_tokens: u32,
    cached_tokens: u32,
    output_tokens: u32,
    reasoning_tokens: u32,
) -> Value {
    json!({
        "input_tokens": input_tokens,
        "input_tokens_details": {
            "cached_tokens": cached_tokens,
            "cache_write_tokens": input_tokens.saturating_sub(cached_tokens),
        },
        "output_tokens": output_tokens,
        "output_tokens_details": {"reasoning_tokens": reasoning_tokens},
        "total_tokens": input_tokens + output_tokens,
    })
}

/// The response object of a lifecycle event before the last one. Only `id` and a possible `error`
/// are read by the chatbot; Azure sends the full request parameters here as well. See
/// [`completed_response_object`] for the terminal event.
fn response_object(response_id: &str) -> Value {
    json!({
        "id": response_id,
        "object": "response",
        "status": "in_progress",
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

/// One assistant message as an output item, in the two shapes a round streams it in: `content` is
/// empty while the item is in progress and carries the whole text once it is done.
fn message_item(item_id: &str, response_id: &str, content: Value, status: &str) -> Value {
    json!({
        "type": "message",
        "id": item_id,
        "response_id": response_id,
        "phase": "final_answer",
        "role": "assistant",
        "content": content,
        "status": status,
    })
}

/// The events that stream one assistant message: the item, its content part, one event per delta,
/// and the finished item. `output_index` is the message's place among the round's output items, so
/// it depends on how many items the round emitted before this one.
fn message_item_events(
    item_id: &str,
    response_id: &str,
    output_index: u32,
    deltas: &[&str],
) -> Vec<(&'static str, Value)> {
    let text = deltas.concat();

    let mut events = vec![
        (
            "response.output_item.added",
            json!({
                "output_index": output_index,
                "item": message_item(item_id, response_id, json!([]), "in_progress"),
            }),
        ),
        (
            "response.content_part.added",
            json!({
                "content_index": 0,
                "item_id": item_id,
                "output_index": output_index,
                "part": { "type": "output_text", "text": "" },
            }),
        ),
    ];
    events.extend(deltas.iter().map(|delta| {
        (
            "response.output_text.delta",
            json!({
                "content_index": 0,
                "item_id": item_id,
                "output_index": output_index,
                "delta": delta,
            }),
        )
    }));
    events.extend([
        (
            "response.output_text.done",
            json!({
                "content_index": 0,
                "item_id": item_id,
                "output_index": output_index,
                "text": text,
            }),
        ),
        (
            "response.content_part.done",
            json!({
                "content_index": 0,
                "item_id": item_id,
                "output_index": output_index,
                "part": { "type": "output_text", "text": text },
            }),
        ),
        (
            "response.output_item.done",
            json!({
                "output_index": output_index,
                "item": message_item(
                    item_id,
                    response_id,
                    json!([{ "type": "output_text", "text": text }]),
                    "completed",
                ),
            }),
        ),
    ]);
    events
}

/// The events that stream the reasoning item a round emits before it calls anything or answers,
/// which is what makes it the round's first output item.
fn reasoning_item_events(response_id: &str) -> Vec<(&'static str, Value)> {
    let item = reasoning_item(response_id);
    vec![
        (
            "response.output_item.added",
            json!({"output_index": 0, "item": item}),
        ),
        (
            "response.output_item.done",
            json!({"output_index": 0, "item": item}),
        ),
    ]
}

/// The item [`reasoning_item_events`] streams, unchanged in both of its events.
fn reasoning_item(response_id: &str) -> Value {
    json!({
        "type": "reasoning",
        "id": format!("rs_{}", Uuid::new_v4()),
        "response_id": response_id,
        "summary": [],
        // Azure returns this whenever `store` is false, and the chatbot only replays a reasoning
        // item that has it, so without it the mock never exercises the replay path.
        "encrypted_content": "mock-encrypted-reasoning",
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
    let mut events = reasoning_item_events(&response_id);
    events.extend([
        (
            "response.output_item.added",
            json!({"output_index": 1, "item": function_call("", "in_progress")}),
        ),
        (
            "response.function_call_arguments.delta",
            json!({"item_id": item_id, "output_index": 1, "delta": arguments}),
        ),
        (
            "response.function_call_arguments.done",
            json!({"item_id": item_id, "output_index": 1, "arguments": arguments}),
        ),
        (
            "response.output_item.done",
            json!({"output_index": 1, "item": function_call(arguments, "completed")}),
        ),
    ]);

    round(&response_id, events, usage(42, 0, 88, 64))
}

/// The text answer the model gives once a tool has run.
fn tool_answer_round() -> String {
    let response_id = format!("resp_{}", Uuid::new_v4());
    let item_id = format!("msg_{}", Uuid::new_v4());
    let deltas = [
        "Here", " is", " the", " mock", " answer", " after", " a", " tool", " ran.",
    ];

    round(
        &response_id,
        message_item_events(&item_id, &response_id, 0, &deltas),
        // Second round of the same turn, so what the first round wrote to the cache comes back as
        // a cache read here.
        usage(96, 42, 24, 8),
    )
}

/// The default chat answer: a search of the course material, the results it returns, and a text
/// answer citing them.
fn search_and_text_round(base_url: &str) -> String {
    let response_id = format!("resp_{}", Uuid::new_v4());
    let call_id = format!("call_{}", Uuid::new_v4());
    let search_item_id = format!("fc_{}", Uuid::new_v4());
    let output_item_id = format!("fco_{}", Uuid::new_v4());
    let message_item_id = format!("msg_{}", Uuid::new_v4());

    let search_call = |arguments: &str, status: &str| {
        json!({
            "type": "azure_ai_search_call",
            "id": search_item_id,
            "response_id": response_id,
            "call_id": call_id,
            "arguments": arguments,
            "status": status,
        })
    };
    let search_call_output = |output: &str, status: &str| {
        json!({
            "type": "azure_ai_search_call_output",
            "id": output_item_id,
            "response_id": response_id,
            "call_id": call_id,
            "output": output,
            "status": status,
        })
    };

    let mut events = vec![(
        "response.in_progress",
        json!({"response": response_object(&response_id)}),
    )];
    events.extend(reasoning_item_events(&response_id));
    events.extend([
        (
            "response.output_item.added",
            json!({"output_index": 1, "item": search_call("", "in_progress")}),
        ),
        (
            "response.output_item.done",
            json!({
                "output_index": 1,
                "item": search_call(r#"{"query":"tell me more"}"#, "completed"),
            }),
        ),
        (
            "response.output_item.added",
            json!({"output_index": 2, "item": search_call_output("[]", "in_progress")}),
        ),
        (
            "response.output_item.done",
            json!({
                "output_index": 2,
                "item": search_call_output(&search_results(base_url), "completed"),
            }),
        ),
    ]);
    events.extend(message_item_events(
        &message_item_id,
        &response_id,
        3,
        &SEARCH_ANSWER_DELTAS,
    ));

    round(&response_id, events, usage(38, 0, 79, 64))
}

/// The default round's answer, one delta per element. Each `【x:y†source】` is a citation marker the
/// frontend replaces with a link to the document it points at.
const SEARCH_ANSWER_DELTAS: [&str; 12] = [
    "Hello",
    "!",
    " How",
    " can",
    " I",
    " assist",
    " 【0:2†source】",
    " you",
    " 【0:1†source】",
    " today",
    "?",
    "【0:2†source】",
];

/// What the search returns, as the JSON string Azure nests it in. Only `get_urls` is read: the
/// chatbot fetches each of those to build the answer's citations, so both they and the hits come
/// from [`MOCK_DOCUMENTS`], the documents the mock document storage serves.
fn search_results(base_url: &str) -> String {
    let [document1, document2, document3] = &MOCK_DOCUMENTS;
    let hit = |id: &str, document: &MockDocument, content: &str| {
        json!({
            "id": id,
            "content": content,
            "filepath": document.filepath,
            "title": document.title,
            "url": "",
            "score": 0.016666668,
            "knowledgeSourceIndex": 0,
        })
    };
    let get_urls: Vec<String> = MOCK_DOCUMENTS
        .iter()
        .map(|document| {
            format!(
                "{base_url}/api/v0/mock-document-storage/test/documents/{}",
                document.id
            )
        })
        .collect();

    json!({
        "documents": [
            hit(
                "doc1",
                document1,
                "This chunk is a snippet from page {} of the course {}. Mock test page content This is test content blah",
            ),
            hit(
                "doc2",
                document2,
                "Mock test page content 2 This is another test page.",
            ),
            // A second hit on doc1's page, so it repeats that page's title and filepath and only
            // the chunk is document3's.
            hit("doc3", document1, document3.chunk),
        ],
        "get_urls": get_urls,
    })
    .to_string()
}

/// A response to a request that asked for structured output instead of a stream: one whole JSON
/// object, whose text content is `payload`, the JSON the caller's own schema describes.
fn blocking_response(payload: &str) -> String {
    let response_id = format!("resp_{}", Uuid::new_v4());
    let item_id = format!("msg_{}", Uuid::new_v4());

    let mut response = completed_response_object(&response_id, usage(30, 0, 15, 0));
    response["output"] = json!([message_item(
        &item_id,
        &response_id,
        json!([{ "type": "output_text", "text": payload }]),
        "completed",
    )]);
    response.to_string()
}

/// The suggestions the chatbot offers as the learner's next message.
const MESSAGE_SUGGESTION_PAYLOAD: &str =
    r#"{"suggestions":["Can you pls help me?","Nice weather we're having.","Hello?"]}"#;

/// The rewrites the CMS offers for a paragraph.
const CMS_SUGGESTION_PAYLOAD: &str = r#"{"suggestions":["Mock suggestion 1: The paragraph has been improved.","Mock suggestion 2: Here is an alternative version of the paragraph.","Mock suggestion 3: A third distinct rewrite of the paragraph."]}"#;

/// The course description summary, in the shape Sisu expects it in.
const COURSE_DESCRIPTION_PAYLOAD: &str = r#"{"modules":[{"description":"Introductory course to containers and containerization with Docker. Introduces containerization with Docker and relevant concepts such as image and volume. After completion, students are able to run containerized applications, containerize applications, utilize volumes to store data persistently outside containers, use port mapping to enable access via TCP to containerized applications, and share their own containers publicly. No hard prerequisites; Linux operating systems and web development experience are useful.","prerequisites":["No hard prerequisites","Linux operating systems and web development experience are useful"],"course_code":"TKT21036"}],"audience":["everyone"],"course_description":"Introductory course to containers and containerization with Docker. Introduces containerization with Docker and relevant concepts such as image and volume. After completion, students are able to run containerized applications, containerize applications, utilize volumes to store data persistently outside containers, use port mapping to enable access via TCP to containerized applications, and share their own containers publicly."}"#;

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
    use regex::Regex;

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

    /// The body the mock answers `request` with, through the dispatch the handler runs.
    fn respond(request: &MockRequest) -> String {
        let scenario = pick_scenario(request).expect("the mock answers this request");
        (scenario.respond)(BASE_URL)
    }

    /// Every registered scenario's example body of the given kind, named for failure messages.
    fn example_bodies(stream: bool) -> Vec<(&'static str, String)> {
        SCENARIOS
            .iter()
            .filter(|scenario| (scenario.example)().stream == stream)
            .map(|scenario| (scenario.name, (scenario.respond)(BASE_URL)))
            .collect()
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

    /// Where the round's first delta is, having checked the lifecycle events every round needs
    /// around it: the response id before the first delta, and the terminal event last.
    fn first_delta(events: &[(&str, &str)]) -> usize {
        let index = events
            .iter()
            .position(|(event, _)| event.ends_with(".delta"))
            .expect("The round streams a delta event");
        assert!(
            events[..index]
                .iter()
                .any(|(event, _)| *event == "response.created"),
            "The response id has to be known before the first delta"
        );
        assert_eq!(
            events.last().map(|(event, _)| *event),
            Some("response.completed")
        );
        index
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
        let bodies = example_bodies(true);
        assert!(!bodies.is_empty(), "no streamed scenario is registered");
        for (name, body) in bodies {
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

    /// A scenario answering an example its own `matches` rejects would leave the round it stands
    /// for untested while every test built from the registry passed.
    #[test]
    fn every_scenario_answers_its_own_example() {
        for scenario in SCENARIOS {
            let request = (scenario.example)();
            let picked = pick_scenario(&request).map(|picked| picked.name);
            assert_eq!(
                picked,
                Some(scenario.name),
                "{} is not the scenario its own example is answered by",
                scenario.name
            );
        }
    }

    /// The structured output features parse the text content again as their own response shape, so
    /// both layers have to hold.
    #[test]
    fn structured_output_responses_parse_into_chatbot_types() {
        let bodies = example_bodies(false);
        assert!(!bodies.is_empty(), "no blocking scenario is registered");
        for (name, body) in bodies {
            let completion: LLMResponse = serde_json::from_str(&body)
                .unwrap_or_else(|e| panic!("{name} does not parse as an LLM response: {e}"));
            let content = parse_text_completion(completion)
                .unwrap_or_else(|e| panic!("{name} has no text content: {e}"));
            serde_json::from_str::<Value>(&content).unwrap_or_else(|e| {
                panic!("{name} content is not the JSON the feature parses: {e}\n{content}")
            });
        }
    }

    /// Each feature parses the text content as its own response shape, so a payload nested inside
    /// another object would satisfy the test above and still break all three.
    #[test]
    fn a_blocking_response_carries_its_payload_as_the_whole_text_content() {
        for payload in [
            MESSAGE_SUGGESTION_PAYLOAD,
            CMS_SUGGESTION_PAYLOAD,
            COURSE_DESCRIPTION_PAYLOAD,
        ] {
            let completion: LLMResponse = serde_json::from_str(&blocking_response(payload))
                .expect("the blocking response parses as an LLM response");
            let content = parse_text_completion(completion).expect("the response has text content");
            assert_eq!(content, payload);
        }
    }

    /// The chatbot decides how to parse the rest of the stream from the first delta event and
    /// hands the tool parser only what comes after it. The tool parser needs a completed function
    /// call and a `response.completed`, and errors on a text delta.
    #[test]
    fn the_function_call_round_drives_the_tool_call_parser() {
        let body = respond(&MockRequest::chat(TOOL_CALL_TRIGGER));
        let events = sse_events(&body);

        let first_delta = first_delta(&events);
        assert_eq!(
            events[first_delta].0,
            "response.function_call_arguments.delta"
        );
        assert!(
            !events
                .iter()
                .any(|(event, _)| *event == "response.output_text.delta"),
            "A text delta makes the tool parser error out"
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
        let body = respond(&MockRequest::chat(CLIENT_TOOL_CALL_TRIGGER));

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
        let body = respond(&MockRequest::after_tool_run());
        let events = sse_events(&body);

        assert_eq!(events[first_delta(&events)].0, "response.output_text.delta");

        let streamed: String = events
            .iter()
            .filter(|(event, _)| *event == "response.output_text.delta")
            .filter_map(|(_, data)| serde_json::from_str::<ResponseOutput>(data).ok()?.delta)
            .collect();
        assert!(!streamed.is_empty(), "The round streams no text");
    }

    /// The system tests wait for this answer with the citation markers stripped out by the
    /// frontend, and the committed screenshots show it with them rendered as citation pills, so
    /// rewording either form here, or shifting a space around a marker, fails the chatbot specs.
    #[test]
    fn the_search_round_answers_the_text_the_system_tests_wait_for() {
        let answer = SEARCH_ANSWER_DELTAS.concat();
        assert_eq!(
            answer,
            "Hello! How can I assist 【0:2†source】 you 【0:1†source】 today?【0:2†source】"
        );

        // The frontend's REMOVE_CITATIONS_REGEX, which produces the text the specs wait for.
        let stripped = Regex::new(r"\s*?【\d+:\d+†source】")
            .expect("the citation regex compiles")
            .replace_all(&answer, "");
        assert_eq!(stripped, "Hello! How can I assist you today?");
    }

    /// The urls are the only part of the search output the chatbot reads, and it reads them out of
    /// a JSON string nested in a JSON string, so the nesting only fails where it is parsed: when
    /// the answer's citations are saved.
    #[test]
    fn the_search_round_streams_document_urls() {
        let body = search_and_text_round(BASE_URL);

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
            "The search round streams no search output with urls"
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
