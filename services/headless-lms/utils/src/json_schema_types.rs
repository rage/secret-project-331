use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JSONType {
    JsonSchema,
    Object,
    Array,
    String,
}

/// Defines LLM structured output shape and types
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Schema {
    #[serde(rename = "type")]
    /// Type of the schema, should be Object
    pub type_field: JSONType,
    pub properties: HashMap<String, SchemaPropertyType>,
    /// All 'properties' keys must be included in this 'required' list
    pub required: Vec<String>,
    /// additionalProperties should always be 'false'
    pub additional_properties: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum SchemaPropertyType {
    ArrayProperty(ArrayProperty),
    Object(Schema),
    Item(JsonItem),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ArrayProperty {
    #[serde(rename = "type")]
    pub type_field: JSONType,
    pub items: ArrayItem,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum ArrayItem {
    Schema(Schema),
    JsonItem(JsonItem),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct JsonItem {
    #[serde(rename = "type")]
    pub type_field: JSONType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// An array of plain strings, the one composite property that tool parameter and structured output
/// schemas keep asking for. `description` explains the array to the LLM; the items carry none of
/// their own.
pub fn string_array_property(description: Option<&str>) -> SchemaPropertyType {
    SchemaPropertyType::ArrayProperty(ArrayProperty {
        type_field: JSONType::Array,
        items: ArrayItem::JsonItem(JsonItem {
            type_field: JSONType::String,
            description: None,
        }),
        description: description.map(str::to_string),
    })
}
