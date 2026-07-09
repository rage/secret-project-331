/*!
Contains a common trait for all the error types for this application.
*/

use std::panic::Location;

use backtrace::Backtrace;
use tracing_error::SpanTrace;

/// The error types of this program all implement this trait for interoperability.
pub trait BackendError: std::error::Error + std::marker::Sync {
    type ErrorType: std::fmt::Debug;

    /// Create an error, capturing the caller's location, a backtrace and the span trace.
    ///
    /// `#[track_caller]` makes [`Location::caller`] resolve to the real call site, even
    /// through the `*_err!` macros, rather than to this method.
    #[track_caller]
    fn new<M: Into<String>, S: Into<Option<anyhow::Error>>>(
        error_type: Self::ErrorType,
        message: M,
        source_error: S,
    ) -> Self
    where
        Self: Sized,
    {
        Self::new_with_traces_and_location(
            error_type,
            message,
            source_error,
            Backtrace::new_unresolved(),
            SpanTrace::capture(),
            Some(Location::caller()),
        )
    }

    /// Like [`new`](Self::new) but with an explicit backtrace and span trace, e.g. to
    /// preserve a source error's traces.
    #[track_caller]
    fn new_with_traces<M: Into<String>, S: Into<Option<anyhow::Error>>>(
        error_type: Self::ErrorType,
        message: M,
        source_error: S,
        backtrace: Backtrace,
        span_trace: SpanTrace,
    ) -> Self
    where
        Self: Sized,
    {
        Self::new_with_traces_and_location(
            error_type,
            message,
            source_error,
            backtrace,
            span_trace,
            Some(Location::caller()),
        )
    }

    /// The one required constructor; the others delegate to it.
    fn new_with_traces_and_location<M: Into<String>, S: Into<Option<anyhow::Error>>>(
        error_type: Self::ErrorType,
        message: M,
        source_error: S,
        backtrace: Backtrace,
        span_trace: SpanTrace,
        location: Option<&'static Location<'static>>,
    ) -> Self;

    fn backtrace(&self) -> Option<&Backtrace>;

    fn error_type(&self) -> &Self::ErrorType;

    fn message(&self) -> &str;

    fn span_trace(&self) -> &SpanTrace;

    /// Source location where the error was raised, if captured.
    fn location(&self) -> Option<&'static Location<'static>>;

    #[track_caller]
    fn to_different_error<T>(self, new_error_type: T::ErrorType, new_message: String) -> T
    where
        T: BackendError,
        Self: Sized + 'static + std::marker::Send,
    {
        T::new(new_error_type, new_message, Some(self.into()))
    }
}
