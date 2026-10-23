//! Standard request headers (`MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, `Mcp-Param-*`),
//! which let rate limiting and logging route without parsing the body. They must agree with it.

use serde_json::{Map, Value};

const BASE64_PREFIX: &str = "=?base64?";
const BASE64_SUFFIX: &str = "?=";

pub(crate) const PROTOCOL_VERSION_HEADER: &str = "mcp-protocol-version";
pub(crate) const METHOD_HEADER: &str = "mcp-method";
pub(crate) const NAME_HEADER: &str = "mcp-name";
pub(crate) const PARAM_HEADER_PREFIX: &str = "mcp-param-";

/// Request headers with lowercase names.
#[derive(Debug, Clone, Default)]
pub struct RequestHeaders {
    entries: Vec<(String, String)>,
}

impl RequestHeaders {
    /// Headers from name-value pairs; names match case-insensitively.
    pub fn new<N: AsRef<str>, V: Into<String>>(entries: impl IntoIterator<Item = (N, V)>) -> Self {
        Self {
            entries: entries
                .into_iter()
                .map(|(n, v)| (n.as_ref().to_ascii_lowercase(), v.into()))
                .collect(),
        }
    }

    /// The single value of `name`; an error when it is repeated.
    pub(crate) fn single(&self, name: &str) -> Result<Option<&str>, String> {
        let name = name.to_ascii_lowercase();
        let mut values = self
            .entries
            .iter()
            .filter(|(n, _)| *n == name)
            .map(|(_, v)| v.as_str());
        let first = values.next();
        if values.next().is_some() {
            return Err(format!("duplicate {name} header"));
        }
        Ok(first)
    }
}

fn decode(value: &str) -> Option<String> {
    use base64::Engine;
    match value
        .strip_prefix(BASE64_PREFIX)
        .and_then(|v| v.strip_suffix(BASE64_SUFFIX))
    {
        Some(encoded) => base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok()),
        None => Some(value.to_string()),
    }
}

fn primitive(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::Bool(b) => Some(b.to_string()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

/// Checks the routing headers against the body. `header_params` are the called tool's
/// `(argument, header suffix)` pairs.
pub(crate) fn validate(
    headers: &RequestHeaders,
    method: &str,
    params: &Map<String, Value>,
    header_params: &[(String, String)],
) -> Result<(), String> {
    match headers.single(METHOD_HEADER)? {
        None => return Err("missing Mcp-Method header".into()),
        Some(value) if value != method => {
            return Err(format!(
                "Mcp-Method header \"{value}\" doesn't match the body method \"{method}\""
            ));
        }
        Some(_) => {}
    }
    if method == "tools/call" {
        let name = params
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        match headers.single(NAME_HEADER)? {
            None => return Err("missing Mcp-Name header for tools/call".into()),
            Some(raw) => {
                let decoded = decode(raw).ok_or("Mcp-Name header isn't valid base64")?;
                if decoded != name {
                    return Err(format!(
                        "Mcp-Name header \"{decoded}\" doesn't match the tool \"{name}\""
                    ));
                }
            }
        }
        let arguments = params.get("arguments");
        for (argument, suffix) in header_params {
            let header = format!("{PARAM_HEADER_PREFIX}{}", suffix.to_ascii_lowercase());
            let body = arguments.and_then(|a| a.get(argument)).and_then(primitive);
            match (headers.single(&header)?, body) {
                (None, None) => {}
                (Some(_), None) => {
                    return Err(format!(
                        "Mcp-Param-{suffix} header sent without a {argument} argument"
                    ));
                }
                (None, Some(_)) => {
                    return Err(format!("missing Mcp-Param-{suffix} header for {argument}"));
                }
                (Some(raw), Some(expected)) => {
                    let decoded = decode(raw)
                        .ok_or_else(|| format!("Mcp-Param-{suffix} header isn't valid base64"))?;
                    if decoded != expected {
                        return Err(format!(
                            "Mcp-Param-{suffix} header \"{decoded}\" doesn't match {argument} \"{expected}\""
                        ));
                    }
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn headers(entries: &[(&str, &str)]) -> RequestHeaders {
        RequestHeaders::new(entries.iter().map(|(n, v)| (*n, v.to_string())))
    }

    #[test]
    fn method_name_and_params_must_match() {
        let params =
            json!({"name": "get_page_content", "arguments": {"course": "c1", "page": "p1"}});
        let params = params.as_object().unwrap();
        let course = vec![("course".to_string(), "Course".to_string())];
        let ok = headers(&[
            ("Mcp-Method", "tools/call"),
            ("Mcp-Name", "get_page_content"),
            ("Mcp-Param-Course", "c1"),
        ]);
        assert!(validate(&ok, "tools/call", params, &course).is_ok());
        let wrong_course = headers(&[
            ("Mcp-Method", "tools/call"),
            ("Mcp-Name", "get_page_content"),
            ("Mcp-Param-Course", "c2"),
        ]);
        assert!(validate(&wrong_course, "tools/call", params, &course).is_err());
        let missing_name = headers(&[("Mcp-Method", "tools/call")]);
        assert!(validate(&missing_name, "tools/call", params, &course).is_err());
        let wrong_method = headers(&[("Mcp-Method", "tools/list")]);
        assert!(validate(&wrong_method, "tools/call", params, &course).is_err());
        let duplicated = headers(&[("Mcp-Method", "tools/list"), ("mcp-method", "tools/list")]);
        assert!(validate(&duplicated, "tools/list", &Map::new(), &[]).is_err());
    }

    #[test]
    fn base64_wrapped_values() {
        assert_eq!(decode("=?base64?w6RpdGk=?="), Some("äiti".to_string()));
        assert_eq!(decode("plain"), Some("plain".to_string()));
    }
}
