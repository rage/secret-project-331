pub mod controllers;
pub mod domain;
pub mod models;
pub mod utils;

#[macro_use]
extern crate log;

use oauth2::basic::BasicClient;
use std::sync::Arc;

pub type OAuthClient = Arc<BasicClient>;
