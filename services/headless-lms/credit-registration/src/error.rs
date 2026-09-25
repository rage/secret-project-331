//! The error of a phase iteration that could not do its job. What a Suotar answer does to a row, a
//! row another writer moved on, or a breaker holding a phase back are values, not errors.

use std::fmt::Display;
use std::panic::Location;

use backtrace::Backtrace;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::ModelError;
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::periodic_worker::is_db_disconnect;
use tracing_error::SpanTrace;

pub type CreditRegistrationResult<T> = Result<T, CreditRegistrationError>;

/// The type of [`CreditRegistrationError`] that occurred.
#[derive(Debug, PartialEq, Eq)]
pub enum CreditRegistrationErrorType {
    /// A models call failed. The [`ModelError`] is the source; see
    /// [`CreditRegistrationError::into_model_error`].
    Model,
    /// The pool, or a transaction's begin or commit.
    Database,
}

pub struct CreditRegistrationError {
    error_type: <CreditRegistrationError as BackendError>::ErrorType,
    message: String,
    source: Option<anyhow::Error>,
    span_trace: Box<SpanTrace>,
    backtrace: Box<Backtrace>,
    location: Option<&'static Location<'static>>,
}

impl std::error::Error for CreditRegistrationError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source
            .as_deref()
            .map(|e| e as &(dyn std::error::Error + 'static))
    }

    fn cause(&self) -> Option<&dyn std::error::Error> {
        self.source()
    }
}

headless_lms_base::impl_clean_debug!(
    CreditRegistrationError,
    [CreditRegistrationError, ModelError, UtilError]
);

impl Display for CreditRegistrationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "CreditRegistrationError {:?} {:?}",
            self.error_type, self.message
        )
    }
}

impl BackendError for CreditRegistrationError {
    type ErrorType = CreditRegistrationErrorType;

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

impl CreditRegistrationError {
    /// Unwraps a [`CreditRegistrationErrorType::Model`] error into its [`ModelError`], so a
    /// controller maps it as it maps any other, and a missing course still answers 404. Any other
    /// error is handed back unchanged.
    pub fn into_model_error(mut self) -> Result<ModelError, Self> {
        if self.error_type != CreditRegistrationErrorType::Model {
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

    /// Whether the database connection was lost anywhere in the cause chain; see
    /// [`is_db_disconnect`].
    pub fn is_db_disconnect(&self) -> bool {
        std::iter::successors(Some(self as &(dyn std::error::Error + 'static)), |error| {
            error.source()
        })
        .any(|error| is_db_disconnect(Some(error)))
    }
}

impl From<ModelError> for CreditRegistrationError {
    #[track_caller]
    fn from(err: ModelError) -> Self {
        Self::new(
            CreditRegistrationErrorType::Model,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<sqlx::Error> for CreditRegistrationError {
    #[track_caller]
    fn from(err: sqlx::Error) -> Self {
        Self::new(
            CreditRegistrationErrorType::Database,
            err.to_string(),
            Some(err.into()),
        )
    }
}

headless_lms_utils::define_err_macro!(
    credit_registration_err,
    CreditRegistrationError,
    CreditRegistrationErrorType,
    CreditRegistrationErrorType,
    "Create a CreditRegistrationError with less boilerplate."
);
