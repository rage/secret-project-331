//! What withdrawing consent does to a registration that is already under way. Whether Sisu recorded
//! an already-sent submission stays unknowable forever, so in-flight rows get a state of their own
//! rather than a flag every claim query, detector and alert rule would have to remember.

use crate::credit_registrations::{CreditRegistrationState, RegistrationScope};
use crate::prelude::*;

use super::preconditions::{PRECONDITIONS_LIMIT, recompute_preconditions};

/// Applies a consent answer to the student's registrations on that course, inside the transaction
/// that writes the consent. A shortcut: the precondition phase applies the same rules every tick.
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
///
/// Mirrored in SQL by the `consent_withdrawn` arms of `pending_moves`'s `CASE` in
/// `preconditions.rs`, so withdrawal is decided immediately rather than waiting for a recompute
/// tick. The two are kept in sync only by
/// `preconditions::tests::withdrawal_does_what_the_rule_says_from_every_state`, not the compiler.
pub fn withdrawal_target(state: CreditRegistrationState) -> Option<CreditRegistrationState> {
    use CreditRegistrationState as State;
    match state {
        // The request is out of our hands and we stop asking about it.
        State::Submitting | State::SubmissionUncertain | State::AwaitingVerification => {
            Some(State::AbandonedByConsentWithdrawal)
        }
        // Nothing was sent yet. Blocked rather than cancelled: consent can come back, and one
        // completion may hold only one live registration.
        State::PendingPrerequisites
        | State::PendingConsent
        | State::PendingStudentNumber
        | State::ReadyToSubmit
        | State::ResolvingEnrolment
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

    /// The verify poller claims exactly these two states, so moving the row out of them is what
    /// stops the polling.
    #[test]
    fn withdrawal_moves_every_polled_state_out_of_the_pollers_reach() {
        for state in [State::AwaitingVerification, State::SubmissionUncertain] {
            assert_eq!(
                withdrawal_target(state),
                Some(State::AbandonedByConsentWithdrawal)
            );
        }
    }

    #[test]
    fn an_abandoned_row_is_terminal_and_in_neither_set() {
        assert!(State::AbandonedByConsentWithdrawal.is_terminal());
        assert!(!State::AbandonedByConsentWithdrawal.is_success());
        assert!(!State::AbandonedByConsentWithdrawal.is_failure());
    }

    #[test]
    fn abandonment_is_never_undone() {
        assert_eq!(withdrawal_target(State::AbandonedByConsentWithdrawal), None);
    }
}
