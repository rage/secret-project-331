//! What the turn reports: the NDJSON events the client reads, and the events the parsers pass
//! between themselves on the way there.

use std::pin::Pin;

use bytes::Bytes;
use futures::Stream;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::azure::protocol::OutputItem;
use crate::azure_chatbot::azure::tools::AZURE_AI_SEARCH_TOOL_NAME;
use crate::chatbot_error::ChatbotResult;
use crate::llm_utils::APIInputMessage;
use crate::prelude::*;

/// The wire event a [`StreamItem`] becomes, or `None` for an item that has no shape on the wire
/// (a `Message` item, which is reported through the text-delta path instead).
pub(super) fn stream_event_for(value: StreamItem) -> Option<ChatbotChatStreamEvent> {
    let (item, finished) = match value {
        StreamItem::ServerToolOutput { call_id } => return Some(finished_tool_call(call_id)),
        StreamItem::Received { item, finished } => (item, finished),
    };
    Some(match item {
        OutputItem::Reasoning { id, .. } => ChatbotChatStreamEvent::Reasoning {
            finished,
            reasoning_id: id,
        },
        OutputItem::AzureAiSearchCall {
            arguments, call_id, ..
        } => ChatbotChatStreamEvent::ToolCall {
            tool_name: Some(AZURE_AI_SEARCH_TOOL_NAME.to_string()),
            arguments: Some(arguments),
            tool_call_id: call_id,
            finished,
        },
        // A call the model made counts as finished only once its output arrives, so Azure's
        // finished copy of the call itself is still reported unfinished.
        OutputItem::FunctionCall {
            tool_name,
            arguments,
            call_id,
            ..
        } => ChatbotChatStreamEvent::ToolCall {
            tool_name: Some(tool_name),
            arguments: Some(arguments),
            tool_call_id: call_id,
            finished: false,
        },
        OutputItem::AzureAiSearchCallOutput { call_id, .. } => ChatbotChatStreamEvent::ToolCall {
            tool_name: Some(AZURE_AI_SEARCH_TOOL_NAME.to_string()),
            arguments: None,
            tool_call_id: call_id,
            finished: true,
        },
        OutputItem::FunctionCallOutput { call_id, .. } => finished_tool_call(call_id),
        OutputItem::Message { .. } => return None,
    })
}

/// Tells the client a call it has already seen is done. Carries no tool name or arguments: the
/// frontend reads neither, and it already has both from the event that announced the call.
fn finished_tool_call(call_id: String) -> ChatbotChatStreamEvent {
    ChatbotChatStreamEvent::ToolCall {
        tool_name: None,
        arguments: None,
        tool_call_id: call_id,
        finished: true,
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(tag = "type", content = "data")]
pub enum ChatbotChatStreamEvent {
    Delta {
        text: String,
        message_id: Uuid,
    },
    Reasoning {
        finished: bool,
        reasoning_id: String,
    },
    ToolCall {
        tool_name: Option<String>,
        arguments: Option<String>,
        tool_call_id: String,
        finished: bool,
    },
    Done,
    /// The turn stopped to wait for the client to answer a tool call, so it ends with neither an
    /// answer nor an error. Terminal like `Done`: the client stops reading, answers the call
    /// through the tool-response endpoint, and reads the stream that returns.
    ///
    /// Carries nothing, because the call it waits on was already streamed as an unfinished
    /// `ToolCall` event, and survives a reload only through the conversation's messages anyway.
    Suspended,
    /// A confirmed action tool call executed, carrying data for the confirming admin's browser
    /// only (e.g. a reset link). Never persisted: it is not in `payload` again after a reload, and
    /// the model never sees it either.
    ActionExecuted {
        tool_call_id: String,
        payload: serde_json::Value,
    },
    Error(StreamEventError),
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct StreamEventError {
    message: String,
    details: Option<String>,
}

/// What the two body parsers — the tool-call round and the text answer — yield once a response is
/// classified. One type shared between them rather than split further: both stream `Item`, while
/// `Refusal`/`ItemAnnounced`/`Messages`/`Suspended` come only from the tool-call round and `Delta`/
/// `Done` only from the text answer.
#[derive(Debug)]
pub(super) enum TurnEvent {
    Delta(String),
    /// Text the model refused with, and the message it was stored as. A refusal is stored before
    /// it is streamed, so unlike a `Delta` it names the message it belongs to itself.
    Refusal {
        text: String,
        message_id: Uuid,
    },
    Item(StreamItem),
    /// An item the tool-call round stores itself, at its position among the round's other items,
    /// instead of leaving that to whichever loop consumes this event. The consumer converts and
    /// forwards it to the client exactly like `Item`, but must not persist it.
    ItemAnnounced(OutputItem),
    Messages(Vec<APIInputMessage>),
    /// The answer Azure finished, for the turn to store on the message it streamed from.
    Done {
        text: String,
        /// What the answer alone adds to the conversation's token count.
        used_tokens: i32,
    },
    /// The round ended in a tool call only the client can answer, so the turn ends here and is
    /// continued by the request that brings the answer.
    Suspended,
}

/// One item the turn reports to the client.
#[derive(Debug, Clone)]
pub(super) enum StreamItem {
    /// An item Azure sent, and whether this is its finished copy rather than the one that only
    /// announced it.
    Received { item: OutputItem, finished: bool },
    /// The output of a tool call this server answered itself. Azure sends no such item, and the
    /// round that ran the call has already stored the output, so all the client is owed is that
    /// the call it saw is finished.
    ServerToolOutput { call_id: String },
}

/// Frames one event as the NDJSON line the client reads: the wire format's single boundary.
pub(super) fn ndjson_line(event: &ChatbotChatStreamEvent) -> ChatbotResult<Bytes> {
    let mut line = serde_json::to_string(event)?;
    line.push('\n');
    Ok(Bytes::from(line))
}

/// The framed error event for a message this code raised itself, with no underlying [`ChatbotError`].
pub(super) fn error_event_from_text(message: &str) -> ChatbotResult<Bytes> {
    ndjson_line(&ChatbotChatStreamEvent::Error(StreamEventError {
        message: message.to_string(),
        details: None,
    }))
}

/// The framed error event for a failed [`ChatbotError`], detailing the Azure error when the
/// failure came with one.
pub(super) fn error_event_from_error(error: &ChatbotError) -> ChatbotResult<Bytes> {
    let details = match error.azure_source() {
        Some(source) => format!("{source}"),
        None => error.message().to_string(),
    };
    ndjson_line(&ChatbotChatStreamEvent::Error(StreamEventError {
        message: error.message().to_string(),
        details: Some(details),
    }))
}

/// A stream that carries one event and ends, for a response with no turn behind it.
pub(super) fn single_event_stream(
    event: ChatbotChatStreamEvent,
) -> ChatbotResult<Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>>> {
    let line = ndjson_line(&event)?;
    Ok(Box::pin(futures::stream::once(async move { Ok(line) })))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Suspended` is terminal for the frontend reader, which tells the variants apart by `type`
    /// alone, and like `Done` it carries no `data` key at all.
    #[test]
    fn the_suspended_event_serialises_without_a_data_key() {
        assert_eq!(
            serde_json::to_string(&ChatbotChatStreamEvent::Suspended).unwrap(),
            r#"{"type":"Suspended"}"#
        );
    }
}
