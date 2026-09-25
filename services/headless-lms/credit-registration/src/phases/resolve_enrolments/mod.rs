//! The `resolve-enrolments` phase: which enrolment the attainment belongs to, and what we will send.
//!
//! Ends with the payload frozen and the row queued for import in `checking_enrolment`, never
//! `submitting`: that state means a request may be in flight, and is the import phase's to write.
//!
//! The row spends the Suotar round trip itself in `resolving_enrolment`, not `checking_enrolment`:
//! `import`'s claim query reads the latter, and the row's own claim lock is gone as soon as the
//! preflight transaction commits. Landing in a state `import` does not claim keeps a second tick of
//! `import` from sending a request before the enrolment this one resolves is known.
//!
//! A row parked in `no_usable_enrolment` is checked where it stands instead, under
//! [`claim_enrolment_check`], so a check that finds nothing leaves it there with only its schedule
//! and last check time moved.
//!
//! Each iteration first looks up the Sisu person for links that lack one; see [`persons`].

mod enrolments;
mod persons;

use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationState, Transition, claim_enrolment_check, transition,
};
use sqlx::PgConnection;

use crate::batch_phase::run_suotar_batch_phase;
use crate::dispatch::{Counts, Iteration};
use crate::error::CreditRegistrationResult;

use enrolments::ResolveEnrolments;
use persons::ResolvePersonIds;

pub(crate) async fn run(it: &mut Iteration<'_>) -> CreditRegistrationResult<Counts> {
    let mut counts = run_suotar_batch_phase(&mut ResolvePersonIds, it).await?;
    counts += run_suotar_batch_phase(&mut ResolveEnrolments, it).await?;
    Ok(counts)
}

/// Which kind of lookup a claimed row is on, decided once, at claim time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Lookup {
    /// On its way to a first resolve, from `ready_to_submit`.
    FirstResolve,
    /// Parked in `no_usable_enrolment`, and checked where it stands.
    ParkedCheck,
}

impl Lookup {
    fn of(row: &CreditRegistration) -> Self {
        if row.state == CreditRegistrationState::NoUsableEnrolment {
            Self::ParkedCheck
        } else {
            Self::FirstResolve
        }
    }

    /// The state the row waits out the call in, which the answer's write expects to find.
    fn in_flight_state(self) -> CreditRegistrationState {
        match self {
            Self::FirstResolve => CreditRegistrationState::ResolvingEnrolment,
            Self::ParkedCheck => CreditRegistrationState::NoUsableEnrolment,
        }
    }

    /// Keeps the row from being claimed again, or imported, while its lookup is out. In the claim's
    /// transaction.
    async fn hold(
        self,
        conn: &mut PgConnection,
        row: &CreditRegistration,
    ) -> CreditRegistrationResult<()> {
        match self {
            Self::FirstResolve => {
                transition(
                    conn,
                    row.id,
                    &Transition::to(CreditRegistrationState::ResolvingEnrolment),
                )
                .await?;
            }
            Self::ParkedCheck => claim_enrolment_check(conn, row.id).await?,
        }
        Ok(())
    }
}
