use std::num::TryFromIntError;

use thiserror::Error;
use uuid::Uuid;

pub type ModelResult<T> = Result<T, ModelError>;

pub trait TryToOptional<T, E> {
    /// Filters out a `NotFound` type error and maps the ok value to an `Option`. Other forms of
    /// errors are preserved as-is.
    fn optional(self) -> Result<Option<T>, E>
    where
        Self: Sized;
}

impl<T> TryToOptional<T, ModelError> for ModelResult<T> {
    fn optional(self) -> Result<Option<T>, ModelError> {
        match self {
            Ok(val) => Ok(Some(val)),
            Err(ModelError::RecordNotFound(_)) => Ok(None),
            Err(err) => Err(err),
        }
    }
}

#[derive(Debug, Error)]
pub enum ModelError {
    #[error(transparent)]
    RecordNotFound(sqlx::Error),
    #[error("{0}")]
    NotFound(String),
    #[error("{description}")]
    DatabaseConstraint {
        constraint: String,
        description: &'static str,
    },
    #[error("{0}")]
    PreconditionFailed(String),
    #[error("{description}")]
    PreconditionFailedWithCMSAnchorBlockId { id: Uuid, description: &'static str },
    #[error("{0}")]
    InvalidRequest(String),
    #[error("{0}")]
    Conversion(#[from] TryFromIntError),
    #[error(transparent)]
    Database(sqlx::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),
    #[error(transparent)]
    Util(#[from] headless_lms_utils::UtilError),
    #[error("{0}")]
    Generic(String),
}

impl From<sqlx::Error> for ModelError {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::RowNotFound => ModelError::RecordNotFound(err),
            sqlx::Error::Database(db_err) => {
                if let Some(constraint) = db_err.constraint() {
                    match constraint {
                        "email_templates_subject_check" => ModelError::DatabaseConstraint {
                            constraint: constraint.to_string(),
                            description: "Subject must not be null",
                        },
                        "users_email_check" => ModelError::DatabaseConstraint {
                            constraint: constraint.to_string(),
                            description: "Email must contain an '@' symbol.",
                        },
                        _ => ModelError::Database(err),
                    }
                } else {
                    ModelError::Database(err)
                }
            }
            _ => ModelError::Database(err),
        }
    }
}

#[cfg(test)]
mod test {
    use uuid::Uuid;

    use super::*;
    use crate::{email_templates::EmailTemplateNew, test_helper::*};

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
        if let ModelError::DatabaseConstraint { constraint, .. } = err {
            assert_eq!(constraint, "email_templates_subject_check");
        } else {
            panic!("wrong error variant")
        }
    }

    #[tokio::test]
    async fn users_email_check() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let err = crate::users::insert_with_id(
            tx.as_mut(),
            "invalid email",
            None,
            None,
            Uuid::parse_str("92c2d6d6-e1b8-4064-8c60-3ae52266c62c").unwrap(),
        )
        .await
        .unwrap_err();
        if let ModelError::DatabaseConstraint { constraint, .. } = err {
            assert_eq!(constraint, "users_email_check");
        } else {
            panic!("wrong error variant")
        }
    }
}
