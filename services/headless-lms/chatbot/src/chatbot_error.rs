/*!
Contains error and result types for all the chatbot functions.
*/

use std::fmt::Display;

use backtrace::Backtrace;
use headless_lms_models::ModelError;
use tracing_error::SpanTrace;

use headless_lms_utils::error::backend_error::BackendError;

/**
Used as the result types for all of chatbot.
*/
pub type ChatbotResult<T> = Result<T, ChatbotError>;

/// The type of [ChatbotError] that occured.
#[derive(Debug)]
pub enum ChatbotErrorType {
    InvalidMessageShape,
    InvalidToolName,
    InvalidToolArguments,
    ChatbotModelError,
    UrlParse,
    TokioIo,
    SerdeJson,
    Other,
    DeserializationError,
}

/**
Error type used in [ChatbotError], which is used for errors related to chatbot functionality.

All the information in the error is meant to be seen by the user. The type of error is determined by the [ChatbotErrorType] enum, which is stored inside this struct.

## Examples

### Usage without source error

```no_run
# use headless_lms_chatbot::prelude::*;
# fn random_function() -> ChatbotResult<()> {
#    let erroneous_condition = 1 == 1;
if erroneous_condition {
    return Err(ChatbotError::new(
        ChatbotErrorType::Other,
        "File not found".to_string(),
        None,
    ));
}
# Ok(())
# }
```

### Usage with a source error

Used when calling a function that returns an error that cannot be automatically converted to an ChatbotError. (See `impl From<X>` implementations on this struct.)

```no_run
# use headless_lms_chatbot::prelude::*;
# fn some_function_returning_an_error() -> ChatbotResult<()> {
#    return Err(ChatbotError::new(
#        ChatbotErrorType::Other,
#        "File not found".to_string(),
#        None,
#    ));
# }
#
# fn random_function() -> ChatbotResult<()> {
#    let erroneous_condition = 1 == 1;
some_function_returning_an_error().map_err(|original_error| {
    ChatbotError::new(
        ChatbotErrorType::Other,
        "Library x failed to do y".to_string(),
        Some(original_error.into()),
    )
})?;
# Ok(())
# }
```
*/
#[derive(Debug)]
pub struct ChatbotError {
    error_type: <ChatbotError as BackendError>::ErrorType,
    message: String,
    /// Original error that caused this error.
    source: Option<anyhow::Error>,
    /// A trace of tokio tracing spans, generated automatically when the error is generated.
    span_trace: Box<SpanTrace>,
    /// Stack trace, generated automatically when the error is created.
    backtrace: Box<Backtrace>,
}

impl std::error::Error for ChatbotError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source.as_ref().and_then(|o| o.source())
    }

    fn cause(&self) -> Option<&dyn std::error::Error> {
        self.source()
    }
}

impl Display for ChatbotError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ChatbotError {:?} {:?}", self.error_type, self.message)
    }
}

impl BackendError for ChatbotError {
    type ErrorType = ChatbotErrorType;

    fn new<M: Into<String>, S: Into<Option<anyhow::Error>>>(
        error_type: Self::ErrorType,
        message: M,
        source_error: S,
    ) -> Self {
        Self::new_with_traces(
            error_type,
            message,
            source_error,
            Backtrace::new(),
            SpanTrace::capture(),
        )
    }

    fn backtrace(&self) -> Option<&Backtrace> {
        Some(&self.backtrace)
    }

    fn error_type(&self) -> &Self::ErrorType {
        &self.error_type
    }

    fn message(&self) -> &str {
        &self.message
    }

    fn span_trace(&self) -> &SpanTrace {
        &self.span_trace
    }

    fn new_with_traces<M: Into<String>, S: Into<Option<anyhow::Error>>>(
        error_type: Self::ErrorType,
        message: M,
        source_error: S,
        backtrace: Backtrace,
        span_trace: SpanTrace,
    ) -> Self {
        Self {
            error_type,
            message: message.into(),
            source: source_error.into(),
            span_trace: Box::new(span_trace),
            backtrace: Box::new(backtrace),
        }
    }
}

impl From<url::ParseError> for ChatbotError {
    fn from(source: url::ParseError) -> Self {
        ChatbotError::new(
            ChatbotErrorType::UrlParse,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<tokio::io::Error> for ChatbotError {
    fn from(source: tokio::io::Error) -> Self {
        ChatbotError::new(
            ChatbotErrorType::TokioIo,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<serde_json::Error> for ChatbotError {
    fn from(source: serde_json::Error) -> Self {
        ChatbotError::new(
            ChatbotErrorType::SerdeJson,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<anyhow::Error> for ChatbotError {
    fn from(err: anyhow::Error) -> ChatbotError {
        Self::new(ChatbotErrorType::Other, err.to_string(), Some(err))
    }
}

impl From<ModelError> for ChatbotError {
    fn from(err: ModelError) -> ChatbotError {
        Self::new(
            ChatbotErrorType::ChatbotModelError,
            err.to_string(),
            Some(err.into()),
        )
    }
}
