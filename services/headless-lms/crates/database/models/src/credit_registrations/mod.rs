//! The credit registration ledger.
//!
//! [`transition`](transition::transition), and its batched twin [`transition_batch`], are the only writers of `state`,
//! stamping `state_entered_at`, the lifecycle timestamps and the audit event in one transaction.
//! Which transition to make is the caller's decision; whether it is one the machine has is decided
//! here, from [`CreditRegistrationState::allowed_targets`].

mod admin_view;
mod attention;
mod claims;
mod competing_credits;
mod metrics;
mod registration;
mod row_writes;
mod state;
mod student_view;
mod teacher_view;
pub mod testing;
#[cfg(test)]
mod tests;
mod transition;

pub use admin_view::*;
pub use attention::*;
pub use claims::*;
pub use competing_credits::*;
pub use metrics::*;
pub use registration::*;
pub use row_writes::*;
pub use state::*;
pub use student_view::*;
pub use teacher_view::*;
pub use transition::*;
