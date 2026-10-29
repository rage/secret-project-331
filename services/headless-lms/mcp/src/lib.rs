//! The MCP server through which teachers' AI agents read and edit course material. The server
//! mounts [`http`] with a [`state::McpState`], whose [`validator::BlockValidator`] checks writes.

mod access;
mod diff;
mod engine;
mod explanations;
mod guide;
mod handlers;
mod hints;
pub mod http;
mod ids;
mod instruction_lists;
mod instructions;
pub mod protocol;
mod snapshots;
mod staging;
pub mod state;
mod text;
mod tools;
pub mod validator;

#[cfg(test)]
mod models_tests;
#[cfg(test)]
mod risk_tests;
#[cfg(test)]
pub(crate) mod test_fixtures;
#[cfg(any(test, feature = "test-support"))]
pub mod test_support;
