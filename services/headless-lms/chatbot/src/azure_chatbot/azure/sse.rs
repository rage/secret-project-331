//! Reading the Azure Server-Sent Events stream: one line at a time, and far enough into a
//! response to know which parser the rest of it belongs to.

use futures::StreamExt;
use tracing::trace;

use super::protocol::{OutputItem, ResponseOutput, reported_azure_error};
use super::transport::{ResponseLinesStream, ResponseStreamType};
use crate::azure_chatbot::events::StreamItem;
use crate::chatbot_error::ChatbotResult;
use crate::prelude::*;

/// Azure events that no parser needs to react to, or that some parser handles while another
/// legitimately sees them. An event outside this list is logged as unexpected, so a name Azure
/// starts sending has to be added here even when nothing acts on it.
pub(crate) const ALL_EXPECTED_EVENTS: &[&str] = &[
    "response.in_progress",
    "response.queued",
    "response.content_part.added",
    "response.content_part.done",
    "response.reasoning_summary_part.added",
    "response.reasoning_summary_part.done",
    "response.reasoning_summary_text.delta",
    "response.reasoning_summary_text.done",
    "response.reasoning_text.delta",
    "response.reasoning_text.done",
    "response.function_call_arguments.done",
    "response.custom_tool_call_input.done",
    "response.output_text.done",
    "response.output_text.annotation.added",
    "response.refusal.done",
];

/// One Azure SSE event name, classified once instead of by a separate `&str` match in each parser
/// that reacts to it.
///
/// The three parsers deliberately disagree about the same event — `OutputTextDelta` is a hard
/// error in the tool-call parser, the classification signal here, and ordinary traffic in the
/// text parser — so this only says *what* the event is, never what to do about it. Each parser
/// still matches its own subset of variants and keeps a catch-all for the rest, including
/// [`Self::Other`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum AzureStreamEvent {
    ResponseCreated,
    ResponseCompleted,
    OutputItemAdded,
    OutputItemDone,
    FunctionCallArgumentsDelta,
    CustomToolCallInputDelta,
    OutputTextDelta,
    RefusalDelta,
    Incomplete,
    ErrorReported,
    /// Anything not matched by name above, including traffic every parser is fine to ignore
    /// (`response.in_progress`, reasoning summaries, …) and names outside [`ALL_EXPECTED_EVENTS`].
    Other,
}

impl AzureStreamEvent {
    pub(crate) fn from_wire(name: &str) -> Self {
        match name {
            "response.created" => Self::ResponseCreated,
            "response.completed" => Self::ResponseCompleted,
            "response.output_item.added" => Self::OutputItemAdded,
            "response.output_item.done" => Self::OutputItemDone,
            "response.function_call_arguments.delta" => Self::FunctionCallArgumentsDelta,
            "response.custom_tool_call_input.delta" => Self::CustomToolCallInputDelta,
            "response.output_text.delta" => Self::OutputTextDelta,
            "response.refusal.delta" => Self::RefusalDelta,
            "response.incomplete" => Self::Incomplete,
            "response.error" | "error" | "response.failed" => Self::ErrorReported,
            _ => Self::Other,
        }
    }

    /// Which event a `data:` line belongs to: the `event:` line that preceded it, or, when none
    /// did, the line's own `type` field.
    ///
    /// The one rule all three readers of the stream use, so the same line cannot count as, say,
    /// Azure's finished copy of an item for one reader and its `added` copy for another. `type` is
    /// only a fallback because it is optional on the wire.
    pub(crate) fn of_data_line(
        preceding_event: Option<Self>,
        response_type: Option<&str>,
    ) -> Option<Self> {
        preceding_event.or_else(|| response_type.map(Self::from_wire))
    }

    /// Classifies an `event:` line, warning once if the name falls outside everything a parser
    /// reacts to and [`ALL_EXPECTED_EVENTS`].
    fn for_event_line(name: &str) -> Self {
        let event = Self::from_wire(name);
        if matches!(event, Self::Other) && !ALL_EXPECTED_EVENTS.contains(&name) {
            warn!("Received unexpected event from Azure: Event: {}", name);
        }
        event
    }
}

pub(crate) enum ParsedResponseLine {
    Event(AzureStreamEvent),
    Data(Box<ResponseOutput>),
}

/// The value of an SSE field, or `None` when the line is a different field. The space after the
/// colon is optional in the SSE grammar, so a `data:{...}` line carries an item like any other.
fn sse_field<'a>(line: &'a str, field: &str) -> Option<&'a str> {
    let value = line.strip_prefix(field)?.strip_prefix(':')?;
    Some(value.strip_prefix(' ').unwrap_or(value))
}

impl ParsedResponseLine {
    pub(crate) fn parse(input: &str) -> ChatbotResult<Option<Self>> {
        if let Some(event_type) = sse_field(input, "event") {
            Ok(Some(ParsedResponseLine::Event(
                AzureStreamEvent::for_event_line(event_type),
            )))
        } else if let Some(data) = sse_field(input, "data") {
            // The end-of-stream sentinel of the older completions API, which is not JSON.
            if data.trim() == "[DONE]" {
                return Ok(None);
            }
            let response_output = match serde_json::from_str::<ResponseOutput>(data) {
                Ok(response_output) => response_output,
                Err(e) => {
                    tracing::error!(error = %e, "Failed to deserialize streamed response line from Azure");
                    // The line itself can carry learner-facing text, so it is kept out of the
                    // error-level log above and only traced, same as the rest of this module.
                    tracing::trace!(raw_line = %data, "Raw line for the deserialization failure above");
                    return Err(ChatbotError::from(e));
                }
            };
            Ok(Some(ParsedResponseLine::Data(Box::new(response_output))))
        } else {
            Ok(None)
        }
    }
}

/// The head of an Azure response, read far enough to know which parser the rest of it belongs to.
pub(crate) struct ClassifiedResponse<'a> {
    pub(crate) response_id: String,
    /// Every output item that arrived before the response was classified, in the order Azure sent
    /// them. None of them is stored or forwarded yet; the caller does both.
    pub(crate) items: Vec<StreamItem>,
    /// The rest of the Azure stream, tagged with the parser it belongs to.
    pub(crate) stream: ResponseStreamType<'a>,
}

/// Reads the head of `lines` until it is clear whether the round is a tool call or a text answer,
/// and hands the rest of the stream on to the parser that suits it.
///
/// Errors if the response fails, arrives incomplete, or ends without classifying.
pub(crate) async fn detect_response_kind<'a>(
    mut lines: ResponseLinesStream<'a>,
) -> ChatbotResult<ClassifiedResponse<'a>> {
    let mut response_id: Option<String> = None;
    let mut items: Vec<StreamItem> = Vec::new();
    // If two event lines arrive back-to-back with no data line between them, the later one wins.
    let mut preceding_event: Option<AzureStreamEvent> = None;

    while let Some(line) = lines.next().await {
        let line = line?;
        let response_output = match ParsedResponseLine::parse(&line)? {
            Some(ParsedResponseLine::Event(event)) => {
                trace!("Event: {event:?}");
                match &event {
                    // Fallback for a round that starts streaming a delta without ever announcing
                    // the item it belongs to.
                    AzureStreamEvent::FunctionCallArgumentsDelta
                    | AzureStreamEvent::CustomToolCallInputDelta => {
                        return classified(response_id, items, ResponseStreamType::ToolCall(lines));
                    }
                    AzureStreamEvent::OutputTextDelta | AzureStreamEvent::RefusalDelta => {
                        return classified(
                            response_id,
                            items,
                            ResponseStreamType::TextResponse(lines),
                        );
                    }
                    // todo: can add the incomplete reason for more info
                    AzureStreamEvent::Incomplete => Err(chatbot_err!(
                        ResponseIncomplete,
                        format!(
                            "Response incomplete. Response id: {}",
                            response_id.as_deref().unwrap_or("not received")
                        )
                    ))?,
                    _ => {}
                }
                preceding_event = Some(event);
                continue;
            }
            Some(ParsedResponseLine::Data(response_output)) => response_output,
            None => continue,
        };

        let event = AzureStreamEvent::of_data_line(
            preceding_event.take(),
            response_output.response_type.as_deref(),
        );
        match event {
            Some(AzureStreamEvent::ErrorReported) => {
                if let Some(error) = reported_azure_error(&response_output, response_id.as_deref())
                {
                    Err(error)?
                } else {
                    Err(chatbot_err!(
                        UnexpectedProtocolShape,
                        format!(
                            "Response failed without receiving an API error. Response output: {:?} Response id: {}",
                            &response_output,
                            response_id.as_deref().unwrap_or("not received")
                        )
                    ))?
                }
            }
            Some(AzureStreamEvent::ResponseCreated) => {
                let response = response_output.response.ok_or(chatbot_err!(
                    DeserializationError,
                    "Expected response object"
                ))?;
                response_id = response.id;
            }
            Some(
                item_event @ (AzureStreamEvent::OutputItemAdded | AzureStreamEvent::OutputItemDone),
            ) => {
                let received = response_output.item.ok_or(chatbot_err!(
                    DeserializationError,
                    "Expected response output item"
                ))?;
                let Some(item) = received.known() else {
                    continue;
                };
                let parser = parser_for_item(&item);
                items.push(StreamItem::Received {
                    item,
                    finished: item_event == AzureStreamEvent::OutputItemDone,
                });
                if let Some(parser) = parser {
                    return classified(response_id, items, parser(lines));
                }
            }
            _ => {}
        }
    }

    // Reached when the stream ends before any event classifies the response as a tool call or a
    // text answer — the normal outcome for a truncated response, not dead code.
    Err(chatbot_err!(
        StreamEndedEarly,
        format!(
            "The response received from Azure ended unexpectedly. Response id: {}",
            response_id.as_deref().unwrap_or("not received")
        )
    ))
}

/// Which parser the rest of the round belongs to, going by the item it just announced, or `None`
/// for an item that says nothing about it.
///
/// Reasoning and search items accompany a tool-call round and a text answer alike, so only a
/// function call or a message decides. Reading the item rather than the first delta is what keeps
/// a tool call that streams no arguments classifiable at all.
fn parser_for_item<'a>(
    item: &OutputItem,
) -> Option<fn(ResponseLinesStream<'a>) -> ResponseStreamType<'a>> {
    match item {
        OutputItem::FunctionCall { .. } => Some(ResponseStreamType::ToolCall),
        OutputItem::Message { .. } => Some(ResponseStreamType::TextResponse),
        OutputItem::Reasoning { .. }
        | OutputItem::AzureAiSearchCall { .. }
        | OutputItem::AzureAiSearchCallOutput { .. }
        | OutputItem::FunctionCallOutput { .. } => None,
    }
}

/// The classification, once the round is known, failing if Azure never named the response.
fn classified<'a>(
    response_id: Option<String>,
    items: Vec<StreamItem>,
    stream: ResponseStreamType<'a>,
) -> ChatbotResult<ClassifiedResponse<'a>> {
    let response_id = response_id.ok_or(chatbot_err!(
        StreamInvariantViolation,
        "No response_id found! This should never happen!"
    ))?;
    Ok(ClassifiedResponse {
        response_id,
        items,
        stream,
    })
}
