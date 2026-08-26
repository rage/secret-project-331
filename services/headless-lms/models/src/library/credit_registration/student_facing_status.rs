//! What a student is told about one credit registration. Computed here rather than in the frontend
//! so a new ledger state has to be classified before it compiles.

use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
use crate::prelude::*;

use super::pending_reason::{CreditRegistrationPendingReason, PendingPreconditions};

/// The stage a student sees.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StudentFacingCreditRegistrationStatus {
    WaitingForCompletion,
    NeedsConsent,
    NeedsStudentNumber,
    InProgress,
    NeedsEnrolment,
    WaitingForSisu,
    Registered,
    Failed,
    /// Nothing is happening and nothing will, until the student changes something.
    NotRegistering,
}

impl StudentFacingCreditRegistrationStatus {
    /// `preconditions` is only read for `pending`, whose whole point is that the ledger does not
    /// record which of them the row is waiting on. Pass [`PendingPreconditions::ALL_MET`] only where
    /// the row is known not to be pending.
    pub fn of(state: CreditRegistrationState, preconditions: PendingPreconditions) -> Self {
        use CreditRegistrationPendingReason as Reason;
        use CreditRegistrationState as State;
        match state {
            State::Pending => match preconditions.reason() {
                Some(Reason::Completion) => Self::WaitingForCompletion,
                Some(Reason::Consent) => Self::NeedsConsent,
                Some(Reason::StudentNumber) => Self::NeedsStudentNumber,
                // Nothing is outstanding, so the next precondition tick moves the row on.
                None => Self::InProgress,
            },
            State::ReadyToSubmit
            | State::ResolvingEnrolment
            | State::CheckingEnrolment
            | State::Submitting
            | State::FailedRetryable => Self::InProgress,
            State::NoUsableEnrolment => Self::NeedsEnrolment,
            State::SubmissionUncertain | State::AwaitingVerification => Self::WaitingForSisu,
            // not_improved means Sisu holds an equal or better attainment, so the credit exists.
            State::Registered | State::Duplicate | State::NotImproved => Self::Registered,
            State::Misregistered | State::FailedPermanent => Self::Failed,
            State::Blocked | State::Cancelled | State::AbandonedByConsentWithdrawal => {
                Self::NotRegistering
            }
        }
    }

    /// Whether the pipeline still moves this row on its own; the status page polls while it does.
    pub fn is_moving(self) -> bool {
        matches!(self, Self::InProgress | Self::WaitingForSisu)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use CreditRegistrationState as State;
    use StudentFacingCreditRegistrationStatus as Status;

    /// A row waiting on the student must not keep the page polling; nothing changes until they act.
    #[test]
    fn only_the_states_the_pipeline_still_owns_keep_the_page_polling() {
        for reason in [
            PendingPreconditions {
                completion_eligible: false,
                ..PendingPreconditions::ALL_MET
            },
            PendingPreconditions {
                consented: false,
                ..PendingPreconditions::ALL_MET
            },
            PendingPreconditions {
                has_verified_student_number: false,
                ..PendingPreconditions::ALL_MET
            },
        ] {
            assert!(
                !Status::of(State::Pending, reason).is_moving(),
                "{reason:?}"
            );
        }
        let moving = [
            // Nothing outstanding, so the recompute moves it on without the student doing anything.
            State::Pending,
            State::ReadyToSubmit,
            State::ResolvingEnrolment,
            State::CheckingEnrolment,
            State::Submitting,
            State::FailedRetryable,
            State::SubmissionUncertain,
            State::AwaitingVerification,
        ];
        for state in CreditRegistrationState::ALL {
            assert_eq!(
                Status::of(state, PendingPreconditions::ALL_MET).is_moving(),
                moving.contains(&state),
                "{state:?}"
            );
        }
    }

    /// The student's question is "do I have the credits", so every success terminal answers yes.
    #[test]
    fn the_success_set_is_one_stage() {
        for state in CreditRegistrationState::ALL {
            if state.is_success() {
                assert_eq!(
                    Status::of(state, PendingPreconditions::ALL_MET),
                    Status::Registered,
                    "{state:?}"
                );
            }
        }
    }

    /// Sisu may well hold the registration, so telling the student it failed would be a lie.
    #[test]
    fn an_abandoned_row_is_not_a_failure() {
        assert_eq!(
            Status::of(
                State::AbandonedByConsentWithdrawal,
                PendingPreconditions::ALL_MET
            ),
            Status::NotRegistering
        );
    }

    #[test]
    fn the_wire_spelling_is_snake_case() {
        assert_eq!(
            serde_json::to_value(Status::NeedsStudentNumber).unwrap(),
            serde_json::json!("needs_student_number")
        );
    }
}
