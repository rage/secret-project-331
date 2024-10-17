use once_cell::sync::Lazy;

pub static REQWEST_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .use_rustls_tls()
        .https_only(true)
        .build()
        .expect("Failed to build Client")
});
