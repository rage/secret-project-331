//! What a student is told about one credit registration. Computed here rather than in the frontend
//! so a new ledger state has to be classified before it compiles.

use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
use crate::prelude::*;

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
    pub fn of(state: CreditRegistrationState) -> Self {
        use CreditRegistrationState as State;
        match state {
            State::PendingPrerequisites => Self::WaitingForCompletion,
            State::PendingConsent => Self::NeedsConsent,
            State::PendingStudentNumber => Self::NeedsStudentNumber,
            State::ReadyToSubmit
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

impl From<CreditRegistrationState> for StudentFacingCreditRegistrationStatus {
    fn from(state: CreditRegistrationState) -> Self {
        Self::of(state)
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
        let moving = [
            State::ReadyToSubmit,
            State::CheckingEnrolment,
            State::Submitting,
            State::FailedRetryable,
            State::SubmissionUncertain,
            State::AwaitingVerification,
        ];
        for state in CreditRegistrationState::ALL {
            assert_eq!(
                Status::of(state).is_moving(),
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
                assert_eq!(Status::of(state), Status::Registered, "{state:?}");
            }
        }
    }

    /// Sisu may well hold the registration, so telling the student it failed would be a lie.
    #[test]
    fn an_abandoned_row_is_not_a_failure() {
        assert_eq!(
            Status::of(State::AbandonedByConsentWithdrawal),
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
