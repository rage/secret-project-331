/*!
Contains error and result types for all the model functions.
*/

use std::panic::Location;
use std::{fmt::Display, num::TryFromIntError};

use backtrace::Backtrace;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_utils::error::util_error::UtilError;
use tracing_error::SpanTrace;
use uuid::Uuid;

/**
Used as the result types for all models.

See also [ModelError] for documentation on how to return errors from models.
*/
pub type ModelResult<T> = Result<T, ModelError>;

pub trait TryToOptional<T, E> {
    fn optional(self) -> Result<Option<T>, E>
    where
        Self: Sized;
}

impl<T> TryToOptional<T, ModelError> for ModelResult<T> {
    fn optional(self) -> Result<Option<T>, ModelError> {
        match self {
            Ok(val) => Ok(Some(val)),
            Err(err) => {
                if err.error_type == ModelErrorType::RecordNotFound {
                    Ok(None)
                } else {
                    Err(err)
                }
            }
        }
    }
}

/**
Error type used by all models. Used as the error type in [ModelError], which is used by all the controllers in the application.

All the information in the error is meant to be seen by the user. The type of error is determined by the [ModelErrorType] enum, which is stored inside this struct.

## Examples

### Usage without source error

```no_run
# use headless_lms_models::prelude::*;
# fn random_function() -> ModelResult<()> {
#    let erroneous_condition = 1 == 1;
if erroneous_condition {
    return Err(ModelError::new(
        ModelErrorType::PreconditionFailed,
        "The user has not enrolled to this course".to_string(),
        None,
    ));
}
# Ok(())
# }
```

### Usage with a source error

Used when calling a function that returns an error that cannot be automatically converted to an ModelError. (See `impl From<X>` implementations on this struct.)

```no_run
# use headless_lms_models::prelude::*;
# fn some_function_returning_an_error() -> ModelResult<()> {
#    return Err(ModelError::new(
#        ModelErrorType::PreconditionFailed,
#        "The user has not enrolled to this course".to_string(),
#        None,
#    ));
# }
#
# fn random_function() -> ModelResult<()> {
#    let erroneous_condition = 1 == 1;
some_function_returning_an_error().map_err(|original_error| {
    ModelError::new(
        ModelErrorType::Generic,
        "Everything went wrong".to_string(),
        Some(original_error.into()),
    )
})?;
# Ok(())
# }
```
*/
pub struct ModelError {
    error_type: ModelErrorType,
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

impl std::error::Error for ModelError {
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
headless_lms_base::impl_clean_debug!(ModelError, [ModelError, UtilError]);

impl Display for ModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ModelError {:?} {:?}", self.error_type, self.message)
    }
}

impl BackendError for ModelError {
    type ErrorType = ModelErrorType;

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

/// The type of [ModelError] that occured.
#[derive(Debug, PartialEq, Eq)]
pub enum ModelErrorType {
    RecordNotFound,
    NotFound,
    /// matched in From<sqlx::Error> for ModelError to get the constraint that was violated
    DatabaseConstraint {
        constraint: String,
        description: &'static str,
    },
    PreconditionFailed,
    PreconditionFailedWithCMSAnchorBlockId {
        id: Uuid,
        description: &'static str,
    },
    InvalidRequest,
    Conversion,
    Database,
    Json,
    Util,
    Generic,
    HttpRequest {
        status_code: u16,
        response_body: String,
    },
    /// HTTP request failed with specific error details
    HttpError {
        error_type: HttpErrorType,
        reason: String,
        status_code: Option<u16>,
        response_body: Option<String>,
    },
}

/// Types of HTTP errors that can occur
#[derive(Debug, PartialEq, Eq)]
pub enum HttpErrorType {
    /// HTTP request failed due to network connection issues
    ConnectionFailed,
    /// HTTP request failed due to timeout
    Timeout,
    /// HTTP request failed due to redirect issues
    RedirectFailed,
    /// HTTP request failed due to request building issues
    RequestBuildFailed,
    /// HTTP request failed due to response body issues
    BodyFailed,
    /// HTTP request succeeded but response body could not be decoded as JSON
    ResponseDecodeFailed,
    /// HTTP request failed with non-success status code
    StatusError,
    /// Unknown HTTP error type
    Unknown,
}

impl From<sqlx::Error> for ModelError {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::RowNotFound => ModelError::new(
                ModelErrorType::RecordNotFound,
                err.to_string(),
                Some(err.into()),
            ),
            sqlx::Error::Database(db_err) => {
                if let Some(constraint) = db_err.constraint() {
                    match constraint {
                        "email_templates_subject_check" => ModelError::new(
                            ModelErrorType::DatabaseConstraint {
                                constraint: constraint.to_string(),
                                description: "Subject must not be null",
                            },
                            err.to_string(),
                            Some(err.into()),
                        ),
                        "user_details_email_check" => ModelError::new(
                            ModelErrorType::DatabaseConstraint {
                                constraint: constraint.to_string(),
                                description: "Email must contain an '@' symbol.",
                            },
                            err.to_string(),
                            Some(err.into()),
                        ),
                        "users_email" => ModelError::new(
                            ModelErrorType::DatabaseConstraint {
                                constraint: constraint.to_string(),
                                description: "Email is already in use.",
                            },
                            err.to_string(),
                            Some(err.into()),
                        ),
                        "users_upstream_id_active_uniq_idx" => ModelError::new(
                            ModelErrorType::DatabaseConstraint {
                                constraint: constraint.to_string(),
                                description: "A user with this upstream id already exists.",
                            },
                            err.to_string(),
                            Some(err.into()),
                        ),
                        "unique_chatbot_names_within_course" => ModelError::new(
                            ModelErrorType::DatabaseConstraint {
                                constraint: constraint.to_string(),
                                description: "The chatbot name is already taken by another chatbot on this course",
                            },
                            err.to_string(),
                            Some(err.into()),
                        ),
                        _ => ModelError::new(
                            ModelErrorType::Database,
                            err.to_string(),
                            Some(err.into()),
                        ),
                    }
                } else {
                    ModelError::new(ModelErrorType::Database, err.to_string(), Some(err.into()))
                }
            }
            _ => ModelError::new(ModelErrorType::Database, err.to_string(), Some(err.into())),
        }
    }
}

impl std::convert::From<TryFromIntError> for ModelError {
    fn from(source: TryFromIntError) -> Self {
        ModelError::new(
            ModelErrorType::Conversion,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl std::convert::From<serde_json::Error> for ModelError {
    fn from(source: serde_json::Error) -> Self {
        ModelError::new(
            ModelErrorType::Json,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl std::convert::From<UtilError> for ModelError {
    fn from(source: UtilError) -> Self {
        ModelError::new(
            ModelErrorType::Util,
            source.to_string(),
            Some(source.into()),
        )
    }
}

impl From<anyhow::Error> for ModelError {
    fn from(err: anyhow::Error) -> ModelError {
        Self::new(ModelErrorType::Conversion, err.to_string(), Some(err))
    }
}

impl From<url::ParseError> for ModelError {
    fn from(err: url::ParseError) -> ModelError {
        Self::new(ModelErrorType::Generic, err.to_string(), Some(err.into()))
    }
}

impl From<reqwest::Error> for ModelError {
    fn from(err: reqwest::Error) -> Self {
        let error_type = if err.is_decode() {
            HttpErrorType::ResponseDecodeFailed
        } else if err.is_timeout() {
            HttpErrorType::Timeout
        } else if err.is_connect() {
            HttpErrorType::ConnectionFailed
        } else if err.is_redirect() {
            HttpErrorType::RedirectFailed
        } else if err.is_builder() {
            HttpErrorType::RequestBuildFailed
        } else if err.is_body() {
            HttpErrorType::BodyFailed
        } else if err.is_status() {
            HttpErrorType::StatusError
        } else {
            HttpErrorType::Unknown
        };

        let status_code = err.status().map(|s| s.as_u16());
        let response_body = if err.is_decode() {
            Some("Failed to decode JSON response".to_string())
        } else {
            None
        };

        ModelError::new(
            ModelErrorType::HttpError {
                error_type,
                reason: err.to_string(),
                status_code,
                response_body,
            },
            format!("HTTP request failed: {}", err),
            Some(err.into()),
        )
    }
}

// Generate error creation macros for ModelError
headless_lms_utils::define_err_macro!(
    model_err,
    ModelError,
    ModelErrorType,
    ModelErrorType,
    "Create a ModelError with less boilerplate."
);

/// Helper function for `.map_err()` chains to wrap any error as ModelError.
///
/// This function creates a closure that converts any error into a `ModelError`
/// with the specified error type and message, including the original error as the source.
///
/// # Examples
///
/// ```ignore
/// // Instead of:
/// .map_err(|e| ModelError::new(ModelErrorType::Generic, e.to_string(), Some(e.into())))?
///
/// // You can write:
/// .map_err(as_model_error(ModelErrorType::Generic, "Failed to process".to_string()))?
/// ```
pub fn as_model_error<E>(
    error_type: ModelErrorType,
    message: impl Into<String>,
) -> impl FnOnce(E) -> ModelError
where
    E: Into<anyhow::Error>,
{
    let msg = message.into();
    move |e| ModelError::new(error_type, msg, Some(e.into()))
}

/// Helper function for `.ok_or_else()` to create ModelError on None.
///
/// This function creates a closure that generates a `ModelError` with the
/// specified error type and message when called.
///
/// # Examples
///
/// ```ignore
/// // Instead of:
/// .ok_or_else(|| ModelError::new(ModelErrorType::NotFound, "Item not found".to_string(), None))
///
/// // You can write:
/// .ok_or_else(missing_model_error(ModelErrorType::NotFound, "Item not found".to_string()))
/// ```
pub fn missing_model_error(
    error_type: ModelErrorType,
    message: impl Into<String>,
) -> impl FnOnce() -> ModelError {
    let msg = message.into();
    move || ModelError::new(error_type, msg, None)
}

#[cfg(test)]
mod test {
    use uuid::Uuid;

    use super::*;
    use crate::{
        PKeyPolicy,
        email_templates::{EmailTemplateNew, EmailTemplateType},
        test_helper::*,
    };

    #[test]
    fn test_model_err_macro_without_source() {
        let err = model_err!(Generic, "Test error message".to_string());
        assert_eq!(err.message(), "Test error message");
        assert!(matches!(err.error_type(), ModelErrorType::Generic));
    }

    #[test]
    fn test_model_err_macro_with_source() {
        let source_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err = model_err!(Generic, "Wrapped error".to_string(), source_err);
        assert_eq!(err.message(), "Wrapped error");
        assert!(err.source.is_some());
    }

    #[test]
    fn test_as_model_error_helper() {
        let result: Result<(), std::io::Error> = Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "test error",
        ));
        let model_result = result.map_err(as_model_error(
            ModelErrorType::Generic,
            "Failed to read file".to_string(),
        ));

        assert!(model_result.is_err());
        let err = model_result.unwrap_err();
        assert_eq!(err.message(), "Failed to read file");
        assert!(matches!(err.error_type(), ModelErrorType::Generic));
    }

    #[test]
    fn test_missing_model_error_helper() {
        let option: Option<String> = None;
        let result = option.ok_or_else(missing_model_error(
            ModelErrorType::NotFound,
            "Item not found".to_string(),
        ));

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.message(), "Item not found");
        assert!(matches!(err.error_type(), ModelErrorType::NotFound));
    }

    #[test]
    fn test_model_err_with_format() {
        let id = 123;
        let err = model_err!(NotFound, format!("Item with id {} not found", id));
        assert_eq!(err.message(), "Item with id 123 not found");
    }

    /// A wrapped `BackendError` cause renders as its own node, not an `(external)` leaf,
    /// checking the cross-crate downcast resolver.
    #[test]
    fn debug_renders_wrapped_backend_error_as_a_cause_node() {
        use headless_lms_utils::error::util_error::{UtilError, UtilErrorType};
        let util_error = UtilError::new(UtilErrorType::Other, "disk on fire".to_string(), None);
        let model_error = ModelError::from(util_error);

        let debug = format!("{model_error:?}");
        assert!(debug.contains("ModelError · Util"), "got: {debug}");
        assert!(debug.contains("caused by:"), "got: {debug}");
        assert!(
            debug.contains("1. UtilError · Other: disk on fire"),
            "wrapped BackendError should render as a node, got: {debug}"
        );
        assert!(!debug.contains("(external)"), "got: {debug}");
    }

    #[test]
    fn test_model_err_macro_struct_variant_without_source() {
        let err = model_err!(
            PreconditionFailedWithCMSAnchorBlockId {
                id: Uuid::nil(),
                description: "Anchor missing",
            },
            "Invalid anchor".to_string()
        );
        assert_eq!(err.message(), "Invalid anchor");
        assert!(matches!(
            err.error_type(),
            ModelErrorType::PreconditionFailedWithCMSAnchorBlockId { .. }
        ));
    }

    #[test]
    fn test_model_err_macro_struct_variant_with_source() {
        let source_err = std::io::Error::other("source");
        let err = model_err!(
            PreconditionFailedWithCMSAnchorBlockId {
                id: Uuid::nil(),
                description: "Anchor missing",
            },
            "Invalid anchor".to_string(),
            source_err
        );
        assert!(matches!(
            err.error_type(),
            ModelErrorType::PreconditionFailedWithCMSAnchorBlockId { .. }
        ));
        assert!(err.source.is_some());
    }

    #[tokio::test]
    async fn email_templates_check() {
        insert_data!(:tx, :user, :org, :course);

        let err = crate::email_templates::insert_email_template(
            tx.as_mut(),
            Some(course),
            EmailTemplateNew {
                template_type: EmailTemplateType::Generic,
                language: None,
                content: None,
                subject: None,
            },
            Some(""),
        )
        .await
        .unwrap_err();
        match err.error_type {
            ModelErrorType::DatabaseConstraint { constraint, .. } => {
                assert_eq!(constraint, "email_templates_subject_check");
            }
            _ => {
                panic!("wrong error variant")
            }
        }
    }

    #[tokio::test]
    async fn user_details_email_check() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let err = crate::users::insert(
            tx.as_mut(),
            PKeyPolicy::Fixed(Uuid::parse_str("92c2d6d6-e1b8-4064-8c60-3ae52266c62c").unwrap()),
            "invalid email",
            None,
            None,
        )
        .await
        .unwrap_err();
        match err.error_type {
            ModelErrorType::DatabaseConstraint { constraint, .. } => {
                assert_eq!(constraint, "user_details_email_check");
            }
            _ => {
                panic!("wrong error variant")
            }
        }
    }
}
