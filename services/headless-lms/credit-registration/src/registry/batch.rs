//! One batch request to the study registry and what came of it, row by row.

use uuid::Uuid;

use super::audit::ExchangeAudit;
use super::error::RegistryError;

/// One row of a batch and the item it asks.
pub(crate) struct BatchEntry<K, R> {
    pub row: K,
    pub registration_id: Uuid,
    pub request: R,
}

/// The rows one request carries, in the order they go out.
pub(crate) struct RequestBatch<K, R> {
    entries: Vec<BatchEntry<K, R>>,
    /// Every row takes the shared request-level refusal, so a malformed-request refusal is split
    /// to find the rows it is down to.
    may_split: bool,
    /// Split off a refused batch, so the limiter lets it through past its allowance.
    is_resent_half: bool,
    /// The iteration's error when every item comes back unavailable.
    all_unavailable_error: &'static str,
}

impl<K, R> RequestBatch<K, R> {
    pub(crate) fn new(
        entries: Vec<BatchEntry<K, R>>,
        may_split: bool,
        all_unavailable_error: &'static str,
    ) -> Self {
        Self {
            entries,
            may_split,
            is_resent_half: false,
            all_unavailable_error,
        }
    }

    pub(crate) fn entries(&self) -> &[BatchEntry<K, R>] {
        &self.entries
    }

    pub(crate) fn may_split(&self) -> bool {
        self.may_split
    }

    pub(crate) fn is_resent_half(&self) -> bool {
        self.is_resent_half
    }

    pub(crate) fn all_unavailable_error(&self) -> &'static str {
        self.all_unavailable_error
    }

    pub(crate) fn into_entries(self) -> Vec<BatchEntry<K, R>> {
        self.entries
    }

    /// The two halves to resend, each in a request of its own, the first half first.
    pub(crate) fn split(self) -> (Self, Self) {
        let Self {
            entries: mut first,
            may_split,
            all_unavailable_error,
            ..
        } = self;
        let second = first.split_off(first.len() / 2);
        let half = |entries: Vec<BatchEntry<K, R>>| Self {
            entries,
            may_split,
            is_resent_half: true,
            all_unavailable_error,
        };
        (half(first), half(second))
    }
}

/// What came of one batch request.
pub(crate) enum BatchReply<K, R, A> {
    /// Every row, in request order; a row the registry did not answer has no answer.
    Answered(Vec<AnsweredRow<K, R, A>>),
    /// The request failed as a whole. `is_isolated` when a malformed request was refused with no
    /// other row to blame.
    Refused {
        rows: Vec<RefusedRow<K, R>>,
        error: RegistryError,
        is_isolated: bool,
    },
    /// Refused as malformed; resend `first`, then `second`.
    Split {
        first: RequestBatch<K, R>,
        second: RequestBatch<K, R>,
    },
}

pub(crate) struct AnsweredRow<K, R, A> {
    pub entry: BatchEntry<K, R>,
    pub answer: Option<A>,
    pub audit: ExchangeAudit,
}

pub(crate) struct RefusedRow<K, R> {
    pub entry: BatchEntry<K, R>,
    pub audit: ExchangeAudit,
}
