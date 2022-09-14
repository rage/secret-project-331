use backtrace::Backtrace;
use tracing_error::SpanTrace;

/// The error types of this program all implement this trait for interoperability.
pub trait BackendError: std::error::Error + std::marker::Sync {
    type ErrorType: std::fmt::Debug;

    fn new(
        error_type: Self::ErrorType,
        message: String,
        source_error: Option<anyhow::Error>,
    ) -> Self;

    fn new_with_traces(
        error_type: Self::ErrorType,
        message: String,
        source_error: Option<anyhow::Error>,
        backtrace: Backtrace,
        span_trace: SpanTrace,
    ) -> Self;

    fn backtrace(&self) -> Option<&Backtrace>;

    fn error_type(&self) -> &Self::ErrorType;

    fn message(&self) -> &str;

    fn span_trace(&self) -> &SpanTrace;

    fn to_different_error<T>(self, new_error_type: T::ErrorType, new_message: String) -> T
    where
        T: BackendError,
        Self: Sized + 'static + std::marker::Send,
    {
        T::new(new_error_type, new_message, Some(self.into()))
    }
}
