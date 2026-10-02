//! Application decisions shared by the HTTP API and background operations.
pub mod config;
pub mod domain;
pub mod prelude;
#[macro_use]
extern crate tracing;
pub type OAuthClient = oauth2::basic::BasicClient<
    oauth2::EndpointSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointSet,
>;
#[cfg(any(test, feature = "test-support"))]
pub mod test_helper;
