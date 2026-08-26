use std::time::Duration;

use headless_lms_base::config::bool_env_false_by_default;
use once_cell::sync::Lazy;

/// Total deadline for a single request/response exchange, for callers that do not set their own.
/// Never apply it to a streaming request: reqwest counts it until the response body has finished,
/// so it would cut off a long but healthy stream.
pub const NON_STREAMING_REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

/// How long a streaming request may take to produce response headers. Applied by the caller with
/// `tokio::time::timeout` around `send()`, which resolves on headers, so the body is left untimed.
pub const STREAM_RESPONSE_HEADERS_TIMEOUT: Duration = Duration::from_secs(120);

/// How long a streaming response body may go without producing a chunk before it counts as stalled.
/// Applied per chunk by the caller, unlike `ClientBuilder::read_timeout`; see `REQWEST_STREAMING_CLIENT`.
pub const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(120);

/// How long establishing the connection may take, before anything is sent.
pub const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

// Reads env vars directly instead of caching in ApplicationConfiguration, which isn't static.
fn in_http_test_mode() -> bool {
    bool_env_false_by_default("USE_MOCK_AZURE_CONFIGURATION")
        || bool_env_false_by_default("TEST_MODE")
}

/// The settings both clients share, timeouts other than the connect one left to the caller.
fn base_client_builder() -> reqwest::ClientBuilder {
    reqwest::Client::builder()
        .use_rustls_tls()
        .https_only(!in_http_test_mode())
        .connect_timeout(CONNECT_TIMEOUT)
}

pub static REQWEST_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    if in_http_test_mode() {
        warn!("Test environment. REQWEST_CLIENT is allowed to make http requests");
    }

    base_client_builder()
        // Default deadline only: a per-request `.timeout()` takes precedence over it. Deliberately
        // not `read_timeout`, whose sleep is armed once when the request is created and polled
        // before the response future, making it a flat ceiling on the wait for headers that no
        // per-request timeout can raise.
        .timeout(NON_STREAMING_REQUEST_TIMEOUT)
        .build()
        .expect("Failed to build Client")
});

/// For responses whose body is consumed as a stream. Carries no total or read timeout, because both
/// would cut off a healthy but slow stream; callers must instead bound the header wait with
/// [`STREAM_RESPONSE_HEADERS_TIMEOUT`] and each chunk with [`STREAM_IDLE_TIMEOUT`].
pub static REQWEST_STREAMING_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    base_client_builder()
        .build()
        .expect("Failed to build streaming Client")
});
