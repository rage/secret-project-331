//! The two terminal-state mails a student may get about a credit registration.
//!
//! There are exactly two, and each is sent at most once per ledger row. Idempotency lives in the
//! `credit_registrations.{action_needed,registered}_email_delivery_id` columns rather than in the
//! phase, so a re-tick, a restart or a row re-entering the state cannot mail twice. A
//! grade-improvement attempt is a new row and does get its own mail.

use std::collections::HashMap;

use utoipa::ToSchema;

use crate::credit_registrations::{CreditRegistrationState, RegistrationScope};
use crate::email_deliveries::{EmailSendStatusReport, get_send_statuses};
use crate::email_templates::EmailTemplateType;
use crate::prelude::*;

/// How many mails one iteration queues.
pub const STUDENT_NOTIFICATION_LIMIT: i64 = 200;

/// Which of the two student mails a row is owed, or already holds.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationNotificationKind {
    /// The study registry had no usable enrolment, so the student has to act.
    ActionNeeded,
    /// The credit is in the study registry, whether we put it there or found it already recorded.
    Registered,
}

impl CreditRegistrationNotificationKind {
    pub fn email_template_type(self) -> EmailTemplateType {
        match self {
            Self::ActionNeeded => EmailTemplateType::CreditRegistrationActionNeeded,
            Self::Registered => EmailTemplateType::CreditRegistrationRegistered,
        }
    }
}

/// One row owed a mail, with everything the message renders. `open_university_product_id` is the
/// module's configured product, from which the action-needed mail's enrolment link is built.
#[derive(Debug, Clone, PartialEq)]
pub struct StudentNotificationToQueue {
    pub credit_registration_id: Uuid,
    pub kind: CreditRegistrationNotificationKind,
    pub user_id: Uuid,
    pub course_module_id: Uuid,
    pub course_name: String,
    pub course_language_code: String,
    pub course_module_name: Option<String>,
    pub first_name: Option<String>,
    pub ects_credits: Option<f32>,
    pub open_university_product_id: Option<String>,
}

/// Claims the rows owed a mail, locking them until the caller's transaction ends, so callers must
/// pass a transaction. Never claims `abandoned_by_consent_withdrawal`, `cancelled`, `blocked` or
/// any failure state: those get nothing.
pub async fn claim_unnotified(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<StudentNotificationToQueue>> {
    let res = sqlx::query!(
        r#"
SELECT cr.id AS "credit_registration_id!",
  cr.state AS "state!: CreditRegistrationState",
  cr.user_id AS "user_id!",
  cr.course_module_id AS "course_module_id!",
  c.name AS "course_name!",
  c.language_code AS "course_language_code!",
  cm.name AS "course_module_name?",
  ud.first_name AS "first_name?",
  cm.ects_credits AS "ects_credits?",
  conf.open_university_product_id AS "open_university_product_id?"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cr.course_module_id
  AND conf.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND (
    (
      cr.state = 'no_usable_enrolment'
      AND cr.action_needed_email_delivery_id IS NULL
    )
    OR (
      cr.state = ANY($5::credit_registration_state [])
      AND cr.registered_email_delivery_id IS NULL
    )
  )
  AND ($2::uuid IS NULL OR cr.course_id = $2)
  AND ($3::uuid IS NULL OR cr.user_id = $3)
  AND (
    cardinality($4::uuid []) = 0
    OR cr.id = ANY($4::uuid [])
  )
ORDER BY cr.state_entered_at
FOR UPDATE OF cr SKIP LOCKED
LIMIT $1
        "#,
        limit,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;

    Ok(res
        .into_iter()
        .map(|row| StudentNotificationToQueue {
            kind: match row.state {
                CreditRegistrationState::NoUsableEnrolment => {
                    CreditRegistrationNotificationKind::ActionNeeded
                }
                _ => CreditRegistrationNotificationKind::Registered,
            },
            credit_registration_id: row.credit_registration_id,
            user_id: row.user_id,
            course_module_id: row.course_module_id,
            course_name: row.course_name,
            course_language_code: row.course_language_code,
            course_module_name: row.course_module_name,
            first_name: row.first_name,
            ects_credits: row.ects_credits,
            open_university_product_id: row.open_university_product_id,
        })
        .collect())
}

/// Records which delivery carries the mail, which is also what takes the row out of the queue.
pub async fn set_email_delivery_id(
    conn: &mut PgConnection,
    credit_registration_id: Uuid,
    kind: CreditRegistrationNotificationKind,
    email_delivery_id: Uuid,
) -> ModelResult<()> {
    let action_needed = kind == CreditRegistrationNotificationKind::ActionNeeded;
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET action_needed_email_delivery_id = CASE
    WHEN $3 THEN $2
    ELSE action_needed_email_delivery_id
  END,
  registered_email_delivery_id = CASE
    WHEN $3 THEN registered_email_delivery_id
    ELSE $2
  END
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        credit_registration_id,
        email_delivery_id,
        action_needed,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// One queued student mail and what we can honestly say about it.
#[derive(Debug, Clone, PartialEq)]
pub struct RegistrationNotificationEmail {
    pub credit_registration_id: Uuid,
    pub kind: CreditRegistrationNotificationKind,
    /// The delivery the registration is pinned to. Stable for the life of the row: it is what stops a
    /// second mail of this kind, so a changed id here means the guard was bypassed.
    pub email_delivery_id: Uuid,
    pub send_status: EmailSendStatusReport,
}

/// The mails queued for these rows, for the student, teacher and admin views that report on them.
/// A row with neither mail queued yet contributes nothing.
pub async fn get_for_registrations(
    conn: &mut PgConnection,
    credit_registration_ids: &[Uuid],
) -> ModelResult<Vec<RegistrationNotificationEmail>> {
    let rows = sqlx::query!(
        r#"
SELECT id,
  action_needed_email_delivery_id,
  registered_email_delivery_id
FROM credit_registrations
WHERE id = ANY($1::uuid [])
  AND deleted_at IS NULL
  AND (
    action_needed_email_delivery_id IS NOT NULL
    OR registered_email_delivery_id IS NOT NULL
  )
        "#,
        credit_registration_ids
    )
    .fetch_all(&mut *conn)
    .await?;

    let delivery_ids: Vec<Uuid> = rows
        .iter()
        .flat_map(|row| {
            [
                row.action_needed_email_delivery_id,
                row.registered_email_delivery_id,
            ]
        })
        .flatten()
        .collect();
    let reports: HashMap<Uuid, EmailSendStatusReport> =
        get_send_statuses(conn, &delivery_ids).await?;

    let mut res = Vec::new();
    for row in rows {
        for (kind, delivery_id) in [
            (
                CreditRegistrationNotificationKind::ActionNeeded,
                row.action_needed_email_delivery_id,
            ),
            (
                CreditRegistrationNotificationKind::Registered,
                row.registered_email_delivery_id,
            ),
        ] {
            let Some((delivery_id, report)) =
                delivery_id.and_then(|id| reports.get(&id).map(|report| (id, report)))
            else {
                continue;
            };
            res.push(RegistrationNotificationEmail {
                credit_registration_id: row.id,
                kind,
                email_delivery_id: delivery_id,
                send_status: report.clone(),
            });
        }
    }
    Ok(res)
}
