use headless_lms_base::config::bool_env_false_by_default;
use once_cell::sync::Lazy;

pub static REQWEST_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    // if ApplicationConfiguration was static these env var fetches wouldn't
    // need to be made...
    let http_test_mode: bool = bool_env_false_by_default("USE_MOCK_AZURE_CONFIGURATION")
        || bool_env_false_by_default("TEST_MODE");
    if http_test_mode {
        warn!("Test environment. REQWEST_CLIENT is allowed to make http requests");
    }

    reqwest::Client::builder()
        .use_rustls_tls()
        .https_only(!http_test_mode)
        .build()
        .expect("Failed to build Client")
});
