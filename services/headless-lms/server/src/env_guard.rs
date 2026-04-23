#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    /// Recursively collects Rust source files under the given directory.
    fn collect_rs_files(dir: &Path, out: &mut Vec<PathBuf>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    collect_rs_files(&path, out);
                } else if path.extension().is_some_and(|ext| ext == "rs") {
                    out.push(path);
                }
            }
        }
    }

    /// Prevents new ad-hoc env var reads outside approved config modules.
    #[test]
    fn env_var_reads_are_centralized() {
        let src_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
        let mut files = Vec::new();
        collect_rs_files(&src_root, &mut files);

        let allowed_files = ["src/env_guard.rs", "src/test_helper.rs"];
        let allowed_prefixes = ["src/config.rs", "src/config/"];
        let mut violations = Vec::new();

        for file in files {
            let relative = file
                .strip_prefix(Path::new(env!("CARGO_MANIFEST_DIR")))
                .unwrap_or(&file)
                .to_string_lossy()
                .replace('\\', "/");
            if allowed_files.contains(&relative.as_str()) {
                continue;
            }
            if allowed_prefixes
                .iter()
                .any(|allowed| relative.starts_with(allowed))
            {
                continue;
            }

            let content = match fs::read_to_string(&file) {
                Ok(content) => content,
                Err(_) => continue,
            };
            if content.contains("env::var(") || content.contains("std::env::var(") {
                violations.push(relative);
            }
        }

        assert!(
            violations.is_empty(),
            "Found direct env::var reads outside central config modules: {:?}",
            violations
        );
    }
}
