//! The MCP server through which teachers' AI agents read and edit course material.

pub mod diff;
pub mod engine;
pub mod guide;
pub mod hints;
pub mod ids;
pub mod instructions;
pub mod protocol;
pub mod risk;
pub mod text;
pub mod tools;
pub mod validator;

#[cfg(test)]
pub(crate) mod test_fixtures;
