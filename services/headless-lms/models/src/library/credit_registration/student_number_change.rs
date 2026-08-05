//! What changing an account's linked student number does to its registrations: both the student's
//! own unlink/claim and an admin's unlink/manual-link go through this, so the audit trail and the
//! recompute stay in one place regardless of who acted.

use crate::credit_registration_events::CreditRegistrationEventKind;
use crate::credit_registrations::{
    AdminCreditRegistrationFilters, CreditRegistrationState, RegistrationScope,
};
use crate::prelude::*;

use super::preconditions::{PRECONDITIONS_LIMIT, recompute_preconditions};

/// Audits a change to `subject_user_id`'s linked student number on every registration it can affect,
/// then applies it. Returns how many registrations changed whether they wait for a number, which is
/// narrower than how many rows the recompute moved.
pub async fn record_student_number_change(
    conn: &mut PgConnection,
    subject_user_id: Uuid,
    actor_user_id: Uuid,
    event_kind: CreditRegistrationEventKind,
    message: &str,
) -> ModelResult<i64> {
    let affected: Vec<Uuid> = crate::credit_registrations::get_by_user_id(conn, subject_user_id)
        .await?
        .into_iter()
        .filter(|row| row.superseded_by_id.is_none() && row.terminal_at.is_none())
        .map(|row| row.id)
        .collect();
    crate::credit_registration_events::insert_many(
        conn,
        &affected,
        event_kind,
        Some(actor_user_id),
        Some(message),
    )
    .await?;
    let waiting_before = count_waiting_for_student_number(conn, subject_user_id).await?;
    recompute_preconditions(
        conn,
        &RegistrationScope {
            user_id: Some(subject_user_id),
            ..RegistrationScope::default()
        },
        PRECONDITIONS_LIMIT,
    )
    .await?;
    let waiting_after = count_waiting_for_student_number(conn, subject_user_id).await?;
    Ok((waiting_before - waiting_after).abs())
}

/// Live registrations of one account waiting for a student number, whatever course they are on.
async fn count_waiting_for_student_number(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<i64> {
    crate::credit_registrations::count_admin_facing(
        conn,
        &AdminCreditRegistrationFilters {
            user_id: Some(user_id),
            states: Some(&[CreditRegistrationState::PendingStudentNumber]),
            ..AdminCreditRegistrationFilters::default()
        },
    )
    .await
}
