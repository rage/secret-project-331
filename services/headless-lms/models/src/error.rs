/*!
Contains error and result types for all the model functions.
*/

use std::{fmt::Display, num::TryFromIntError};

use backtrace::Backtrace;
use headless_lms_utils::error::{backend_error::BackendError, util_error::UtilError};
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
#[derive(Debug)]
pub struct ModelError {
    error_type: ModelErrorType,
    message: String,
    /// Original error that caused this error.
    source: Option<anyhow::Error>,
    /// A trace of tokio tracing spans, generated automatically when the error is generated.
    span_trace: SpanTrace,
    /// Stack trace, generated automatically when the error is created.
    backtrace: Backtrace,
}

impl std::error::Error for ModelError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source.as_ref().and_then(|o| o.source())
    }

    fn cause(&self) -> Option<&dyn std::error::Error> {
        self.source()
    }
}

impl Display for ModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ModelError {:?} {:?}", self.error_type, self.message)
    }
}

impl BackendError for ModelError {
    type ErrorType = ModelErrorType;

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
            span_trace,
            backtrace,
        }
    }
}

/// The type of [ModelError] that occured.
#[derive(Debug, PartialEq, Eq)]
pub enum ModelErrorType {
    RecordNotFound,
    NotFound,
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

#[cfg(test)]
mod test {
    use uuid::Uuid;

    use super::*;
    use crate::{PKeyPolicy, email_templates::EmailTemplateNew, test_helper::*};

    #[tokio::test]
    async fn email_templates_check() {
        insert_data!(:tx, :user, :org, :course, :instance);

        let err = crate::email_templates::insert_email_template(
            tx.as_mut(),
            instance.id,
            EmailTemplateNew {
                name: "".to_string(),
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
