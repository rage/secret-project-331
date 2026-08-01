//! What a student is told about one credit registration.
//!
//! Computed here rather than in the frontend so the copy and the state machine cannot drift: the
//! eighteen ledger states collapse onto nine, and a state added later has to be classified in this
//! file before it compiles.

use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
use crate::prelude::*;

/// The stage a student sees, and which of the four steps of the status stepper it belongs to.
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
            // not_improved is a success for the student: Sisu holds an equal or better attainment,
            // so the credit exists. The difference belongs in a footnote, not in a different stage.
            State::Registered | State::Duplicate | State::NotImproved => Self::Registered,
            State::Misregistered | State::FailedPermanent => Self::Failed,
            State::Blocked | State::Cancelled | State::AbandonedByConsentWithdrawal => {
                Self::NotRegistering
            }
        }
    }

    /// Whether the pipeline is still expected to move this row on its own, which is what decides
    /// whether the status page keeps polling.
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

    #[test]
    fn every_ledger_state_maps_to_the_documented_stage() {
        let cases = [
            (State::PendingPrerequisites, Status::WaitingForCompletion),
            (State::PendingConsent, Status::NeedsConsent),
            (State::PendingStudentNumber, Status::NeedsStudentNumber),
            (State::ReadyToSubmit, Status::InProgress),
            (State::CheckingEnrolment, Status::InProgress),
            (State::Submitting, Status::InProgress),
            (State::FailedRetryable, Status::InProgress),
            (State::NoUsableEnrolment, Status::NeedsEnrolment),
            (State::SubmissionUncertain, Status::WaitingForSisu),
            (State::AwaitingVerification, Status::WaitingForSisu),
            (State::Registered, Status::Registered),
            (State::Duplicate, Status::Registered),
            (State::NotImproved, Status::Registered),
            (State::Misregistered, Status::Failed),
            (State::FailedPermanent, Status::Failed),
            (State::Blocked, Status::NotRegistering),
            (State::Cancelled, Status::NotRegistering),
            (State::AbandonedByConsentWithdrawal, Status::NotRegistering),
        ];
        assert_eq!(cases.len(), CreditRegistrationState::ALL.len());
        for (state, expected) in cases {
            assert_eq!(Status::of(state), expected, "{state:?}");
        }
    }

    /// A retrying row is still working and an unconfirmed one is still waiting, so both keep the
    /// status page refreshing. A row waiting on the student does not: nothing will change until
    /// they act.
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

    /// Withdrawal is neither a success nor a failure, and telling a student it failed would be a
    /// lie about a registration Sisu may well hold.
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
