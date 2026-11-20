//! Helpers for IETF language tags such as `fi-FI`.

/// The primary language subtag: `fi` for `fi-FI`.
pub fn primary_language(tag: &str) -> &str {
    tag.split('-').next().unwrap_or(tag)
}

/// Whether two tags name the same language, ignoring region and other subtags and case, so `fi`
/// and `fi-FI` match.
pub fn is_same_language(a: &str, b: &str) -> bool {
    primary_language(a).eq_ignore_ascii_case(primary_language(b))
}
