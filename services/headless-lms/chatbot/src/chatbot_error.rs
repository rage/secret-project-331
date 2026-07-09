/*!
Contains error and result types for all the chatbot functions.
*/

use std::fmt::Display;
use std::panic::Location;

use backtrace::Backtrace;
use headless_lms_models::ModelError;
use headless_lms_utils::error::util_error::UtilError;
use tracing_error::SpanTrace;

use headless_lms_base::error::backend_error::BackendError;

use crate::search_filter::SearchFilterError;

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
    ChatbotMessageSuggestError,
    UrlParse,
    TokioIo,
    SerdeJson,
    SqlxError,
    ReqwestError,
    Other,
    DeserializationError,
    AzureAISearchFilterError,
    StreamingError,
    ContentCleaning,
    AzureRequestBuildError,
    FailedAzureResponse,
    SisuDescriptionError,
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
pub struct ChatbotError {
    error_type: <ChatbotError as BackendError>::ErrorType,
    message: String,
    /// Original error that caused this error.
    source: Option<anyhow::Error>,
    /// A trace of tokio tracing spans, generated automatically when the error is generated.
    span_trace: Box<SpanTrace>,
    /// Stack trace, generated automatically when the error is created.
    backtrace: Box<Backtrace>,
    /// Source location where the error was raised.
    location: Option<&'static Location<'static>>,
}

impl std::error::Error for ChatbotError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source
            .as_deref()
            .map(|e| e as &(dyn std::error::Error + 'static))
    }

    fn cause(&self) -> Option<&dyn std::error::Error> {
        self.source()
    }
}

// Generate the clean developer `Debug`/`clean_string` and a cause resolver.
headless_lms_base::impl_clean_debug!(ChatbotError, [ChatbotError, ModelError, UtilError]);

impl Display for ChatbotError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ChatbotError {:?} {:?}", self.error_type, self.message)
    }
}

impl BackendError for ChatbotError {
    type ErrorType = ChatbotErrorType;

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

    fn location(&self) -> Option<&'static Location<'static>> {
        self.location
    }

    fn new_with_traces_and_location<M: Into<String>, S: Into<Option<anyhow::Error>>>(
        error_type: Self::ErrorType,
        message: M,
        source_error: S,
        backtrace: Backtrace,
        span_trace: SpanTrace,
        location: Option<&'static Location<'static>>,
    ) -> Self {
        Self {
            error_type,
            message: message.into(),
            source: source_error.into(),
            span_trace: Box::new(span_trace),
            backtrace: Box::new(backtrace),
            location,
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

impl From<sqlx::Error> for ChatbotError {
    fn from(err: sqlx::Error) -> ChatbotError {
        ChatbotError::new(
            ChatbotErrorType::SqlxError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<reqwest::Error> for ChatbotError {
    fn from(err: reqwest::Error) -> ChatbotError {
        ChatbotError::new(
            ChatbotErrorType::ReqwestError,
            err.to_string(),
            Some(err.into()),
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

impl From<SearchFilterError> for ChatbotError {
    fn from(err: SearchFilterError) -> ChatbotError {
        Self::new(
            ChatbotErrorType::AzureAISearchFilterError,
            "Couldn't create search filter for AI search: ".to_string() + &err.to_string(),
            Some(err.into()),
        )
    }
}

// Generate error creation macros for ChatbotError
headless_lms_utils::define_err_macro!(
    chatbot_err,
    ChatbotError,
    ChatbotErrorType,
    ChatbotErrorType,
    "Create a ChatbotError with less boilerplate."
);

/// Helper function for `.map_err()` chains to wrap any error as ChatbotError.
///
/// This function creates a closure that converts any error into a `ChatbotError`
/// with the specified error type and message, including the original error as the source.
///
/// # Examples
///
/// ```ignore
/// // Instead of:
/// .map_err(|e| ChatbotError::new(ChatbotErrorType::Other, e.to_string(), Some(e.into())))?
///
/// // You can write:
/// .map_err(as_chatbot_error(ChatbotErrorType::Other, "Failed to process".to_string()))?
/// ```
pub fn as_chatbot_error<E>(
    error_type: ChatbotErrorType,
    message: impl Into<String>,
) -> impl FnOnce(E) -> ChatbotError
where
    E: Into<anyhow::Error>,
{
    let msg = message.into();
    move |e| ChatbotError::new(error_type, msg, Some(e.into()))
}

/// Helper function for `.ok_or_else()` to create ChatbotError on None.
///
/// This function creates a closure that generates a `ChatbotError` with the
/// specified error type and message when called.
///
/// # Examples
///
/// ```ignore
/// // Instead of:
/// .ok_or_else(|| ChatbotError::new(ChatbotErrorType::Other, "Item not found".to_string(), None))
///
/// // You can write:
/// .ok_or_else(missing_chatbot_error(ChatbotErrorType::Other, "Item not found".to_string()))
/// ```
pub fn missing_chatbot_error(
    error_type: ChatbotErrorType,
    message: impl Into<String>,
) -> impl FnOnce() -> ChatbotError {
    let msg = message.into();
    move || ChatbotError::new(error_type, msg, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chatbot_err_macro_without_source() {
        let err = chatbot_err!(Other, "Test error message".to_string());
        assert_eq!(err.message(), "Test error message");
        assert!(matches!(err.error_type(), ChatbotErrorType::Other));
    }

    #[test]
    fn test_chatbot_err_macro_with_source() {
        let source_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err = chatbot_err!(TokioIo, "Wrapped error".to_string(), source_err);
        assert_eq!(err.message(), "Wrapped error");
    }

    #[test]
    fn test_as_chatbot_error_helper() {
        let result: Result<(), std::io::Error> = Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "test error",
        ));
        let chatbot_result = result.map_err(as_chatbot_error(
            ChatbotErrorType::Other,
            "Failed to process".to_string(),
        ));

        assert!(chatbot_result.is_err());
        let err = chatbot_result.unwrap_err();
        assert_eq!(err.message(), "Failed to process");
        assert!(matches!(err.error_type(), ChatbotErrorType::Other));
    }

    #[test]
    fn test_missing_chatbot_error_helper() {
        let option: Option<String> = None;
        let result = option.ok_or_else(missing_chatbot_error(
            ChatbotErrorType::InvalidMessageShape,
            "Message not found".to_string(),
        ));

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.message(), "Message not found");
        assert!(matches!(
            err.error_type(),
            ChatbotErrorType::InvalidMessageShape
        ));
    }

    #[test]
    fn test_chatbot_err_with_format() {
        let tool_name = "test_tool";
        let err = chatbot_err!(InvalidToolName, format!("Unknown tool: {}", tool_name));
        assert_eq!(err.message(), "Unknown tool: test_tool");
    }

    /// A three-crate chain (ChatbotError, ModelError, UtilError) renders every link as
    /// its own node, checking the resolver reaches transitively-wrapped errors.
    #[test]
    fn debug_renders_deep_cross_crate_chain() {
        use headless_lms_utils::error::util_error::UtilErrorType;
        let util_error = UtilError::new(UtilErrorType::Other, "disk on fire".to_string(), None);
        let model_error = ModelError::from(util_error);
        let chatbot_error = ChatbotError::from(model_error);

        let debug = format!("{chatbot_error:?}");
        assert!(
            debug.contains("ChatbotError · ChatbotModelError"),
            "got: {debug}"
        );
        assert!(debug.contains("caused by:"), "got: {debug}");
        assert!(debug.contains("1. ModelError · Util"), "got: {debug}");
        assert!(
            debug.contains("2. UtilError · Other: disk on fire"),
            "got: {debug}"
        );
        assert!(!debug.contains("(external)"), "got: {debug}");
    }

    /// A non-`BackendError` cause is rendered as a message-only `(external)` leaf.
    #[test]
    fn debug_tags_external_cause() {
        let io_error = std::io::Error::other("connection reset");
        let chatbot_error = chatbot_err!(TokioIo, "request failed".to_string(), io_error);

        let debug = format!("{chatbot_error:?}");
        assert!(
            debug.contains("ChatbotError · TokioIo: request failed"),
            "got: {debug}"
        );
        assert!(
            debug.contains("connection reset  (external)"),
            "got: {debug}"
        );
    }
}
