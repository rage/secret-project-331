//! Streaming a text answer to the learner, and handing it to the turn once Azure has finished it.

use std::sync::Arc;

use futures::StreamExt;
use futures::stream::BoxStream;
use tokio::sync::Mutex;
use tracing::trace;

use crate::azure_chatbot::azure::protocol::{
    OutputItem, ReceivedOutputItem, ResponseOutput, check_response_complete, check_response_output,
};
use crate::azure_chatbot::azure::sse::{AzureStreamEvent, ParsedResponseLine};
use crate::azure_chatbot::azure::transport::ResponseLinesStream;
use crate::azure_chatbot::events::{StreamItem, TurnEvent};
use crate::chatbot_error::ChatbotResult;
use crate::llm_utils::estimate_tokens;
use crate::prelude::*;

/// Parses the rest of a round already classified as a text answer, to the end of the Azure stream.
///
/// Yields [`TurnEvent::Delta`] per streamed token, [`TurnEvent::Item`] for the non-message items
/// that accompany it, and [`TurnEvent::Done`] with the finished answer, which the caller stores.
/// Every delta is also appended to `full_response_text`, so that the cancellation guard knows what
/// it may still save for a turn that never reaches `Done`. Errors if Azure reports a failure, if a
/// tool call arrives mid-answer, or if the stream ends unfinished.
pub(super) async fn parse_text_response<'a>(
    mut lines: ResponseLinesStream<'a>,
    full_response_text: Arc<Mutex<String>>,
    response_id: String,
) -> BoxStream<'a, ChatbotResult<TurnEvent>> {
    trace!("Parsing stream to user...");

    let mut response_received = false;
    let mut response_incomplete = false;
    let mut preceding_event: Option<AzureStreamEvent> = None;

    Box::pin(async_stream::try_stream! {
        while let Some(val) = lines.next().await {
            let line = val?;
            let response_output: ResponseOutput = match ParsedResponseLine::parse(&line)? {
                Some(ParsedResponseLine::Event(event)) => {
                    trace!("Event: {event:?}");
                    match &event {
                        AzureStreamEvent::ResponseCompleted => {response_received = true;},
                        AzureStreamEvent::Incomplete => {response_received = true; response_incomplete = true;},
                        AzureStreamEvent::FunctionCallArgumentsDelta | AzureStreamEvent::CustomToolCallInputDelta => {
                            error!("ERROR, function call received but can't be processed while streaming to user.");
                            return Err(chatbot_err!(UnexpectedProtocolShape, "Unexpected function call while streaming to user"))?
                        },
                        AzureStreamEvent::ErrorReported => {
                            // error is logged in the next iteration
                        }
                        _ => {}
                    };
                    preceding_event = Some(event);
                    continue;
                },
                Some(ParsedResponseLine::Data(data)) => *data,
                None => {continue;},
            };

            let event = AzureStreamEvent::of_data_line(preceding_event.take(), response_output.response_type.as_deref());

            check_response_output(&response_output, Some(&response_id), "streaming_answer")?;

            // Locked only where the transcript is actually touched: `?` inside `try_stream!`
            // parks the generator instead of returning, so a guard alive at one would never be
            // released and the turn's cleanup would wait on it forever.
            if response_received {
                // An answer Azure cut short must not be stored or shown as a finished one, so it
                // ends the turn as an error even though its text is kept.
                check_response_complete(&response_output, response_incomplete)?;
                let full_response_as_string = full_response_text.lock().await.clone();
                // todo: use the tokens given in the response
                let estimated_cost = estimate_tokens(&full_response_as_string);
                trace!(
                    "End of chatbot response stream. Estimated cost: {}. Response: {}",
                    estimated_cost, full_response_as_string
                );
                // Only the answer's own tokens. The conversation the request carried is already
                // counted on the messages it is built from, and a turn suspended on a client tool
                // call carries that same prefix again in every request that resumes it.
                yield TurnEvent::Done { text: full_response_as_string, used_tokens: estimated_cost };
                return;
            }

            // A reasoning summary streams its own deltas on the same `delta` field; only the
            // answer's belong in what the learner reads and what gets stored as the answer.
            if let Some(delta) = response_output.delta
                && matches!(event, Some(AzureStreamEvent::OutputTextDelta | AzureStreamEvent::RefusalDelta))
            {
                full_response_text.lock().await.push_str(&delta);
                yield TurnEvent::Delta(delta);
            }

            if let Some(item) = response_output.item.and_then(ReceivedOutputItem::known) {
                match item {
                    OutputItem::Message { .. } => continue,
                    OutputItem::FunctionCall { .. } => Err(chatbot_err!(UnexpectedProtocolShape, "Error: unexpected function call after / during a text response.".to_string()))?,
                    item => {
                        let finished = matches!(event, Some(AzureStreamEvent::OutputItemDone));
                        yield TurnEvent::Item(StreamItem::Received { item, finished });
                        continue;
                    },
                };
            }
        }
        // Reached only when Azure stopped sending before it completed the response.
        Err(chatbot_err!(StreamEndedEarly, "Stream ended unexpectedly"))?;
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::azure_chatbot::test_helpers::azure_response_stream;

    /// `Done` reports `used_tokens` as the estimate of the deltas this call streamed, not of
    /// anything the caller may have seeded `full_response_text` with. Whether that accumulator
    /// really starts empty for every round is `stream_turn`'s guarantee, not this parser's — this
    /// only pins what `parse_text_response` itself computes from it.
    #[tokio::test]
    async fn done_reports_the_token_estimate_of_the_streamed_deltas() {
        let answer = "A for loop.";

        let mut events = parse_text_response(
            azure_response_stream(&[
                "event: response.output_text.delta",
                &format!(r#"data: {{"type":"response.output_text.delta","delta":"{answer}"}}"#),
                "event: response.completed",
                r#"data: {"type":"response.completed","response":{"id":"resp_answer"}}"#,
            ]),
            Arc::new(Mutex::new(String::new())),
            "resp_answer".to_string(),
        )
        .await;

        let mut finished = None;
        while let Some(event) = events.next().await {
            if let TurnEvent::Done { text, used_tokens } =
                event.expect("the response streams to the end")
            {
                finished = Some((text, used_tokens));
            }
        }

        assert_eq!(
            finished.expect("the answer finishes"),
            (answer.to_string(), estimate_tokens(answer))
        );
    }

    /// A proxy that closes the body early must not read as an answer with nothing left to say.
    #[tokio::test]
    async fn a_stream_that_ends_before_response_completed_errors() {
        let mut events = parse_text_response(
            azure_response_stream(&[
                "event: response.output_text.delta",
                r#"data: {"type":"response.output_text.delta","delta":"Cut off"}"#,
            ]),
            Arc::new(Mutex::new(String::new())),
            "resp_answer".to_string(),
        )
        .await;

        let error = loop {
            match events.next().await.expect("the stream ends in an error") {
                Ok(TurnEvent::Delta(_)) => continue,
                Ok(other) => panic!("expected only a delta before the error, got {other:?}"),
                Err(error) => break error,
            }
        };
        assert_eq!(*error.error_type(), ChatbotErrorType::StreamEndedEarly);
    }

    /// `max_output_tokens` truncation ends the round on `response.incomplete` instead of
    /// `response.completed`, and the answer must not be reported as finished.
    #[tokio::test]
    async fn a_response_incomplete_event_errors_instead_of_finishing() {
        let mut events = parse_text_response(
            azure_response_stream(&[
                "event: response.output_text.delta",
                r#"data: {"type":"response.output_text.delta","delta":"Cut off"}"#,
                "event: response.incomplete",
                r#"data: {"type":"response.incomplete","response":{"id":"resp_answer","incomplete_details":{"reason":"max_output_tokens"}}}"#,
            ]),
            Arc::new(Mutex::new(String::new())),
            "resp_answer".to_string(),
        )
        .await;

        let error = loop {
            match events.next().await.expect("the stream ends in an error") {
                Ok(TurnEvent::Delta(_)) => continue,
                Ok(other) => panic!("expected only a delta before the error, got {other:?}"),
                Err(error) => break error,
            }
        };
        assert_eq!(*error.error_type(), ChatbotErrorType::ResponseIncomplete);
    }
}
