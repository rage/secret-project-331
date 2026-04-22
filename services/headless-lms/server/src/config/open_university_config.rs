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
            course_url: ProgramConfig::optional(OPEN_UNIVERSITY_COURSE_URL),
            token: ProgramConfig::optional(OPEN_UNIVERSITY_TOKEN),
            rust_log: ProgramConfig::optional("RUST_LOG"),
        }
    }
}
