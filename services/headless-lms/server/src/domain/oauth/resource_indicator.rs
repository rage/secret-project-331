use serde::{Deserialize, Deserializer, Serialize};

/// An RFC 8707 resource indicator, without trailing slashes, so that it compares equal to the
/// resource URLs tokens are bound to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct ResourceIndicator(String);

impl ResourceIndicator {
    /// The indicator for `resource`, without trailing slashes.
    pub fn new(resource: &str) -> Self {
        Self(resource.trim_end_matches('/').to_string())
    }

    /// The indicator as a URL string.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for ResourceIndicator {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        String::deserialize(deserializer).map(|resource| Self::new(&resource))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trailing_slashes_are_dropped() {
        assert_eq!(
            ResourceIndicator::new("https://example.com/api/v0/mcp/").as_str(),
            "https://example.com/api/v0/mcp"
        );
    }
}
