//! Opening the HTTP stream to Azure and handing it on as lines.

use std::pin::Pin;

use bytes::Bytes;
use futures::StreamExt;
use futures::stream::BoxStream;
use headless_lms_base::config::ApplicationConfiguration;
use tokio::io::AsyncBufReadExt;
use tokio_stream::wrappers::LinesStream;
use tokio_util::io::StreamReader;
use tracing::trace;

use super::protocol::LLMRequest;
use crate::chatbot_error::ChatbotResult;
use crate::llm_utils::make_streaming_llm_request;
use crate::prelude::*;

/// The lines of an Azure response body, as the stream parsers read them.
pub(crate) type ResponseLinesStream<'a> =
    Pin<Box<LinesStream<StreamReader<BoxStream<'a, Result<Bytes, std::io::Error>>, Bytes>>>>;
pub(crate) enum ResponseStreamType<'a> {
    ToolCall(ResponseLinesStream<'a>),
    TextResponse(ResponseLinesStream<'a>),
}

/// Wraps a byte stream as the lines the SSE parsers read, shared by production and tests so a
/// change to how lines are framed cannot drift between them.
pub(crate) fn lines_from_byte_stream(
    stream: BoxStream<'_, Result<Bytes, std::io::Error>>,
) -> ResponseLinesStream<'_> {
    Box::pin(LinesStream::new(StreamReader::new(stream).lines()))
}

/// Makes a request to Azure and returns the resulting stream.
pub(crate) async fn make_request_and_create_stream<'a>(
    chat_request: &LLMRequest,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<ResponseLinesStream<'a>> {
    let response = make_streaming_llm_request(chat_request, app_config).await?;

    trace!("Receiving chat response with {:?}", response.version());

    // Replaces the client-wide read timeout, which reqwest arms once per request rather than per
    // chunk, so it cannot tell a stalled stream from a slow but healthy one.
    let stream = tokio_stream::StreamExt::timeout(response.bytes_stream(), STREAM_IDLE_TIMEOUT)
        .map(|chunk| match chunk {
            Ok(bytes) => bytes.map_err(std::io::Error::other),
            Err(_) => Err(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                format!(
                    "The LLM stream sent nothing for {} seconds",
                    STREAM_IDLE_TIMEOUT.as_secs()
                ),
            )),
        })
        .boxed();

    Ok(lines_from_byte_stream(stream))
}
