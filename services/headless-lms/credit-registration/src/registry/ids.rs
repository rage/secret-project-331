//! The identifiers the study registry's requests and answers carry.

use std::borrow::Borrow;

use secrecy::{ExposeSecret, SecretString};

/// A student number sent to the study registry. Its `Debug` is redacted.
#[derive(Debug, Clone)]
pub(crate) struct StudentNumber(SecretString);

impl StudentNumber {
    pub(crate) fn new(number: impl Into<SecretString>) -> Self {
        Self(number.into())
    }

    pub(crate) fn as_secret(&self) -> &SecretString {
        &self.0
    }

    pub(crate) fn expose(&self) -> &str {
        self.0.expose_secret()
    }
}

/// A University of Helsinki course code, as stored: callers trim where the request needs it.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub(crate) struct CourseCode(String);

impl CourseCode {
    pub(crate) fn new(code: impl Into<String>) -> Self {
        Self(code.into())
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

impl Borrow<str> for CourseCode {
    fn borrow(&self) -> &str {
        &self.0
    }
}

/// The id of an attainment our submission created in Sisu.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AttainmentId(String);

impl AttainmentId {
    pub(crate) fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

/// The submission an import answer names, to verify it by.
pub(crate) struct SubmittedAttainmentRef {
    pub id: AttainmentId,
    pub attainment_type: Option<String>,
}
