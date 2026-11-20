//! The values logged about a submission, grouped in namespaces such as `header` or `network` and
//! referred to as `namespace.name`.

use serde_json::{Map, Value};

/// Signals of one submission. Absent values stay absent, so "unknown" differs from "false".
#[derive(Debug, Default, Clone)]
pub struct Signals {
    namespaces: Map<String, Value>,
}

impl Signals {
    /// Sets `namespace.name`. `None` leaves it absent.
    pub fn set(&mut self, namespace: &str, name: &str, value: impl Into<Option<Value>>) {
        let Some(value) = value.into() else {
            return;
        };
        let entry = self
            .namespaces
            .entry(namespace.to_string())
            .or_insert_with(|| Value::Object(Map::new()));
        if let Value::Object(map) = entry {
            map.insert(name.to_string(), value);
        }
    }

    /// The namespaces and their values, as stored in the log.
    pub fn as_json(&self) -> Value {
        Value::Object(self.namespaces.clone())
    }

    /// Rebuilds the signals of a logged submission from [`Self::as_json`].
    pub fn from_json(value: &Value) -> Self {
        let namespaces = match value {
            Value::Object(map) => map.clone(),
            _ => Map::new(),
        };
        Self { namespaces }
    }

    /// Each namespace with its object of values.
    pub fn namespaces(&self) -> impl Iterator<Item = (&String, &Value)> {
        self.namespaces.iter()
    }
}

/// A count as a JSON integer, or `None` when it does not fit one.
pub fn count(value: impl TryInto<i64>) -> Option<Value> {
    value.try_into().ok().map(Value::from)
}
