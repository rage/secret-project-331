//! Release versions that clients report, for rejecting or warning about outdated ones.

use std::fmt;

/// A `MAJOR.MINOR.PATCH` version, ordered by its numbers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Version(pub u64, pub u64, pub u64);

impl Version {
    /// Parses `MAJOR[.MINOR[.PATCH]]`, missing parts being 0, with an optional leading `v`. Parts
    /// are digits only, so a pre-release or other suffix is no version.
    pub fn parse(raw: &str) -> Option<Self> {
        let parts: Vec<u64> = raw
            .trim()
            .trim_start_matches('v')
            .split('.')
            .map(|part| {
                (!part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
                    .then(|| part.parse().ok())
                    .flatten()
            })
            .collect::<Option<_>>()?;
        match parts.as_slice() {
            [major] => Some(Version(*major, 0, 0)),
            [major, minor] => Some(Version(*major, *minor, 0)),
            [major, minor, patch] => Some(Version(*major, *minor, *patch)),
            _ => None,
        }
    }
}

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.0, self.1, self.2)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_parts_default_to_zero() {
        assert_eq!(Version::parse("1"), Some(Version(1, 0, 0)));
        assert_eq!(Version::parse("1.2"), Some(Version(1, 2, 0)));
        assert_eq!(Version::parse("1.2.3"), Some(Version(1, 2, 3)));
        assert_eq!(Version::parse("x"), None);
    }
}
