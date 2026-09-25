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

use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationState, Transition, claim_enrolment_check, transition,
};
use sqlx::PgConnection;

use crate::batch_phase::run_suotar_batch_phase;
use crate::dispatch::PhaseContext;
use crate::phase::PhaseScope;

use enrolments::ResolveEnrolments;
use persons::ResolvePersonIds;

pub(crate) async fn run(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let persons = run_suotar_batch_phase(&mut ResolvePersonIds, ctx, scope).await?;
    let enrolments = run_suotar_batch_phase(&mut ResolveEnrolments, ctx, scope).await?;
    // The first error stands for the iteration.
    let (first, second) = if persons.error.is_some() {
        (persons, enrolments)
    } else {
        (enrolments, persons)
    };
    Ok(PhaseRunOutcome {
        items_processed: first.items_processed + second.items_processed,
        items_failed: first.items_failed + second.items_failed,
        ..first
    })
}

/// The state a row claimed for a lookup waits out the call in: a parked row stays where it is,
/// anything else moves to `resolving_enrolment`. What the answer's write expects to find.
fn lookup_state(row: &CreditRegistration) -> CreditRegistrationState {
    if row.state == CreditRegistrationState::NoUsableEnrolment {
        CreditRegistrationState::NoUsableEnrolment
    } else {
        CreditRegistrationState::ResolvingEnrolment
    }
}

/// Keeps a claimed row from being claimed again, or imported, while its lookup is out; see
/// [`lookup_state`]. In the claim's transaction.
async fn hold_for_lookup(conn: &mut PgConnection, row: &CreditRegistration) -> anyhow::Result<()> {
    if lookup_state(row) == CreditRegistrationState::NoUsableEnrolment {
        claim_enrolment_check(conn, row.id).await?;
    } else {
        transition(
            conn,
            row.id,
            &Transition::to(CreditRegistrationState::ResolvingEnrolment),
        )
        .await?;
    }
    Ok(())
}
