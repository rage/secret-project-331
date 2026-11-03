//! Removing personal data from free text kept or logged about an external service's answers.

use std::sync::LazyLock;

use regex::{Captures, Regex};

/// Replaces a redacted value; the key is kept so the payload shape survives.
pub const REDACTED: &str = "[redacted]";

static EMAIL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}").expect("hardcoded regex")
});

/// Student-number-shaped digit runs. The id shapes come first because the `regex` crate has no
/// lookaround: leftmost-first alternation is the only way to say "digits not part of an id". The
/// word boundaries keep the digit branch off longer numbers such as millisecond timestamps.
///
/// Known cost of the `prefixed` branch: a student number hyphen-joined to a word,
/// `person-012345678`, survives. A bare digit run, the shape Suotar's messages use, still goes.
static STUDENT_NUMBER_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?P<uuid>\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b)|(?P<prefixed>\b[A-Za-z][A-Za-z0-9-]*-[0-9]{6,12}\b)|(?P<digits>\b[0-9]{6,12}\b)",
    )
    .expect("hardcoded regex")
});

/// Removes email addresses and student-number-shaped digit runs from `text`. Best effort, not an
/// exhaustive PII filter: a name in free text is kept.
pub fn scrub_text(text: &str) -> String {
    let without_emails = EMAIL_RE.replace_all(text, REDACTED);
    STUDENT_NUMBER_RE
        .replace_all(&without_emails, |captures: &Captures| {
            // The id branches exist to beat the digit branch to the match; put them back unchanged.
            if captures.name("digits").is_some() {
                REDACTED.to_string()
            } else {
                captures[0].to_string()
            }
        })
        .into_owned()
}
