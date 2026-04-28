use crate::config::program_config::ProgramConfig;

pub const OPEN_UNIVERSITY_COURSE_URL: &str = "OPEN_UNIVERSITY_COURSE_URL";
pub const OPEN_UNIVERSITY_TOKEN: &str = "OPEN_UNIVERSITY_TOKEN";

pub struct OpenUniversityConfig {
    pub database_url: String,
    pub course_url: Option<String>,
    pub token: Option<String>,
    pub rust_log: Option<String>,
}

impl OpenUniversityConfig {
    /// Loads Open University job configuration from environment variables.
    pub fn try_from_env() -> Self {
        Self {
            database_url: ProgramConfig::database_url_with_default(),
            course_url: optional_non_blank(OPEN_UNIVERSITY_COURSE_URL),
            token: optional_non_blank(OPEN_UNIVERSITY_TOKEN),
            rust_log: ProgramConfig::optional("RUST_LOG"),
        }
    }
}

fn optional_non_blank(key: &str) -> Option<String> {
    ProgramConfig::optional(key).and_then(non_blank_string)
}

fn non_blank_string(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::non_blank_string;

    #[test]
    fn non_blank_string_treats_blank_values_as_missing() {
        assert_eq!(non_blank_string("   ".to_string()), None);
        assert_eq!(
            non_blank_string(" https://example.com ".to_string()),
            Some("https://example.com".to_string())
        );
    }
}
