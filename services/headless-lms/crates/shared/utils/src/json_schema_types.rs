use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JSONType {
    JsonSchema,
    Object,
    Array,
    String,
    Number,
    Integer,
    Boolean,
}

/// Defines the shape of a JSON object for the LLM, used both for structured output
/// and for the parameters of a tool definition.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Schema {
    #[serde(rename = "type")]
    /// Type of the schema, should be Object
    pub type_field: JSONType,
    /// Order-preserving, and deliberately not a `HashMap`: `RandomState` reseeds per map instance,
    /// so a `HashMap` here serializes its keys in a different order on nearly every request. Tool
    /// definitions and structured output schemas sit at the front of the prompt, and Azure's
    /// prompt cache matches an exact prefix, so that alone misses the cache on every request.
    pub properties: IndexMap<String, SchemaPropertyType>,
    /// All 'properties' keys must be included in this 'required' list
    pub required: Vec<String>,
    /// additionalProperties should always be 'false'
    pub additional_properties: bool,
    /// Explains the object to the LLM.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl Schema {
    /// A strict-mode object schema with every property key required.
    ///
    /// Azure's `strict: true` tool/response schemas have no notion of an optional property —
    /// a property a tool doesn't strictly need still has to be listed here, with "Optional"
    /// said in its own description instead.
    pub fn strict_object(
        properties: IndexMap<String, SchemaPropertyType>,
        description: Option<&str>,
    ) -> Self {
        let required = properties.keys().cloned().collect();
        Self {
            type_field: JSONType::Object,
            properties,
            required,
            additional_properties: false,
            description: description.map(str::to_string),
        }
    }
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

/// A scalar value in a [Schema]: the property types that have no inner shape.
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
