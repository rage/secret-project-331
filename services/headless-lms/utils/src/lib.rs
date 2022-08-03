//! Commonly used utils.

pub mod document_schema_processor;
pub mod email_processor;
pub mod file_store;
pub mod folder_checksum;
pub mod futures;
pub mod ip_to_country;
pub mod language_tag_to_name;
pub mod merge_edits;
pub mod numbers;
pub mod page_visit_hasher;
pub mod pagination;
pub mod strings;
pub mod url_to_oembed_endpoint;

#[macro_use]
extern crate tracing;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct ApplicationConfiguration {
    pub base_url: String,
    pub test_mode: bool,
    pub development_uuid_login: bool,
}

#[derive(Debug, Error)]
pub enum UtilError {
    #[error(transparent)]
    UrlParse(#[from] url::ParseError),
    #[error(transparent)]
    Walkdir(#[from] walkdir::Error),
    #[error(transparent)]
    StripPrefix(#[from] std::path::StripPrefixError),
    #[error(transparent)]
    TokioIo(#[from] tokio::io::Error),
    #[error(transparent)]
    SerdeJson(#[from] serde_json::Error),
    #[error(transparent)]
    CloudStorage(#[from] cloud_storage::Error),

    #[error("{0}")]
    Other(String),
}
