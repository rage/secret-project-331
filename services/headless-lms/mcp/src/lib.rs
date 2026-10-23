//! The MCP server through which teachers' AI agents read and edit course material.

pub mod access;
pub mod course_state;
pub mod diff;
pub mod engine;
pub mod guide;
pub mod handlers;
pub mod hints;
pub mod http;
pub mod ids;
pub mod instructions;
pub mod protocol;
pub mod risk;
pub mod snapshots;
pub mod staging;
pub mod state;
pub mod text;
pub mod tools;
pub mod validator;

#[cfg(test)]
pub(crate) mod test_fixtures;
