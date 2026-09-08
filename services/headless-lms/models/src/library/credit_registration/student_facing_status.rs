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
    NeedsStudentNumber,
    /// We are still working out which enrolment to register against. Not [`Self::NeedsEnrolment`],
    /// which is the answer that there is none.
    LookingForEnrolment,
    NeedsEnrolment,
    /// An enrolment is settled and the attainment is on its way to the study registry.
    Sending,
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
    ///
    /// `enrolment_resolved` is whether the row has settled on an enrolment, which only
    /// `failed_retryable` reads: that state does not record which half of the work failed, and a
    /// retry while we are still looking for an enrolment is not a retry of the sending.
    pub fn of(
        state: CreditRegistrationState,
        preconditions: PendingPreconditions,
        enrolment_resolved: bool,
    ) -> Self {
        use CreditRegistrationPendingReason as Reason;
        use CreditRegistrationState as State;
        match state {
            State::Pending => match preconditions.reason() {
                Some(Reason::Completion) => Self::WaitingForCompletion,
                Some(Reason::StudentNumber) => Self::NeedsStudentNumber,
                // Nothing is outstanding, so the next precondition tick moves the row on.
                None => Self::LookingForEnrolment,
            },
            State::ReadyToSubmit | State::ResolvingEnrolment | State::CheckingEnrolment => {
                Self::LookingForEnrolment
            }
            State::Submitting => Self::Sending,
            State::FailedRetryable => {
                if enrolment_resolved {
                    Self::Sending
                } else {
                    Self::LookingForEnrolment
                }
            }
            State::NoUsableEnrolment => Self::NeedsEnrolment,
            State::SubmissionUncertain | State::AwaitingVerification => Self::WaitingForSisu,
            // not_improved means Sisu holds an equal or better attainment, so the credit exists.
            State::Registered | State::Duplicate | State::NotImproved => Self::Registered,
            State::Misregistered | State::FailedPermanent => Self::Failed,
            State::Blocked | State::Cancelled => Self::NotRegistering,
        }
    }

    /// Whether the pipeline still moves this row on its own; the status page polls while it does.
    pub fn is_moving(self) -> bool {
        matches!(
            self,
            Self::LookingForEnrolment | Self::Sending | Self::WaitingForSisu
        )
    }
}

/// The `(state, completion_eligible, has_verified_student_number, enrolment_resolved)` combinations
/// a set of stages covers, as parallel arrays for a query to `UNNEST` and join against.
///
/// Enumerated from [`StudentFacingCreditRegistrationStatus::of`] rather than restated as a SQL
/// predicate: a roster filtered to "failed" must return exactly the rows whose own badge says
/// failed, and a new ledger state must not be able to fall out of one side of that.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StageMatch {
    pub states: Vec<CreditRegistrationState>,
    pub completion_eligible: Vec<bool>,
    pub has_verified_student_number: Vec<bool>,
    pub enrolment_resolved: Vec<bool>,
}

impl StageMatch {
    /// Empty for an empty `stages`, which every query reads as "do not narrow".
    pub fn of(stages: &[StudentFacingCreditRegistrationStatus]) -> Self {
        let mut matched = Self::default();
        if stages.is_empty() {
            return matched;
        }
        for state in CreditRegistrationState::ALL {
            for completion_eligible in [false, true] {
                for has_verified_student_number in [false, true] {
                    for enrolment_resolved in [false, true] {
                        let preconditions = PendingPreconditions {
                            completion_eligible,
                            has_verified_student_number,
                        };
                        if stages.contains(&StudentFacingCreditRegistrationStatus::of(
                            state,
                            preconditions,
                            enrolment_resolved,
                        )) {
                            matched.states.push(state);
                            matched.completion_eligible.push(completion_eligible);
                            matched
                                .has_verified_student_number
                                .push(has_verified_student_number);
                            matched.enrolment_resolved.push(enrolment_resolved);
                        }
                    }
                }
            }
        }
        matched
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
                has_verified_student_number: false,
                ..PendingPreconditions::ALL_MET
            },
        ] {
            assert!(
                !Status::of(State::Pending, reason, false).is_moving(),
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
            for enrolment_resolved in [false, true] {
                assert_eq!(
                    Status::of(state, PendingPreconditions::ALL_MET, enrolment_resolved)
                        .is_moving(),
                    moving.contains(&state),
                    "{state:?} {enrolment_resolved}"
                );
            }
        }
    }

    /// The student's question is "do I have the credits", so every success terminal answers yes.
    #[test]
    fn the_success_set_is_one_stage() {
        for state in CreditRegistrationState::ALL {
            if state.is_success() {
                assert_eq!(
                    Status::of(state, PendingPreconditions::ALL_MET, true),
                    Status::Registered,
                    "{state:?}"
                );
            }
        }
    }

    #[test]
    fn the_wire_spelling_is_snake_case() {
        assert_eq!(
            serde_json::to_value(Status::NeedsStudentNumber).unwrap(),
            serde_json::json!("needs_student_number")
        );
    }
}
