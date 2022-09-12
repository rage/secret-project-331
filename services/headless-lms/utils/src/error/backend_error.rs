use backtrace::Backtrace;
use tracing_error::SpanTrace;

/// The error types of this program all implement this trait for interoperability.
pub trait BackendError: std::error::Error {
    type ErrorType: std::fmt::Debug;

    fn new(
        error_type: Self::ErrorType,
        message: String,
        source_error: Option<Box<dyn std::error::Error>>,
    ) -> Self;

    fn backtrace(&self) -> Option<&Backtrace>;

    fn error_type(&self) -> &Self::ErrorType;

    fn message(&self) -> &str;

    fn span_trace(&self) -> &SpanTrace;

    fn to_different_error<T>(self, new_error_type: T::ErrorType, new_message: String) -> T
    where
        T: BackendError,
        Self: Sized + 'static,
    {
        T::new(new_error_type, new_message, Some(Box::new(self)))
    }
}
