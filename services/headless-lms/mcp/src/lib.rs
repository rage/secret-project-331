//! The MCP server through which teachers' AI agents read and edit course material.

pub mod engine;
pub mod ids;
pub mod text;
pub mod tools;

#[cfg(test)]
pub(crate) mod test_fixtures;
