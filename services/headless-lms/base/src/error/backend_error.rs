/*!
Contains a common trait for all the error types for this application.
*/

use std::panic::Location;

use backtrace::Backtrace;
use tracing_error::SpanTrace;

/// The error types of this program all implement this trait for interoperability.
pub trait BackendError: std::error::Error + std::marker::Sync {
    type ErrorType: std::fmt::Debug;

    /// Create a new error, capturing the caller's source location, a backtrace and the
    /// current tracing span trace.
    ///
    /// `#[track_caller]` makes [`Location::caller`] resolve to the real call site —
    /// including *through* the `*_err!` macro expansions — instead of this trait method.
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

    /// Create a new error with explicit backtrace and span trace (e.g. to preserve the
    /// traces of a source error), capturing the caller's source location.
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

    /// The single required constructor: stores the error type, message, optional source,
    /// backtrace, span trace and the raise location.
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

    /// The source location where the error was raised, if it was captured.
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
