use once_cell::sync::Lazy;
use std::env;

pub static REQWEST_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    let mock_azure: bool = env::var("USE_MOCK_AZURE_CONFIGURATION").is_ok();

    reqwest::Client::builder()
        .use_rustls_tls()
        .https_only(!mock_azure)
        .build()
        .expect("Failed to build Client")
});
