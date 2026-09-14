pub mod file_uploading;
pub mod pagination;

/// Trims a query/payload string and turns a now-empty result into `None`, so "not provided" and
/// "provided as whitespace" filter the same way.
pub fn non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}
