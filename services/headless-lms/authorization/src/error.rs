/*!
Contains error and result types for the authorization checks.
*/

use std::fmt::Display;
use std::panic::Location;

use backtrace::Backtrace;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::ModelError;
use headless_lms_utils::error::util_error::UtilError;
use tracing_error::SpanTrace;

/**
Used as the result type for all authorization checks.
*/
pub type AuthorizationResult<T> = Result<T, AuthorizationError>;

/// The type of [AuthorizationError] that occured.
#[derive(Debug, PartialEq, Eq)]
pub enum AuthorizationErrorType {
    /// There is no authenticated user, but the check needs one.
    Unauthorized,

    /// The user is known but is not allowed to perform the action.
    Forbidden,

    /// The check could not be completed, e.g. the user's roles could not be fetched.
    InternalServerError,

    /// The models layer failed while the check was loading the data it needs. The original
    /// [ModelError] is the source; recover it with [AuthorizationError::into_model_error]
    /// and map it the same way a directly returned `ModelError` is mapped, so that e.g. a
    /// check against a nonexistent page still answers "not found" rather than "server error".
    Model,
}

/**
Error type used by the authorization checks.

The message is meant to be seen by the user; the source carries the role and action detail
that is only useful to whoever is diagnosing the denial.

Build one with [`authorization_err!`]:

```ignore
authorization_err!(Unauthorized, "This course requires authentication to access".to_string());
authorization_err!(InternalServerError, "Failed to fetch user roles".to_string(), original_error);
```
*/
pub struct AuthorizationError {
    error_type: <AuthorizationError as BackendError>::ErrorType,
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

// Generate the clean developer `Debug`/`clean_string` and a cause resolver.
headless_lms_base::impl_clean_debug!(
    AuthorizationError,
    [AuthorizationError, ModelError, UtilError]
);

impl std::error::Error for AuthorizationError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source
            .as_deref()
            .map(|e| e as &(dyn std::error::Error + 'static))
    }

    fn cause(&self) -> Option<&dyn std::error::Error> {
        self.source()
    }
}

impl Display for AuthorizationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "AuthorizationError {:?} {:?}",
            self.error_type, self.message
        )
    }
}

impl BackendError for AuthorizationError {
    type ErrorType = AuthorizationErrorType;

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

impl AuthorizationError {
    /// Whether the check ran and refused, rather than failing to run at all. Consumers that
    /// answer a permission question with a boolean read a denial as "no" and everything else
    /// as a failure.
    pub fn is_denial(&self) -> bool {
        matches!(
            self.error_type,
            AuthorizationErrorType::Unauthorized | AuthorizationErrorType::Forbidden
        )
    }

    /// Unwraps an [AuthorizationErrorType::Model] error into the [ModelError] the check failed
    /// on, so that the caller can apply its own `ModelError` mapping instead of collapsing
    /// every data-loading failure into a single status code. Any other error is handed back
    /// unchanged.
    pub fn into_model_error(mut self) -> Result<ModelError, Self> {
        if !matches!(self.error_type, AuthorizationErrorType::Model) {
            return Err(self);
        }
        match self.source.take().map(|source| source.downcast()) {
            Some(Ok(model_error)) => Ok(model_error),
            Some(Err(source)) => {
                self.source = Some(source);
                Err(self)
            }
            None => Err(self),
        }
    }
}

impl From<ModelError> for AuthorizationError {
    fn from(err: ModelError) -> Self {
        let message = err.message().to_string();
        Self::new(AuthorizationErrorType::Model, message, Some(err.into()))
    }
}

headless_lms_utils::define_err_macro!(
    authorization_err,
    AuthorizationError,
    AuthorizationErrorType,
    AuthorizationErrorType,
    "Create an AuthorizationError with less boilerplate."
);

#[cfg(test)]
mod tests {
    use super::*;
    use headless_lms_models::ModelErrorType;

    #[test]
    fn into_model_error_recovers_the_wrapped_model_error() {
        let err = AuthorizationError::from(ModelError::new(
            ModelErrorType::RecordNotFound,
            "row missing".to_string(),
            None,
        ));

        let model_error = err.into_model_error().expect("model source");
        assert!(matches!(
            model_error.error_type(),
            ModelErrorType::RecordNotFound
        ));
    }

    #[test]
    fn into_model_error_hands_other_error_types_back() {
        let source = ModelError::new(ModelErrorType::Generic, "boom".to_string(), None);
        let err = authorization_err!(InternalServerError, "Denied".to_string(), source);

        let err = err.into_model_error().expect_err("not a model error");
        assert!(std::error::Error::source(&err).is_some());
    }

    #[test]
    fn only_refusals_are_denials() {
        assert!(authorization_err!(Forbidden, "no".to_string()).is_denial());
        assert!(authorization_err!(Unauthorized, "no".to_string()).is_denial());
        assert!(!authorization_err!(InternalServerError, "no".to_string()).is_denial());
    }
}
