//! What the phases decide, without the database or the registry adapter: the claim a decision is
//! written against, the decision itself, the moves a claim makes, and what an iteration counts.

mod claim;
mod counts;
mod decision;
mod refusal;
pub(crate) mod transitions;

pub(crate) use claim::ClaimedRegistration;
pub(crate) use counts::{Counts, Prepared};
pub(crate) use decision::{Applied, AtomicChanges, Decision, PayloadChange, PreTransitionChanges};
pub(crate) use refusal::{Refusal, refusal_decision};
