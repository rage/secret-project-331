//! SQL LIKE pattern escaping shared by table queries.

/// Escapes the `LIKE`/`ILIKE` metacharacters `\`, `%` and `_` so a search string is matched
/// literally (used together with `ESCAPE '\'` in the query).
pub fn escape_like_pattern(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}
