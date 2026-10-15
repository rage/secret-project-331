//! Test helpers shared by more than one submodule's tests.

use bytes::Bytes;
use futures::StreamExt;
use futures::stream::BoxStream;

use super::azure::protocol::InputItem;
use super::azure::transport::{ResponseLinesStream, lines_from_byte_stream};
use crate::llm_utils::APIInputMessage;

/// Labels each replayed item so a test can assert the whole sequence, which `APIInputMessage`
/// is not comparable enough to do directly.
pub(super) fn shape(items: &[APIInputMessage]) -> Vec<String> {
    items
        .iter()
        .map(|item| match &item.message_type {
            InputItem::Message { role, .. } => format!("message:{role}"),
            InputItem::FunctionCall { call_id, .. } => format!("call:{call_id}"),
            InputItem::FunctionCallOutput { call_id, .. } => format!("output:{call_id}"),
            InputItem::Reasoning { id, .. } => format!("reasoning:{id}"),
        })
        .collect()
}

/// The lines of a streamed Azure response, as the stream parsers read them.
pub(super) fn azure_response_stream<'a>(lines: &[&str]) -> ResponseLinesStream<'a> {
    let body = format!("{}\n", lines.join("\n"));
    let bytes: BoxStream<'a, Result<Bytes, std::io::Error>> =
        futures::stream::once(async move { Ok(Bytes::from(body)) }).boxed();
    lines_from_byte_stream(bytes)
}
