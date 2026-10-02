//! The workflow types the phases share: the claim a decision is written against, the decision and
//! its guarded write, what a refused row gets, and what an iteration counts. The moves themselves
//! are models' `outcomes`.

mod claim;
mod counts;
mod decision;
mod refusal;

pub(crate) use claim::{Claimed, ClaimedRegistration};
pub(crate) use counts::Counts;
pub(crate) use decision::{
    Applied, Decision, PayloadChange, write_decision, write_decision_committing_if_written,
    write_unasked_move,
};
pub(crate) use refusal::RefusalPolicy;
