//! What withdrawing consent does to a registration that is already under way.
//!
//! Withdrawal stops future submissions and stops polling the ones already sent. Whether Sisu
//! recorded a sent one is then unknowable to us forever, which is why the in-flight rows get a
//! state of their own rather than a flag: a flag would have to be remembered by the claim query,
//! the stuck detector, the funnel and every alert rule, and one of them would forget.

use crate::credit_registrations::{CreditRegistrationState, RegistrationScope};
use crate::prelude::*;

use super::preconditions::{PRECONDITIONS_LIMIT, recompute_preconditions};

/// Applies a consent answer to the student's registrations on that course.
///
/// Called by the consent endpoints inside the transaction that writes the consent, so the student
/// sees the effect on the page they are looking at. The precondition phase applies the same rules to
/// anything that changed between ticks, so this is a shortcut rather than the only path.
pub async fn apply_consent_change(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<i64> {
    recompute_preconditions(
        conn,
        &RegistrationScope {
            user_id: Some(user_id),
            course_id: Some(course_id),
            credit_registration_ids: Vec::new(),
        },
        PRECONDITIONS_LIMIT,
    )
    .await
}

/// The state a row moves to when the student withdraws consent, or `None` when withdrawal changes
/// nothing about it.
pub fn withdrawal_target(state: CreditRegistrationState) -> Option<CreditRegistrationState> {
    use CreditRegistrationState as State;
    match state {
        // The request is out of our hands and we stop asking about it.
        State::Submitting | State::SubmissionUncertain | State::AwaitingVerification => {
            Some(State::AbandonedByConsentWithdrawal)
        }
        // Nothing was sent, so there is nothing to be uncertain about. Blocked rather than
        // cancelled: consent can come back, and a terminal row could never be revived because one
        // completion may hold only one live registration.
        State::PendingPrerequisites
        | State::PendingConsent
        | State::PendingStudentNumber
        | State::ReadyToSubmit
        | State::CheckingEnrolment
        | State::NoUsableEnrolment
        | State::FailedRetryable => Some(State::Blocked),
        // We cannot un-register from Sisu, and a row only a human moves is not ours to move.
        State::Blocked
        | State::Registered
        | State::Duplicate
        | State::NotImproved
        | State::Misregistered
        | State::FailedPermanent
        | State::Cancelled
        | State::AbandonedByConsentWithdrawal => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use CreditRegistrationState as State;

    #[test]
    fn withdrawal_from_every_state_is_decided() {
        let expected = [
            (State::PendingPrerequisites, Some(State::Blocked)),
            (State::PendingConsent, Some(State::Blocked)),
            (State::PendingStudentNumber, Some(State::Blocked)),
            (State::ReadyToSubmit, Some(State::Blocked)),
            (State::CheckingEnrolment, Some(State::Blocked)),
            (State::NoUsableEnrolment, Some(State::Blocked)),
            (State::FailedRetryable, Some(State::Blocked)),
            (State::Submitting, Some(State::AbandonedByConsentWithdrawal)),
            (
                State::SubmissionUncertain,
                Some(State::AbandonedByConsentWithdrawal),
            ),
            (
                State::AwaitingVerification,
                Some(State::AbandonedByConsentWithdrawal),
            ),
            (State::Registered, None),
            (State::Duplicate, None),
            (State::NotImproved, None),
            (State::Misregistered, None),
            (State::FailedPermanent, None),
            (State::Blocked, None),
            (State::Cancelled, None),
            (State::AbandonedByConsentWithdrawal, None),
        ];
        assert_eq!(expected.len(), CreditRegistrationState::ALL.len());
        for (state, target) in expected {
            assert_eq!(withdrawal_target(state), target, "{state:?}");
        }
    }

    /// The verify poller claims exactly these two states, so moving the row out of them is what
    /// stops the polling. No extra predicate anywhere has to remember withdrawal.
    #[test]
    fn withdrawal_moves_every_polled_state_out_of_the_pollers_reach() {
        for state in [State::AwaitingVerification, State::SubmissionUncertain] {
            assert_eq!(
                withdrawal_target(state),
                Some(State::AbandonedByConsentWithdrawal)
            );
        }
    }

    /// Abandonment is neither a success nor a failure, and nothing may count it as either.
    #[test]
    fn an_abandoned_row_is_terminal_and_in_neither_set() {
        assert!(State::AbandonedByConsentWithdrawal.is_terminal());
        assert!(!State::AbandonedByConsentWithdrawal.is_success());
        assert!(!State::AbandonedByConsentWithdrawal.is_failure());
    }

    /// Re-consenting must not put a row that was already sent back in front of the poller: its Sisu
    /// outcome is unknowable, and a fresh attempt would be a second attainment.
    #[test]
    fn abandonment_is_never_undone() {
        assert_eq!(withdrawal_target(State::AbandonedByConsentWithdrawal), None);
    }
}
