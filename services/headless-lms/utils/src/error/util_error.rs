/*!
Contains error and result types for all the util functions.
*/

use std::fmt::Display;

use backtrace::Backtrace;
use tracing_error::SpanTrace;

use super::backend_error::BackendError;

/**
Used as the result types for all utils.

See also [UtilError] for documentation on how to return errors from models.
*/
pub type UtilResult<T> = Result<T, UtilError>;

/// The type of [UtilError] that occured.
#[derive(Debug)]
pub enum UtilErrorType {
    UrlParse,
    Walkdir,
    StripPrefix,
    TokioIo,
    SerdeJson,
    CloudStorage,
    Other,
    Unavailable,
    DeserializationError,
    TmcHttpError,
    TmcErrorResponse,
}

/**
Error type used by all models. Used as the error type in [UtilError], which is used by all the controllers in the application.

All the information in the error is meant to be seen by the user. The type of error is determined by the [UtilErrorType] enum, which is stored inside this struct.

## Examples

### Usage without source error

```no_run
# use headless_lms_utils::prelude::*;
# fn random_function() -> UtilResult<()> {
#    let erroneous_condition = 1 == 1;
if erroneous_condition {
    return Err(UtilError::new(
        UtilErrorType::Other,
        "File not found".to_string(),
        None,
    ));
}
# Ok(())
# }
```

### Usage with a source error

Used when calling a function that returns an error that cannot be automatically converted to an UtilError. (See `impl From<X>` implementations on this struct.)

```no_run
# use headless_lms_utils::prelude::*;
# fn some_function_returning_an_error() -> UtilResult<()> {
#    return Err(UtilError::new(
#        UtilErrorType::Other,
#        "File not found".to_string(),
#        None,
#    ));
# }
#
# fn random_function() -> UtilResult<()> {
#    let erroneous_condition = 1 == 1;
some_function_returning_an_error().map_err(|original_error| {
    UtilError::new(
        UtilErrorType::Other,
        "Library x failed to do y".to_string(),
        Some(original_error.into()),
    )
})?;
# Ok(())
# }
```
*/
#[derive(Debug)]
pub struct UtilError {
    error_type: <UtilError as BackendError>::ErrorType,
    message: String,
    /// Original error that caused this error.
    source: Option<anyhow::Error>,
    /// A trace of tokio tracing spans, generated automatically when the error is generated.
    span_trace: Box<SpanTrace>,
    /// Stack trace, generated automatically when the error is created.
    backtrace: Box<Backtrace>,
}

impl std::error::Error for UtilError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source.as_ref().and_then(|o| o.source())
    }

    fn cause(&self) -> Option<&dyn std::error::Error> {
        self.source()
    }
}

impl Display for UtilError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "UtilError {:?} {:?}", self.error_type, self.message)
    }
}

impl BackendError for UtilError {
    type ErrorType = UtilErrorType;

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

impl From<url::ParseError> for UtilError {
    fn from(source: url::ParseError) -> Self {
        UtilError::new(
            UtilErrorType::UrlParse,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<walkdir::Error> for UtilError {
    fn from(source: walkdir::Error) -> Self {
        UtilError::new(
            UtilErrorType::Walkdir,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<std::path::StripPrefixError> for UtilError {
    fn from(source: std::path::StripPrefixError) -> Self {
        UtilError::new(
            UtilErrorType::StripPrefix,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<tokio::io::Error> for UtilError {
    fn from(source: tokio::io::Error) -> Self {
        UtilError::new(
            UtilErrorType::TokioIo,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<serde_json::Error> for UtilError {
    fn from(source: serde_json::Error) -> Self {
        UtilError::new(
            UtilErrorType::SerdeJson,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<cloud_storage::Error> for UtilError {
    fn from(source: cloud_storage::Error) -> Self {
        UtilError::new(
            UtilErrorType::CloudStorage,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<anyhow::Error> for UtilError {
    fn from(err: anyhow::Error) -> UtilError {
        Self::new(UtilErrorType::Other, err.to_string(), Some(err))
    }
}

// Generate error creation macros for UtilError
crate::define_err_macro!(
    util_err,
    UtilError,
    UtilErrorType,
    "Create a UtilError with less boilerplate."
);

/// Helper function for `.map_err()` chains to wrap any error as UtilError.
///
/// This function creates a closure that converts any error into a `UtilError`
/// with the specified error type and message, including the original error as the source.
///
/// # Examples
///
/// ```ignore
/// // Instead of:
/// .map_err(|e| UtilError::new(UtilErrorType::Other, e.to_string(), Some(e.into())))?
///
/// // You can write:
/// .map_err(as_util_error(UtilErrorType::Other, "Failed to process".to_string()))?
/// ```
pub fn as_util_error<E>(
    error_type: UtilErrorType,
    message: impl Into<String>,
) -> impl FnOnce(E) -> UtilError
where
    E: Into<anyhow::Error>,
{
    let msg = message.into();
    move |e| UtilError::new(error_type, msg, Some(e.into()))
}

/// Helper function for `.ok_or_else()` to create UtilError on None.
///
/// This function creates a closure that generates a `UtilError` with the
/// specified error type and message when called.
///
/// # Examples
///
/// ```ignore
/// // Instead of:
/// .ok_or_else(|| UtilError::new(UtilErrorType::Other, "Item not found".to_string(), None))
///
/// // You can write:
/// .ok_or_else(missing_util_error(UtilErrorType::Other, "Item not found".to_string()))
/// ```
pub fn missing_util_error(
    error_type: UtilErrorType,
    message: impl Into<String>,
) -> impl FnOnce() -> UtilError {
    let msg = message.into();
    move || UtilError::new(error_type, msg, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_util_err_macro_without_source() {
        let err = util_err!(Other, "Test error message".to_string());
        assert_eq!(err.message(), "Test error message");
        assert!(matches!(err.error_type(), UtilErrorType::Other));
    }

    #[test]
    fn test_util_err_macro_with_source() {
        let source_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err = util_err!(TokioIo, "Wrapped error".to_string(), source_err);
        assert_eq!(err.message(), "Wrapped error");
    }

    #[test]
    fn test_as_util_error_helper() {
        let result: Result<(), std::io::Error> = Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "test error",
        ));
        let util_result = result.map_err(as_util_error(
            UtilErrorType::TokioIo,
            "Failed to read file".to_string(),
        ));

        assert!(util_result.is_err());
        let err = util_result.unwrap_err();
        assert_eq!(err.message(), "Failed to read file");
        assert!(matches!(err.error_type(), UtilErrorType::TokioIo));
    }

    #[test]
    fn test_missing_util_error_helper() {
        let option: Option<String> = None;
        let result = option.ok_or_else(missing_util_error(
            UtilErrorType::Other,
            "Item not found".to_string(),
        ));

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.message(), "Item not found");
        assert!(matches!(err.error_type(), UtilErrorType::Other));
    }

    #[test]
    fn test_util_err_with_format() {
        let path = "/tmp/test.txt";
        let err = util_err!(Other, format!("Failed to process file: {}", path));
        assert_eq!(err.message(), "Failed to process file: /tmp/test.txt");
    }
}
