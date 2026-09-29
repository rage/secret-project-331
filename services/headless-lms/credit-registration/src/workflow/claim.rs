//! A row a phase claimed, and the state its answer's write expects to find it in.

use chrono::{DateTime, Utc};
use headless_lms_models::credit_registrations::{CreditRegistration, CreditRegistrationState};
use headless_lms_models::library::credit_registration::outcomes::RowFacts;
use uuid::Uuid;

/// A claimed row. Every answer and refusal is written against it, and lands only if the row is
/// still in [`Self::expected_state`]: the decision was made from a snapshot that the request, or
/// just the gap since the claim, may have let another writer overtake.
pub(crate) struct ClaimedRegistration {
    registration: CreditRegistration,
    expected_state: CreditRegistrationState,
}

impl ClaimedRegistration {
    /// The claim moves the row into `in_flight` before the request leaves.
    pub(crate) fn moved_to(
        registration: CreditRegistration,
        in_flight: CreditRegistrationState,
    ) -> Self {
        Self {
            registration,
            expected_state: in_flight,
        }
    }

    /// The claim leaves the row where it stands, such as a verify lease or a parked check.
    pub(crate) fn left_in_place(registration: CreditRegistration) -> Self {
        Self {
            expected_state: registration.state,
            registration,
        }
    }

    /// The row as claimed: its `state` is the one it had before the claim moved it.
    pub(crate) fn registration(&self) -> &CreditRegistration {
        &self.registration
    }

    pub(crate) fn id(&self) -> Uuid {
        self.registration.id
    }

    /// The row back, to be claimed again as expecting the state the claim's own move just wrote.
    pub(crate) fn into_registration(self) -> CreditRegistration {
        self.registration
    }

    pub(crate) fn expected_state(&self) -> CreditRegistrationState {
        self.expected_state
    }

    pub(crate) fn facts(&self, now: DateTime<Utc>) -> RowFacts {
        RowFacts::of(&self.registration, now)
    }
}

/// A batch row: its claim, and whatever the flow's claim read alongside it, which the answer is
/// applied with.
pub(crate) struct Claimed<Extra> {
    pub claim: ClaimedRegistration,
    pub extra: Extra,
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;

    use super::*;
    use crate::test_fixtures::registration;

    #[test]
    fn a_moving_claim_expects_its_in_flight_state_and_keeps_the_row_as_read() {
        let claim = ClaimedRegistration::moved_to(
            registration(State::CheckingEnrolment),
            State::Submitting,
        );
        assert_eq!(claim.expected_state(), State::Submitting);
        assert_eq!(claim.registration().state, State::CheckingEnrolment);
    }

    #[test]
    fn a_claim_in_place_expects_the_state_it_found() {
        let claim = ClaimedRegistration::left_in_place(registration(State::NoUsableEnrolment));
        assert_eq!(claim.expected_state(), State::NoUsableEnrolment);
    }
}
