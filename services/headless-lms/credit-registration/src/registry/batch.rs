//! One batch request to the study registry and what came of it, row by row.

use chrono::{DateTime, Utc};
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use uuid::Uuid;

use super::ids::StudentNumber;
use super::{RegistryError, RegistryOperation, StudyRegistry};

/// What one item of a batch operation asks: the item decides the operation it goes out under and the
/// answer it gets back.
pub(crate) trait BatchRequest: Sized {
    const OPERATION: RegistryOperation;
    type Answer;

    /// Sends `entries` in one request of [`Self::OPERATION`].
    async fn send<Registry: StudyRegistry, K>(
        registry: &mut Registry,
        entries: Vec<BatchEntry<K, Self>>,
        options: BatchOptions,
    ) -> BatchReply<K, Self, Self::Answer>;
}

/// One claimed row of a batch and the item it asks.
pub(crate) struct BatchEntry<K, R> {
    pub row: K,
    pub request: R,
}

/// How one batch request is sent and accounted for.
#[derive(Debug, Clone)]
pub(crate) struct BatchOptions {
    /// Every row takes the shared request-level refusal, so a malformed-request refusal of a batch
    /// of several rows comes back as [`BatchReply::RefusedAsMalformed`] for the caller to split.
    pub may_split: bool,
    /// A half of a batch refused as malformed, which the limiter lets through past its allowance.
    pub is_resent_half: bool,
    /// The iteration's error when every item comes back unavailable.
    pub all_unavailable_error: &'static str,
    /// The rows' registrations, which the call is tagged with in the audit log.
    pub registration_ids: Vec<Uuid>,
}

/// What came of one batch request.
pub(crate) enum BatchReply<K, R, A> {
    /// Every row, in request order; a row the registry did not answer has no answer.
    Answered(Vec<AnsweredRow<K, A>>),
    /// The request failed as a whole.
    Refused {
        rows: Vec<RefusedRow<K>>,
        error: RegistryError,
        refused_for: RefusedFor,
    },
    /// A splittable batch of several rows refused as malformed. Suotar validates every item before
    /// acting on any, so nothing was acted on, and no breaker counts it; the rows come back as
    /// sent, for the caller to resend in halves.
    RefusedAsMalformed {
        entries: Vec<BatchEntry<K, R>>,
        error: RegistryError,
    },
}

/// Whose a whole-request refusal is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RefusedFor {
    WholeBatch,
    /// A malformed request refused with the row alone in it, which resending cannot fix.
    RowAlone,
}

pub(crate) struct AnsweredRow<K, A> {
    pub row: K,
    pub answer: Option<A>,
    pub audit: ExchangeAudit,
}

pub(crate) struct RefusedRow<K> {
    pub row: K,
    pub audit: ExchangeAudit,
}

/// The exchange behind one row's answer, as its ledger event records it. No `Debug`: the bodies are
/// unscrubbed, and are scrubbed only on their way into the event row.
pub(crate) struct ExchangeAudit {
    /// `suotar_api_calls.id`; `None` on a refusal, or when the call row could not be written.
    pub call_id: Option<Uuid>,
    pub endpoint: SuotarEndpoint,
    /// Taken just before the request left.
    pub requested_at: DateTime<Utc>,
    /// Taken when the answer or refusal arrived.
    pub answered_at: DateTime<Utc>,
    /// What the row's item went out under in that request.
    pub request_item_id: String,
    pub request: serde_json::Value,
    /// The row's item exactly as it arrived.
    pub response: Option<serde_json::Value>,
    /// The number the request carried, which may no longer be the linked one.
    pub sent_student_number: Option<StudentNumber>,
}
