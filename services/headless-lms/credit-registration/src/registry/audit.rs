//! The exchange behind one row's answer, as its ledger event records it.

use uuid::Uuid;

use super::ids::StudentNumber;

/// No `Debug`: the bodies are unscrubbed, and are scrubbed only on their way into the event row.
pub(crate) struct ExchangeAudit {
    /// `suotar_api_calls.id`; `None` on a refusal, or when the call row could not be written.
    pub call_id: Option<Uuid>,
    /// What the row's item went out under in that request.
    pub request_item_id: String,
    pub request: serde_json::Value,
    /// The row's item exactly as it arrived.
    pub response: Option<serde_json::Value>,
    /// The number the request carried, which may no longer be the linked one.
    pub sent_student_number: Option<StudentNumber>,
}
