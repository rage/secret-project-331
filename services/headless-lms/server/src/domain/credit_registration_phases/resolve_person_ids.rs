//! The first half of a `resolve-enrolments` iteration: the Sisu person behind a registrar-reported
//! link, which arrives with a student number only.
//!
//! Runs before the enrolment lookup freezes the payload, so the frozen row carries the person id
//! that `uq_credit_registrations_person_module` and enrolment discovery key on. Rows wait in
//! `resolving_enrolment` for the call, as the enrolment lookup's do, and a found person sends the
//! row back to `ready_to_submit` for the second half of the same iteration.

use std::collections::HashMap;

use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, Transition,
    claim_due, transition,
};
use headless_lms_models::library::credit_registration::classification::map_code;
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, submit_error_outcome, unanswered_item_outcome,
};
use headless_lms_models::secret::DbSecret;
use headless_lms_models::{study_registry_student_number_conflicts, verified_student_numbers};
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::services::suotar::{
    PersonResult, ResolvePersonRequestItem, SuotarBatchResponse, SuotarCallContext, SuotarEndpoint,
    SuotarItemStatus, SuotarResponseItem, new_request_item_id,
};
use secrecy::ExposeSecret;
use sqlx::PgConnection;
use uuid::Uuid;

use super::{
    CreditRegistrationPhase, OutcomeEvent, PhaseContext, PhaseScope, Prepared, SuotarBatchPhase,
    apply_outcome, apply_request_level_outcome, breaker, claim_limit, counts_as_failed, rate_limit,
    row_facts,
};

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ResolvePersons;

pub(super) struct ResolvePersonIds;

/// A claimed row whose account's live link has no Sisu person id, and that link.
pub(super) struct AwaitingPersonId {
    registration: CreditRegistration,
    link_id: Uuid,
    student_number: DbSecret,
}

impl SuotarBatchPhase for ResolvePersonIds {
    type Row = AwaitingPersonId;
    type Item = ResolvePersonRequestItem;
    type Result = PersonResult;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every person lookup came back unavailable.";

    /// Claims the ready rows and keeps only those whose link lacks a person id; the others are left
    /// for the enrolment lookup.
    async fn prepare(
        &mut self,
        _ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        scope: &PhaseScope,
    ) -> anyhow::Result<Prepared<Self::Row, Self::Item>> {
        let limit = claim_limit(scope, ENDPOINT);
        if limit == 0 {
            return Ok(Prepared::default());
        }
        let claimed = claim_due(
            conn,
            &[CreditRegistrationState::ReadyToSubmit],
            scope,
            limit as i64,
        )
        .await?;
        let user_ids: Vec<Uuid> = claimed.iter().map(|row| row.user_id).collect();
        let links: HashMap<Uuid, _> = verified_student_numbers::get_by_user_ids(conn, &user_ids)
            .await?
            .into_iter()
            .filter(|link| link.sisu_person_id.is_none())
            .map(|link| (link.user_id, link))
            .collect();

        let mut prepared = Prepared::default();
        for row in claimed {
            let Some(link) = links.get(&row.user_id) else {
                continue;
            };
            transition(
                conn,
                row.id,
                &Transition {
                    records_event: row.enrolment_check_anchor_at.is_none(),
                    ..Transition::to(CreditRegistrationState::ResolvingEnrolment)
                },
            )
            .await?;
            let item = ResolvePersonRequestItem {
                request_item_id: new_request_item_id(),
                student_number: link.student_number.clone().into(),
            };
            let awaiting = AwaitingPersonId {
                registration: row,
                link_id: link.id,
                student_number: link.student_number.clone(),
            };
            prepared.sendable.push((awaiting, item));
        }
        rate_limit::take(
            &breaker::ScopeKey::of(scope),
            ENDPOINT,
            prepared.sendable.len(),
        );
        Ok(prepared)
    }

    fn registration(row: &Self::Row) -> &CreditRegistration {
        &row.registration
    }

    fn sent_student_number(row: &Self::Row) -> Option<&DbSecret> {
        Some(&row.student_number)
    }

    async fn send(
        &self,
        ctx: &PhaseContext<'_>,
        rows: &[Self::Row],
        items: Vec<Self::Item>,
    ) -> Result<SuotarBatchResponse<Self::Result>, UtilError> {
        ctx.suotar_client
            .resolve_persons(
                SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::ResolveEnrolments))
                    .for_registrations(rows.iter().map(|row| row.registration.id).collect()),
                items,
            )
            .await
    }

    async fn apply(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        item: Option<&SuotarResponseItem<Self::Result>>,
        event: OutcomeEvent<'_>,
    ) -> anyhow::Result<bool> {
        let registration = &row.registration;
        let facts = row_facts(registration);
        let found = item.and_then(|item| {
            item.result
                .as_ref()
                .filter(|_| item.status == SuotarItemStatus::Ok)
        });
        let (outcome, message) = match (item, found) {
            (None, _) => (
                unanswered_item_outcome(ENDPOINT, registration.state, &facts),
                Some("Sisu did not answer for this item."),
            ),
            (Some(item), None) => {
                let code = if item.status == SuotarItemStatus::Ok {
                    CreditRegistrationErrorCode::UnexpectedResponse
                } else {
                    map_code(ENDPOINT, &item.code).unwrap_or(CreditRegistrationErrorCode::Unknown)
                };
                (submit_error_outcome(ENDPOINT, code, &facts), None)
            }
            (Some(_), Some(person)) => fill_person_id(conn, row, person).await?,
        };
        apply_outcome(
            conn,
            registration,
            &outcome,
            OutcomeEvent {
                message: event.message.or(message),
                error_message: event.error_message.or_else(|| {
                    item.and_then(|item| item.error.as_ref())
                        .map(|error| error.message.as_str())
                }),
                ..event
            },
            Some(CreditRegistrationState::ResolvingEnrolment),
        )
        .await?;
        Ok(counts_as_failed(&outcome))
    }

    async fn apply_request_rejection(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        request: &serde_json::Value,
        request_item_id: &str,
        error: &UtilError,
    ) -> anyhow::Result<bool> {
        apply_request_level_outcome(
            conn,
            ENDPOINT,
            &row.registration,
            request,
            request_item_id,
            error,
            CreditRegistrationState::ResolvingEnrolment,
        )
        .await
    }
}

/// Where a found person sends the row. Another account's link to the same person wins, as it does
/// for a conflicting number: the registrar's link is dropped and the clash recorded for an admin.
async fn fill_person_id(
    conn: &mut PgConnection,
    row: &AwaitingPersonId,
    person: &PersonResult,
) -> anyhow::Result<(Outcome, Option<&'static str>)> {
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
        return Ok((
            Outcome::to(CreditRegistrationState::ReadyToSubmit),
            Some("Found the Sisu person the linked student number belongs to."),
        ));
    }
    let blocking =
        verified_student_numbers::get_by_sisu_person_id(conn, sisu_person_id.expose_secret())
            .await?
            .filter(|blocking| blocking.id != row.link_id);
    let Some(blocking) = blocking else {
        return Ok((
            Outcome::to(CreditRegistrationState::Pending),
            Some("The linked student number changed while its Sisu person was looked up."),
        ));
    };
    study_registry_student_number_conflicts::record_person_conflict(conn, row.link_id, blocking.id)
        .await?;
    Ok((
        Outcome {
            drop_verified_student_number: true,
            ..Outcome::to(CreditRegistrationState::Pending)
        },
        Some(
            "Another account's link already holds the Sisu person this student number belongs to.",
        ),
    ))
}
