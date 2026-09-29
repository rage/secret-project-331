//! The first half of a `resolve-enrolments` iteration: the Sisu person behind a registrar-reported
//! link, which arrives with a student number only.
//!
//! Runs before the enrolment lookup freezes the payload, so the frozen row carries the person id
//! that `uq_credit_registrations_person_module` and enrolment discovery key on. Rows wait out the
//! call as the enrolment lookup's do (see [`super::Lookup`]), and a found person leaves the row
//! claimable for the second half of the same iteration.

mod decide;

use std::collections::HashMap;

use headless_lms_models::credit_registrations::claim_due_for_person_lookup;
use headless_lms_models::secret::DbSecret;
use headless_lms_models::{study_registry_student_number_conflicts, verified_student_numbers};
use headless_lms_utils::prelude::Utc;
use secrecy::ExposeSecret;
use sqlx::PgConnection;
use uuid::Uuid;

use super::{claim_for_lookup, hold_in_flight, keep_lookups_in_flight};
use crate::error::CreditRegistrationResult;
use crate::registry::{
    ExchangeAudit, FoundPerson, PersonAnswer, PersonLookup, PersonReading, StudentNumber,
};
use crate::use_cases::batch_flow::{BatchFlowContext, Prepared, RegistryBatchFlow};
use crate::workflow::{Applied, Claimed, RefusalPolicy, write_decision};

use decide::{PersonFill, refused_person_decision, unanswered_person_decision};

pub(super) struct ResolvePersonIds;

/// The account's live link, which has no Sisu person id yet.
pub(super) struct LinkMissingPerson {
    link_id: Uuid,
}

impl RegistryBatchFlow for ResolvePersonIds {
    type Extra = LinkMissingPerson;
    type Request = PersonLookup;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every person lookup came back unavailable.";
    const REFUSAL: RefusalPolicy<LinkMissingPerson> = RefusalPolicy::RequestLevel;

    /// Claims the rows the enrolment lookup would and keeps only those whose link lacks a person
    /// id; the others are left for the enrolment lookup.
    async fn claim(
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<LinkMissingPerson, PersonLookup>> {
        let claimed =
            claim_due_for_person_lookup(conn, ctx.scope, i64::try_from(limit).unwrap_or(i64::MAX))
                .await?;
        let user_ids: Vec<Uuid> = claimed.iter().map(|row| row.user_id).collect();
        let links: HashMap<Uuid, _> = verified_student_numbers::get_by_user_ids(conn, &user_ids)
            .await?
            .into_iter()
            .filter(|link| link.sisu_person_id.is_none())
            .map(|link| (link.user_id, link))
            .collect();

        let mut prepared = Prepared::new();
        for row in claimed {
            let Some(link) = links.get(&row.user_id) else {
                continue;
            };
            let person_lookup = PersonLookup {
                student_number: StudentNumber::new(link.student_number.clone()),
            };
            let row = Claimed {
                claim: claim_for_lookup(row),
                extra: LinkMissingPerson { link_id: link.id },
            };
            prepared.send(row, person_lookup);
        }
        hold_in_flight(
            conn,
            prepared.sendable().iter().map(|entry| &entry.row.claim),
        )
        .await?;
        Ok(prepared)
    }

    async fn apply_answer(
        conn: &mut PgConnection,
        row: &Claimed<LinkMissingPerson>,
        answer: Option<&PersonAnswer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let claim = &row.claim;
        let facts = claim.facts(Utc::now());
        let decision = match answer.map(|answer| &answer.reading) {
            None => unanswered_person_decision(claim.registration().state, &facts),
            Some(PersonReading::Refused { code }) => refused_person_decision(*code, &facts),
            // Written before the move and kept even if the row moved on: the link, not the row,
            // is what the person belongs to.
            Some(PersonReading::Found(person)) => fill_person_id(conn, &row.extra, person)
                .await?
                .decision(claim),
        };
        let row_error = answer.and_then(|answer| answer.error_message.as_deref());
        write_decision(conn, claim, decision.with_row_error(row_error), audit).await
    }

    async fn keep_in_flight(
        conn: &mut PgConnection,
        rows: &[&Claimed<LinkMissingPerson>],
    ) -> CreditRegistrationResult<()> {
        keep_lookups_in_flight(conn, rows.iter().map(|row| &row.claim)).await
    }
}

/// Fills the found person in on the link, or records the conflict with the link that holds it
/// already.
async fn fill_person_id(
    conn: &mut PgConnection,
    link: &LinkMissingPerson,
    person: &FoundPerson,
) -> CreditRegistrationResult<PersonFill> {
    let sisu_person_id = DbSecret::from(person.person_id.clone());
    let first_names = person.first_names.clone().map(DbSecret::from);
    let last_name = person.last_name.clone().map(DbSecret::from);
    if verified_student_numbers::fill_sisu_person_id(
        conn,
        link.link_id,
        &sisu_person_id,
        first_names.as_ref(),
        last_name.as_ref(),
    )
    .await?
    {
        return Ok(PersonFill::Filled);
    }
    let blocking =
        verified_student_numbers::get_by_sisu_person_id(conn, sisu_person_id.expose_secret())
            .await?
            .filter(|blocking| blocking.id != link.link_id);
    let Some(blocking) = blocking else {
        return Ok(PersonFill::LinkChanged);
    };
    study_registry_student_number_conflicts::record_person_conflict(
        conn,
        link.link_id,
        blocking.id,
    )
    .await?;
    Ok(PersonFill::HeldByAnotherLink)
}
