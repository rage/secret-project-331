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
    restamp_resolving_enrolment, transition_batch,
};
use headless_lms_models::library::credit_registration::outcomes::resolving_enrolment;
use headless_lms_utils::prelude::Utc;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::registry::StudyRegistry;
use crate::use_cases::batch_flow::{BatchFlowContext, run_registry_batch_flow};
use crate::workflow::{ClaimedRegistration, Counts};

use enrolments::ResolveEnrolments;
use persons::ResolvePersonIds;

pub(crate) async fn run<R: StudyRegistry>(
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    let mut counts = run_registry_batch_flow::<ResolvePersonIds, _>(ctx, registry).await?;
    counts += run_registry_batch_flow::<ResolveEnrolments, _>(ctx, registry).await?;
    Ok(counts)
}

/// Which kind of lookup a claimed row is on, read from the state it was claimed in.
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
}

/// Claims `row` for its lookup, expecting the in-flight state [`hold_in_flight`] writes in the
/// claim's transaction.
fn claim_for_lookup(row: CreditRegistration) -> ClaimedRegistration {
    let in_flight = Lookup::of(&row).in_flight_state();
    ClaimedRegistration::moved_to(row, in_flight)
}

/// Keeps the claimed rows from being claimed again, or imported, while their lookups are out. In the
/// claim's transaction, whose lock makes each move's guard a confirmation of the state it read.
async fn hold_in_flight<'a>(
    conn: &mut PgConnection,
    claims: impl IntoIterator<Item = &'a ClaimedRegistration>,
) -> CreditRegistrationResult<()> {
    let now = Utc::now();
    let (first_resolves, parked_ids) = split_by_lookup(claims);
    let moves: Vec<BatchMove> = first_resolves
        .into_iter()
        .map(|claim| BatchMove {
            id: claim.id(),
            transition: resolving_enrolment().transition(Some(claim.registration().state), now),
        })
        .collect();
    transition_batch(conn, &moves).await?;
    claim_enrolment_checks(conn, &parked_ids).await?;
    Ok(())
}

/// Restarts the recovery grace of the rows a split still holds before each resent half, so a split
/// that outlasts it does not see them recovered, and their answers discarded, meanwhile.
async fn keep_lookups_in_flight<'a>(
    conn: &mut PgConnection,
    claims: impl IntoIterator<Item = &'a ClaimedRegistration>,
) -> CreditRegistrationResult<()> {
    let (first_resolves, parked_ids) = split_by_lookup(claims);
    let resolving_ids: Vec<Uuid> = first_resolves.iter().map(|claim| claim.id()).collect();
    restamp_resolving_enrolment(conn, &resolving_ids).await?;
    claim_enrolment_checks(conn, &parked_ids).await?;
    Ok(())
}

/// First resolves, which wait in `resolving_enrolment`, apart from parked checks, which stay where
/// they are under a check claim.
fn split_by_lookup<'a>(
    claims: impl IntoIterator<Item = &'a ClaimedRegistration>,
) -> (Vec<&'a ClaimedRegistration>, Vec<Uuid>) {
    let mut first_resolves = Vec::new();
    let mut parked_ids = Vec::new();
    for claim in claims {
        match Lookup::of(claim.registration()) {
            Lookup::FirstResolve => first_resolves.push(claim),
            Lookup::ParkedCheck => parked_ids.push(claim.id()),
        }
    }
    (first_resolves, parked_ids)
}
