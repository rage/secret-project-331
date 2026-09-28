//! The first half of a `resolve-enrolments` iteration: the Sisu person behind a registrar-reported
//! link, which arrives with a student number only.
//!
//! Runs before the enrolment lookup freezes the payload, so the frozen row carries the person id
//! that `uq_credit_registrations_person_module` and enrolment discovery key on. Rows wait out the
//! call as the enrolment lookup's do (see [`Lookup`]), and a found
//! person leaves the row claimable for the second half of the same iteration.

mod decide;

use std::collections::HashMap;

use headless_lms_models::credit_registrations::claim_due_for_person_lookup;
use headless_lms_models::secret::DbSecret;
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use headless_lms_models::{study_registry_student_number_conflicts, verified_student_numbers};
use headless_lms_utils::prelude::Utc;
use secrecy::ExposeSecret;
use sqlx::PgConnection;
use uuid::Uuid;

use super::{Lookup, hold};
use crate::domain::{Applied, ClaimedRegistration, Prepared, Refusal};
use crate::error::CreditRegistrationResult;
use crate::registry::{
    BatchReply, ExchangeAudit, FoundPerson, PersonAnswer, PersonLookup, RequestBatch,
    StudentNumber, StudyRegistry,
};
use crate::use_cases::batch_flow::RegistryBatchFlow;
use crate::use_cases::contexts::BatchFlowContext;
use crate::use_cases::persist::write_decision;

use decide::{PersonFill, PersonNextStep, decide_person_answer, person_fill_decision};

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ResolvePersons;

pub(super) struct ResolvePersonIds;

/// A claimed row whose account's live link has no Sisu person id, and that link.
pub(super) struct AwaitingPersonId {
    claim: ClaimedRegistration,
    link_id: Uuid,
    lookup: Lookup,
}

impl AsRef<ClaimedRegistration> for AwaitingPersonId {
    fn as_ref(&self) -> &ClaimedRegistration {
        &self.claim
    }
}

impl RegistryBatchFlow for ResolvePersonIds {
    type Row = AwaitingPersonId;
    type Request = PersonLookup;
    type Answer = PersonAnswer;

    const ENDPOINT: SuotarEndpoint = ENDPOINT;
    const MAY_SPLIT: bool = true;
    const ALL_UNAVAILABLE_ERROR: &'static str = "Every person lookup came back unavailable.";

    /// Claims the rows the enrolment lookup would and keeps only those whose link lacks a person
    /// id; the others are left for the enrolment lookup.
    async fn claim(
        &mut self,
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, Self::Request>> {
        let claimed = claim_due_for_person_lookup(conn, ctx.scope, limit as i64).await?;
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
            let lookup = Lookup::of(&row);
            let person_lookup = PersonLookup {
                student_number: StudentNumber::new(link.student_number.clone()),
            };
            let awaiting = AwaitingPersonId {
                claim: lookup.claim(row),
                link_id: link.id,
                lookup,
            };
            prepared.send(awaiting, person_lookup);
        }
        hold(
            conn,
            prepared
                .sendable()
                .iter()
                .map(|entry| (entry.registration_id, entry.row.lookup)),
        )
        .await?;
        Ok(prepared)
    }

    async fn send<R: StudyRegistry>(
        registry: &mut R,
        batch: RequestBatch<Self::Row, Self::Request>,
    ) -> BatchReply<Self::Row, Self::Request, Self::Answer> {
        registry.resolve_persons(batch).await
    }

    async fn persist_answer(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        answer: Option<&Self::Answer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let registration = row.claim.registration();
        let facts = row.claim.facts(Utc::now());
        let decision = match decide_person_answer(registration.state, answer, &facts) {
            PersonNextStep::Decided(decision) => decision,
            // Written before the move and kept even if the row moved on: the link, not the row,
            // is what the person belongs to.
            PersonNextStep::Found(person) => {
                let fill = fill_person_id(conn, row, person).await?;
                person_fill_decision(registration, row.lookup, fill)
            }
        };
        let row_error = answer.and_then(|answer| answer.error_message.as_deref());
        write_decision(conn, &row.claim, decision.with_row_error(row_error), audit).await
    }

    fn on_refusal(&self, _row: &Self::Row) -> Refusal {
        Refusal::RequestLevel
    }
}
/// Fills the found person in on the row's link, or records the conflict with the link that holds
/// it already.
async fn fill_person_id(
    conn: &mut PgConnection,
    row: &AwaitingPersonId,
    person: &FoundPerson,
) -> CreditRegistrationResult<PersonFill> {
    let sisu_person_id = DbSecret::from(person.person_id.clone());
    let first_names = person.first_names.clone().map(DbSecret::from);
    let last_name = person.last_name.clone().map(DbSecret::from);
    if verified_student_numbers::fill_sisu_person_id(
        conn,
        row.link_id,
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
            .filter(|blocking| blocking.id != row.link_id);
    let Some(blocking) = blocking else {
        return Ok(PersonFill::LinkChanged);
    };
    study_registry_student_number_conflicts::record_person_conflict(conn, row.link_id, blocking.id)
        .await?;
    Ok(PersonFill::HeldByAnotherLink)
}
