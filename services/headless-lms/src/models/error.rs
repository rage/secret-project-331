use thiserror::Error;

pub type ModelResult<T> = Result<T, ModelError>;

#[derive(Debug, Error)]
pub enum ModelError {
    #[error(transparent)]
    RecordNotFound(sqlx::Error),
    #[error("{description}")]
    DatabaseConstraint {
        constraint: String,
        description: &'static str,
    },
    #[error("{0}")]
    PreconditionFailed(String),
    #[error("{0}")]
    InvalidRequest(String),
    #[error(transparent)]
    Database(sqlx::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
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
    use crate::{
        models::{self, email_templates::EmailTemplateNew},
        test_helper::{self, Conn, Data},
    };

    #[tokio::test]
    async fn email_templates_check() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let Data { instance: ci, .. } = test_helper::insert_data(tx.as_mut(), "").await.unwrap();

        let err = models::email_templates::insert_email_template(
            tx.as_mut(),
            ci,
            EmailTemplateNew {
                name: "".to_string(),
            },
            Some("".to_string()),
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
        let err = models::users::insert_with_id(
            tx.as_mut(),
            "invalid email",
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
