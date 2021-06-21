pub mod controllers;
pub mod domain;
pub mod models;
pub mod utils;

#[cfg(test)]
pub mod test_helper;

#[macro_use]
extern crate tracing;

use oauth2::basic::BasicClient;
use std::sync::Arc;

pub type OAuthClient = Arc<BasicClient>;
