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

/// The input schema of an args struct, with every subschema inlined so no `$ref` or `$defs`
/// depends on client support.
pub fn input_schema<T: schemars::JsonSchema>() -> serde_json::Map<String, serde_json::Value> {
    let settings =
        schemars::generate::SchemaSettings::draft2020_12().with(|s| s.inline_subschemas = true);
    let schema = settings.into_generator().into_root_schema_for::<T>();
    let mut value = schema.to_value();
    flatten_unions(&mut value);
    let mut object = match value {
        serde_json::Value::Object(object) => object,
        _ => serde_json::Map::new(),
    };
    object.remove("title");
    object.remove("description");
    object
}

/// Removes the unions schemars emits (nullable types, `null` alternatives, string enums with
/// documented variants), which Codex would flatten. Optional fields stay out of `required` instead.
fn flatten_unions(value: &mut serde_json::Value) {
    use serde_json::Value;
    match value {
        Value::Object(object) => {
            if let Some(Value::Array(types)) = object.get("type") {
                let non_null: Vec<Value> = types
                    .iter()
                    .filter(|t| t.as_str() != Some("null"))
                    .cloned()
                    .collect();
                if non_null.len() == 1 {
                    object.insert("type".into(), non_null[0].clone());
                }
            }
            for key in ["anyOf", "oneOf"] {
                if let Some(Value::Array(alternatives)) = object.get(key) {
                    let non_null: Vec<Value> = alternatives
                        .iter()
                        .filter(|a| a.get("type").and_then(Value::as_str) != Some("null"))
                        .cloned()
                        .collect();
                    if non_null.len() == 1 {
                        object.remove(key);
                        if let Value::Object(inner) = &non_null[0] {
                            for (k, v) in inner {
                                object.entry(k.clone()).or_insert_with(|| v.clone());
                            }
                        }
                    }
                }
            }
            if let Some(Value::Array(alternatives)) = object.get("oneOf") {
                let constants: Option<Vec<Value>> = alternatives
                    .iter()
                    .map(|a| a.get("const").cloned())
                    .collect();
                if let Some(constants) = constants.filter(|c| c.iter().all(Value::is_string)) {
                    let described: Vec<String> = alternatives
                        .iter()
                        .filter_map(|a| {
                            Some(format!(
                                "{}: {}",
                                a.get("const")?.as_str()?,
                                a.get("description")?.as_str()?.trim_end_matches('.')
                            ))
                        })
                        .collect();
                    object.remove("oneOf");
                    object.insert("type".into(), Value::String("string".into()));
                    object.insert("enum".into(), Value::Array(constants));
                    if !described.is_empty() && !object.contains_key("description") {
                        object.insert("description".into(), Value::String(described.join("; ")));
                    }
                }
            }
            if object.get("default").is_some_and(Value::is_null) {
                object.remove("default");
            }
            if let Some(Value::Array(options)) = object.get_mut("enum") {
                options.retain(|o| !o.is_null());
            }
            object.values_mut().for_each(flatten_unions);
        }
        Value::Array(items) => items.iter_mut().for_each(flatten_unions),
        _ => {}
    }
}
