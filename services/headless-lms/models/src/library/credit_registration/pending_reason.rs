//! Why a `pending` ledger row is still pending.
//!
//! The ledger records only that a row is waiting, never what for: the answer changes the moment the
//! student consents or links a number, and a stored copy would be a cache to keep true. Every
//! surface that names the blocker derives it here, from the same facts
//! `preconditions::pending_moves` decides the row's next state from.

use utoipa::ToSchema;

use crate::prelude::*;

/// What a `pending` row is waiting for.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationPendingReason {
    /// The completion is not registrable yet: a prerequisite module, or a suspected-cheating review.
    Completion,
    Consent,
    StudentNumber,
}

/// The preconditions a submission waits on, as they stand for one ledger row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PendingPreconditions {
    pub completion_eligible: bool,
    pub consented: bool,
    pub has_verified_student_number: bool,
}

impl PendingPreconditions {
    /// Nothing outstanding, which is what a row about to leave `pending` looks like.
    pub const ALL_MET: Self = Self {
        completion_eligible: true,
        consented: true,
        has_verified_student_number: true,
    };

    /// The first unmet precondition, or `None` once all of them are met and the next precondition
    /// tick moves the row on.
    ///
    /// The order is the recompute's own: it is what decides which single thing a student is asked
    /// for, and asking for consent before the completion is even registrable would be asking early.
    pub fn reason(self) -> Option<CreditRegistrationPendingReason> {
        if !self.completion_eligible {
            Some(CreditRegistrationPendingReason::Completion)
        } else if !self.consented {
            Some(CreditRegistrationPendingReason::Consent)
        } else if !self.has_verified_student_number {
            Some(CreditRegistrationPendingReason::StudentNumber)
        } else {
            None
        }
    }
}

/// Live `pending` rows per blocker, for the surfaces that used to read the three states off the
/// ledger.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Default, ToSchema)]
pub struct PendingReasonCounts {
    pub completion_count: i64,
    pub consent_count: i64,
    pub student_number_count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use CreditRegistrationPendingReason as Reason;

    /// A student is asked for one thing at a time, in the order the pipeline needs them.
    #[test]
    fn the_first_unmet_precondition_is_the_one_reported() {
        assert_eq!(PendingPreconditions::ALL_MET.reason(), None);
        assert_eq!(
            PendingPreconditions {
                completion_eligible: false,
                consented: false,
                has_verified_student_number: false,
            }
            .reason(),
            Some(Reason::Completion)
        );
        assert_eq!(
            PendingPreconditions {
                consented: false,
                ..PendingPreconditions::ALL_MET
            }
            .reason(),
            Some(Reason::Consent)
        );
        assert_eq!(
            PendingPreconditions {
                has_verified_student_number: false,
                ..PendingPreconditions::ALL_MET
            }
            .reason(),
            Some(Reason::StudentNumber)
        );
    }
}
