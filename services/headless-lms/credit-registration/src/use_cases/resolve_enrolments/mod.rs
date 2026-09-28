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
//! [`claim_enrolment_checks`], so a check that finds nothing leaves it there with only its schedule
//! and last check time moved.
//!
//! Each iteration first looks up the Sisu person for links that lack one; see [`persons`].

mod enrolments;
mod persons;

use headless_lms_models::credit_registrations::{
    BatchMove, CreditRegistration, CreditRegistrationState, claim_enrolment_checks,
    transition_batch,
};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::domain::{ClaimedRegistration, Counts, transitions};
use crate::error::CreditRegistrationResult;
use crate::registry::StudyRegistry;
use crate::use_cases::batch_flow::run_registry_batch_flow;
use crate::use_cases::contexts::BatchFlowContext;

use enrolments::ResolveEnrolments;
use persons::ResolvePersonIds;

pub(crate) async fn run<R: StudyRegistry>(
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    let mut counts = run_registry_batch_flow(&mut ResolvePersonIds, ctx, registry).await?;
    counts += run_registry_batch_flow(&mut ResolveEnrolments, ctx, registry).await?;
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

    /// The claim of `row` for this lookup, which [`hold`] makes good in the claim's transaction.
    fn claim(self, row: CreditRegistration) -> ClaimedRegistration {
        ClaimedRegistration::moved_to(row, self.in_flight_state())
    }
}

/// Keeps the claimed rows from being claimed again, or imported, while their lookups are out. In the
/// claim's transaction.
async fn hold(
    conn: &mut PgConnection,
    rows: impl IntoIterator<Item = (Uuid, Lookup)>,
) -> CreditRegistrationResult<()> {
    let (first_resolves, parked_checks): (Vec<_>, Vec<_>) = rows
        .into_iter()
        .partition(|&(_, lookup)| lookup == Lookup::FirstResolve);
    let moves: Vec<BatchMove> = first_resolves
        .into_iter()
        .map(|(id, _)| BatchMove {
            id,
            transition: transitions::resolving_enrolment(),
        })
        .collect();
    transition_batch(conn, &moves).await?;
    let parked_ids: Vec<Uuid> = parked_checks.into_iter().map(|(id, _)| id).collect();
    claim_enrolment_checks(conn, &parked_ids).await?;
    Ok(())
}
