//! Input schema generation: draft 2020-12, no `oneOf`/`anyOf` and no nullable type arrays, so the
//! schemas survive Codex's schema sanitiser.

use schemars::{Schema, SchemaGenerator, json_schema};

/// Schema for patch `value`: deliberately untyped, since block schemas would push tool schemas
/// past client size limits.
pub fn untyped_value(_: &mut SchemaGenerator) -> Schema {
    json_schema!({
        "description": "Value to write: a block or list of blocks, an entity, a field value or null."
    })
}
