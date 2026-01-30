use bytes::Bytes;
use percent_encoding::{NON_ALPHANUMERIC, percent_decode_str, utf8_percent_encode};

/// URL-encodes a string value for use in HTTP headers or other contexts requiring ASCII-compatibility.
/// Percent-encodes all non-alphanumeric characters (including spaces, punctuation, ASCII special
/// characters, non-ASCII characters, and control characters) to preserve the original information
/// while making the value ASCII-safe for use in HTTP headers or other contexts requiring ASCII-compatibility.
pub fn url_encode(value: &str) -> Bytes {
    utf8_percent_encode(value, NON_ALPHANUMERIC)
        .to_string()
        .into()
}

/// URL-decodes a percent-encoded string back to its original UTF-8 representation.
/// Decodes percent-encoded values back to their original UTF-8 strings.
pub fn url_decode(encoded: &str) -> anyhow::Result<String> {
    percent_decode_str(encoded)
        .decode_utf8()
        .map_err(|e| anyhow::anyhow!("Failed to decode URL-encoded value: {}", e))
        .map(|s| s.to_string())
}
