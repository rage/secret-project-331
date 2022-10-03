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
    span_trace: SpanTrace,
    /// Stack trace, generated automatically when the error is created.
    backtrace: Backtrace,
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

    fn new(
        error_type: Self::ErrorType,
        message: String,
        source_error: Option<anyhow::Error>,
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

    fn new_with_traces(
        error_type: Self::ErrorType,
        message: String,
        source_error: Option<anyhow::Error>,
        backtrace: Backtrace,
        span_trace: SpanTrace,
    ) -> Self {
        Self {
            error_type,
            message,
            source: source_error,
            span_trace,
            backtrace,
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
