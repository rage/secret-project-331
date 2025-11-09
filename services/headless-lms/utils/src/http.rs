use once_cell::sync::Lazy;
use std::env;

pub static REQWEST_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    // if ApplicationConfiguration was static these env var fetches wouldn't
    // need to be made...
    let http_test_mode: bool = env::var("USE_MOCK_AZURE_CONFIGURATION")
        .is_ok_and(|v| v.as_str() != "false")
        && env::var("TEST_MODE").is_ok();
    if http_test_mode {
        warn!("Test environment. REQWEST_CLIENT is allowed to make http requests");
    }

    reqwest::Client::builder()
        .use_rustls_tls()
        .https_only(false)
        .build()
        .expect("Failed to build Client")
});
