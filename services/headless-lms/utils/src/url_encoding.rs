use bytes::Bytes;
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, percent_decode_str, utf8_percent_encode};

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

/// Percent-encodes the characters RFC 3986 forbids in a URI reference's fragment.
///
/// Unlike [`url_encode`], the fragment's own syntax survives: the leading `#`, the `/` and `?`
/// separators, the sub-delimiters and any existing `%XX` escape all pass through. Use it for
/// values that are URI references rather than opaque data, such as JSON Schema `$ref`s.
pub fn percent_encode_fragment(reference: &str) -> String {
    utf8_percent_encode(reference, FRAGMENT_FORBIDDEN).to_string()
}

/// What to encode: everything the `fragment = *( pchar / "/" / "?" )` production disallows, except
/// `#` and `%`, which are left alone so that a whole URI reference and its existing escapes survive.
const FRAGMENT_FORBIDDEN: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'.')
    .remove(b'_')
    .remove(b'~')
    .remove(b'!')
    .remove(b'$')
    .remove(b'&')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')')
    .remove(b'*')
    .remove(b'+')
    .remove(b',')
    .remove(b';')
    .remove(b'=')
    .remove(b':')
    .remove(b'@')
    .remove(b'/')
    .remove(b'?')
    .remove(b'#')
    .remove(b'%');

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_a_value_through_encoding() {
        let value = "Hello, wörld! / 100%";
        let encoded = url_encode(value);
        assert_eq!(
            url_decode(std::str::from_utf8(&encoded).unwrap()).unwrap(),
            value
        );
    }

    #[test]
    fn fragment_encoding_keeps_the_reference_syntax() {
        assert_eq!(
            percent_encode_fragment("#/definitions/TopLevelSpec"),
            "#/definitions/TopLevelSpec"
        );
    }

    #[test]
    fn fragment_encoding_escapes_what_a_fragment_may_not_contain() {
        assert_eq!(
            percent_encode_fragment("#/definitions/MarkPropDef<(Gradient|string|null)>"),
            "#/definitions/MarkPropDef%3C(Gradient%7Cstring%7Cnull)%3E"
        );
    }

    #[test]
    fn fragment_encoding_leaves_an_existing_escape_alone() {
        assert_eq!(
            percent_encode_fragment("#/definitions/A%20B"),
            "#/definitions/A%20B"
        );
    }
}
