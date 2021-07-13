use thiserror::Error;

pub type ModelResult<T> = Result<T, ModelError>;

#[derive(Debug, Error)]
pub enum ModelError {
    #[error(transparent)]
    RecordNotFound(sqlx::Error),
    #[error("{0}")]
    PreconditionFailed(String),

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
        match err {
            sqlx::Error::RowNotFound => ModelError::RecordNotFound(err),
            _ => ModelError::Database(err),
        }
    }
}
