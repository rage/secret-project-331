use thiserror::Error;

pub type ModelResult<T> = Result<T, ModelError>;

#[derive(Debug, Error)]
pub enum ModelError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
    #[error("{0}")]
    Generic(&'static str),
}
