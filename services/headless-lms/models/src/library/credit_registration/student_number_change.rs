//! What changing an account's linked student number does to its registrations: both the student's
//! own unlink/claim and an admin's unlink/manual-link go through this, so the audit trail and the
//! recompute stay in one place regardless of who acted.

use crate::credit_registration_events::CreditRegistrationEventKind;
use crate::credit_registrations::RegistrationScope;
use crate::prelude::*;
use crate::verified_student_numbers;

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

/// Retires a verified link and reopens every registration it had gated, as one step. Both the
/// student's own unlink and the admin unlink call this rather than each doing the soft-delete and
/// the recompute themselves; callers keep owning the transaction and any admin-action row around it.
pub async fn unlink_verified_student_number(
    conn: &mut PgConnection,
    verified_student_number_id: Uuid,
    subject_user_id: Uuid,
    actor_user_id: Option<Uuid>,
    event_kind: CreditRegistrationEventKind,
    message: &str,
) -> ModelResult<i64> {
    verified_student_numbers::soft_delete(conn, verified_student_number_id).await?;
    record_student_number_change(conn, subject_user_id, actor_user_id, event_kind, message).await
}
