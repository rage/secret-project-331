//! The MCP server through which teachers' AI agents read and edit course material.

pub mod diff;
pub mod engine;
pub mod ids;
pub mod risk;
pub mod text;
pub mod tools;

#[cfg(test)]
pub(crate) mod test_fixtures;
