//! Commonly used utils.

pub mod document_schema_processor;
pub mod email_processor;
pub mod file_store;
pub mod folder_checksum;
pub mod merge_edits;
pub mod numbers;
pub mod pagination;
pub mod strings;
pub mod url_to_oembed_endpoint;

#[macro_use]
extern crate tracing;

use serde::{Deserialize, Serialize};

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct ApplicationConfiguration {
    pub base_url: String,
    pub test_mode: bool,
    pub development_uuid_login: bool,
}
