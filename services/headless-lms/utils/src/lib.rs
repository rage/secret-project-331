//! Commonly used utils.

pub mod cache;
pub mod document_schema_processor;
pub mod email_processor;
pub mod error;
pub mod file_store;
pub mod folder_checksum;
pub mod futures;
pub mod icu4x;
pub mod ip_to_country;
pub mod language_tag_to_name;
pub mod merge_edits;
pub mod numbers;
pub mod page_visit_hasher;
pub mod pagination;
pub mod prelude;
pub mod strings;
pub mod url_to_oembed_endpoint;

#[macro_use]
extern crate tracing;

use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Clone, PartialEq)]
pub struct ApplicationConfiguration {
    pub base_url: String,
    pub test_mode: bool,
    pub development_uuid_login: bool,
    pub chatbot_azure_api_key: Option<String>,
    pub chatbot_azure_api_endpoint: Option<Url>,
}
