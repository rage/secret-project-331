use anyhow::{Context, Result};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

/// Source for JSON data used in exercises and pages.
///
/// Use `asset_json!("path.json")` for compile-time files or `JsonSource::File("path".into())` for runtime paths.
#[derive(Clone, Debug)]
pub enum JsonSource {
    /// JSON data inline in the code
    Inline(Value),
    /// JSON file loaded at runtime
    File(PathBuf),
}

impl JsonSource {
    pub fn load(&self) -> Result<Value> {
        match self {
            JsonSource::Inline(v) => Ok(v.clone()),
            JsonSource::File(p) => {
                let s =
                    fs::read_to_string(p).with_context(|| format!("Reading {}", p.display()))?;
                Ok(serde_json::from_str(&s).context("Parsing JSON file")?)
            }
        }
    }
}

/// Compile-time JSON inclusion macro. Usage: `asset_json!("../../assets/quizzes.json")`
#[macro_export]
macro_rules! asset_json {
    ($path:literal) => {{
        let _s: &str = include_str!($path);
        $crate::programs::seed::builder::JsonSource::Inline(
            serde_json::from_str(_s).expect(concat!("Invalid JSON in asset: ", $path)),
        )
    }};
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn inline_loads() {
        let v = json!({"a":1});
        let src = JsonSource::Inline(v.clone());
        let out = src.load().unwrap();
        assert_eq!(out, v);
    }

    #[test]
    fn file_loads() {
        let mut tmp = NamedTempFile::new().unwrap();
        write!(tmp, "{{\"k\":\"v\"}}").unwrap();
        let src = JsonSource::File(tmp.path().to_path_buf());
        let out = src.load().unwrap();
        assert_eq!(out["k"], "v");
    }

    #[test]
    fn file_bad_json() {
        let mut tmp = NamedTempFile::new().unwrap();
        write!(tmp, "not-json").unwrap();
        let src = JsonSource::File(tmp.path().to_path_buf());
        assert!(src.load().is_err());
    }

    #[test]
    fn json_file_ok_and_bad() {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        write!(f, r#"{{"ok":true}}"#).unwrap();

        let src_ok = JsonSource::File(f.path().to_path_buf());
        let v = src_ok.load().unwrap();
        assert_eq!(v["ok"], true);

        let mut f2 = tempfile::NamedTempFile::new().unwrap();
        write!(f2, "nope").unwrap();
        let src_bad = JsonSource::File(f2.path().to_path_buf());
        assert!(src_bad.load().is_err());
    }
}
