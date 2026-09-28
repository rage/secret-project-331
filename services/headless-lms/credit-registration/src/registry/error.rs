//! A study registry request that failed as a whole: a value the rows' outcomes are decided from,
//! not an error of the iteration.

use headless_lms_models::library::credit_registration::study_registry::RegistryErrorKind;

pub(crate) struct RegistryError {
    kind: RegistryErrorKind,
    /// Unscrubbed; scrub it before persisting it.
    message: String,
}

impl RegistryError {
    pub(crate) fn new(kind: RegistryErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub(crate) fn kind(&self) -> RegistryErrorKind {
        self.kind
    }

    pub(crate) fn message(&self) -> &str {
        &self.message
    }

    /// Whether the failure may be down to the items the request carried. A connection that never
    /// opened, or our own credentials, say nothing about any of them.
    pub(crate) fn blames_request_items(&self) -> bool {
        !matches!(
            self.kind,
            RegistryErrorKind::NotDelivered | RegistryErrorKind::AuthenticationFailure
        )
    }
}
