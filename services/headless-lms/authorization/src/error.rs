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
    /// [ModelError] is the source; recover it with [AuthorizationError::take_model_source]
    /// and map it the same way a directly returned `ModelError` is mapped, so that e.g. a
    /// check against a nonexistent page still answers "not found" rather than "server error".
    Model,
}

/**
Error type used by the authorization checks.

The message is meant to be seen by the user; the source carries the role and action detail
that is only useful to whoever is diagnosing the denial.

## Examples

### Usage without source error

```no_run
# use headless_lms_authorization::error::{AuthorizationError, AuthorizationErrorType, AuthorizationResult};
# use headless_lms_base::error::backend_error::BackendError;
# fn random_function() -> AuthorizationResult<()> {
#    let erroneous_condition = 1 == 1;
if erroneous_condition {
    return Err(AuthorizationError::new(
        AuthorizationErrorType::Unauthorized,
        "This course requires authentication to access".to_string(),
        None,
    ));
}
# Ok(())
# }
```

### Usage with a source error

Used when calling a function that returns an error that cannot be automatically converted to
an AuthorizationError. (See `impl From<X>` implementations on this struct.)

```no_run
# use headless_lms_authorization::error::{AuthorizationError, AuthorizationErrorType, AuthorizationResult};
# use headless_lms_base::error::backend_error::BackendError;
# fn some_function_returning_an_error() -> AuthorizationResult<()> {
#    return Err(AuthorizationError::new(
#        AuthorizationErrorType::Forbidden,
#        "Denied".to_string(),
#        None,
#    ));
# }
#
# fn random_function() -> AuthorizationResult<()> {
some_function_returning_an_error().map_err(|original_error| {
    AuthorizationError::new(
        AuthorizationErrorType::InternalServerError,
        "Failed to fetch user roles".to_string(),
        Some(original_error.into()),
    )
})?;
# Ok(())
# }
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
    /// Takes the [ModelError] out of an [AuthorizationErrorType::Model] error so that the
    /// caller can apply its own `ModelError` mapping instead of collapsing every
    /// data-loading failure into a single status code. Returns `None` for every other error
    /// type, leaving the error untouched.
    pub fn take_model_source(&mut self) -> Option<ModelError> {
        if !matches!(self.error_type, AuthorizationErrorType::Model) {
            return None;
        }
        match self.source.take()?.downcast::<ModelError>() {
            Ok(model_error) => Some(model_error),
            Err(source) => {
                self.source = Some(source);
                None
            }
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
    fn take_model_source_recovers_the_wrapped_model_error() {
        let mut err = AuthorizationError::from(ModelError::new(
            ModelErrorType::RecordNotFound,
            "row missing".to_string(),
            None,
        ));

        let model_error = err.take_model_source().expect("model source");
        assert!(matches!(
            model_error.error_type(),
            ModelErrorType::RecordNotFound
        ));
        assert!(err.take_model_source().is_none());
    }

    #[test]
    fn take_model_source_leaves_other_error_types_alone() {
        let source = ModelError::new(ModelErrorType::Generic, "boom".to_string(), None);
        let mut err = authorization_err!(InternalServerError, "Denied".to_string(), source);

        assert!(err.take_model_source().is_none());
        assert!(std::error::Error::source(&err).is_some());
    }
}
