use once_cell::sync::Lazy;
use rand::{distributions::Alphanumeric, thread_rng, Rng};
use regex::Regex;

static IETF_LANGUAGE_CODE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[a-z]{2,3}(-[A-Z][a-z]{3})?-[A-Z]{2}$")
        .expect("Invalid IETF language code regex.")
});

pub fn generate_random_string(length: usize) -> String {
    thread_rng()
        .sample_iter(Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}

/// Checks whether the string is IETF language code where subtags are separated with underscore.
pub fn is_ietf_language_code_like(string: &str) -> bool {
    IETF_LANGUAGE_CODE_REGEX.is_match(string)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn ietf_language_code_validation_works() {
        // Invalid scenarios
        assert!(!is_ietf_language_code_like(""));
        assert!(!is_ietf_language_code_like("en"));
        assert!(!is_ietf_language_code_like("en_us"));
        assert!(!is_ietf_language_code_like("en_US"));
        assert!(!is_ietf_language_code_like("in-cans"));
        assert!(!is_ietf_language_code_like("in-cans-ca"));

        // Valid scenarios
        assert!(is_ietf_language_code_like("en-US"));
        assert!(is_ietf_language_code_like("in-Cans-CA"));
    }
}
