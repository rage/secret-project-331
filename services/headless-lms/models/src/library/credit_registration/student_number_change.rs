//! What changing an account's linked student number does to its registrations: both the student's
//! own unlink/claim and an admin's unlink/manual-link go through this, so the audit trail and the
//! recompute stay in one place regardless of who acted.

use crate::credit_registration_events::CreditRegistrationEventKind;
use crate::credit_registrations::RegistrationScope;
use crate::prelude::*;

use super::preconditions::{PRECONDITIONS_LIMIT, recompute_preconditions};

/// Audits a change to `subject_user_id`'s linked student number on every registration it can affect,
/// then applies it. Returns how many of the account's registrations the recompute moved.
///
/// `actor_user_id` is `None` when a worker made the change and no person decided it.
pub async fn record_student_number_change(
    conn: &mut PgConnection,
    subject_user_id: Uuid,
    actor_user_id: Option<Uuid>,
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
        actor_user_id,
        Some(message),
    )
    .await?;
    recompute_preconditions(
        conn,
        &RegistrationScope {
            user_id: Some(subject_user_id),
            ..RegistrationScope::default()
        },
        PRECONDITIONS_LIMIT,
    )
    .await
}
