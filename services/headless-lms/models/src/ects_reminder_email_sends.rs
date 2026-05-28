use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EctsReminderEmailSend {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub email_type: String,
    pub email_delivery_id: Option<Uuid>,
}

/// Data needed by the periodic task runner to send one ECTS reminder email.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PendingEctsReminder {
    pub completion_id: Uuid,
    pub user_id: Uuid,
    pub email: String,
    pub completion_language: String,
    pub course_module_id: Uuid,
    pub course_id: Uuid,
    /// The user's per-course-module-id for the registration URL path.
    pub ects_unsubscribe_token: Uuid,
}

/// Stats for the ECTS reminder marketing dashboard.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct EctsReminderStats {
    pub eligible_completions: i64,
    pub finland_eligible_completions: i64,
    pub initial_emails_sent: i64,
    pub follow_up_emails_sent: i64,
    pub registered_after_email: i64,
    pub opted_out: i64,
}

/// Stats for one course row in the per-course breakdown table.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct EctsReminderCourseStats {
    pub course_id: Uuid,
    pub course_name: String,
    pub eligible_completions: i64,
    pub finland_eligible_completions: i64,
    pub initial_emails_sent: i64,
    pub follow_up_emails_sent: i64,
    pub registered_after_email: i64,
}

/// Returns completions that need an initial ECTS reminder email:
/// - eligible_for_ects & passed
/// - user country is 'FI'
/// - user has not opted out
/// - completion is more than 24 hours old
/// - no initial reminder has been sent yet
pub async fn get_pending_initial_reminders(
    conn: &mut PgConnection,
) -> ModelResult<Vec<PendingEctsReminder>> {
    let res = sqlx::query_as!(
        PendingEctsReminder,
        r#"
SELECT
  cmc.id AS completion_id,
  cmc.user_id,
  ud.email,
  cmc.completion_language,
  cmc.course_module_id,
  cmc.course_id,
  ud.ects_unsubscribe_token
FROM course_module_completions cmc
JOIN user_details ud ON ud.user_id = cmc.user_id
LEFT JOIN ects_reminder_email_sends ers
  ON ers.course_module_completion_id = cmc.id
  AND ers.email_type = 'initial'
  AND ers.deleted_at IS NULL
WHERE cmc.eligible_for_ects = true
  AND cmc.passed = true
  AND cmc.deleted_at IS NULL
  AND ud.country = 'FI'
  AND ud.ects_email_opt_out = false
  AND cmc.completion_date < NOW() - INTERVAL '24 hours'
  AND ers.id IS NULL
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Returns completions that need a follow-up ECTS reminder email:
/// - had an initial reminder sent >= 14 days ago
/// - not yet registered with a study registry
/// - user has not opted out
/// - no follow-up reminder has been sent yet
pub async fn get_pending_follow_up_reminders(
    conn: &mut PgConnection,
) -> ModelResult<Vec<PendingEctsReminder>> {
    let res = sqlx::query_as!(
        PendingEctsReminder,
        r#"
SELECT
  cmc.id AS completion_id,
  cmc.user_id,
  ud.email,
  cmc.completion_language,
  cmc.course_module_id,
  cmc.course_id,
  ud.ects_unsubscribe_token
FROM course_module_completions cmc
JOIN user_details ud ON ud.user_id = cmc.user_id
JOIN ects_reminder_email_sends initial_send
  ON initial_send.course_module_completion_id = cmc.id
  AND initial_send.email_type = 'initial'
  AND initial_send.deleted_at IS NULL
LEFT JOIN ects_reminder_email_sends follow_up_send
  ON follow_up_send.course_module_completion_id = cmc.id
  AND follow_up_send.email_type = 'follow_up'
  AND follow_up_send.deleted_at IS NULL
LEFT JOIN course_module_completion_registered_to_study_registries reg
  ON reg.course_module_completion_id = cmc.id
  AND reg.deleted_at IS NULL
WHERE cmc.eligible_for_ects = true
  AND cmc.passed = true
  AND cmc.deleted_at IS NULL
  AND ud.country = 'FI'
  AND ud.ects_email_opt_out = false
  AND initial_send.created_at < NOW() - INTERVAL '14 days'
  AND follow_up_send.id IS NULL
  AND reg.id IS NULL
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn insert_ects_reminder_send(
    conn: &mut PgConnection,
    completion_id: Uuid,
    user_id: Uuid,
    email_type: &str,
    email_delivery_id: Uuid,
) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO ects_reminder_email_sends (
  user_id,
  course_module_completion_id,
  email_type,
  email_delivery_id
)
VALUES ($1, $2, $3, $4)
RETURNING id
        "#,
        user_id,
        completion_id,
        email_type,
        email_delivery_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// Look up the completion info linked to a given email delivery — used by the
/// email processor to fill in ECTS reminder placeholders.
pub async fn get_completion_id_by_email_delivery_id(
    conn: &mut PgConnection,
    email_delivery_id: Uuid,
) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
SELECT course_module_completion_id
FROM ects_reminder_email_sends
WHERE email_delivery_id = $1
  AND deleted_at IS NULL
        "#,
        email_delivery_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

pub async fn get_global_stats(conn: &mut PgConnection) -> ModelResult<EctsReminderStats> {
    let res = sqlx::query!(
        r#"
SELECT
  (
    SELECT COUNT(*)
    FROM course_module_completions
    WHERE eligible_for_ects = true AND passed = true AND deleted_at IS NULL
  ) AS "eligible_completions!",
  (
    SELECT COUNT(*)
    FROM course_module_completions cmc
    JOIN user_details ud ON ud.user_id = cmc.user_id
    WHERE cmc.eligible_for_ects = true AND cmc.passed = true AND cmc.deleted_at IS NULL
      AND ud.country = 'FI'
  ) AS "finland_eligible_completions!",
  (
    SELECT COUNT(*) FROM ects_reminder_email_sends
    WHERE email_type = 'initial' AND deleted_at IS NULL
  ) AS "initial_emails_sent!",
  (
    SELECT COUNT(*) FROM ects_reminder_email_sends
    WHERE email_type = 'follow_up' AND deleted_at IS NULL
  ) AS "follow_up_emails_sent!",
  (
    SELECT COUNT(DISTINCT ers.course_module_completion_id)
    FROM ects_reminder_email_sends ers
    JOIN course_module_completion_registered_to_study_registries reg
      ON reg.course_module_completion_id = ers.course_module_completion_id
      AND reg.deleted_at IS NULL
    WHERE ers.deleted_at IS NULL
  ) AS "registered_after_email!",
  (
    SELECT COUNT(*) FROM user_details WHERE ects_email_opt_out = true
  ) AS "opted_out!"
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(EctsReminderStats {
        eligible_completions: res.eligible_completions,
        finland_eligible_completions: res.finland_eligible_completions,
        initial_emails_sent: res.initial_emails_sent,
        follow_up_emails_sent: res.follow_up_emails_sent,
        registered_after_email: res.registered_after_email,
        opted_out: res.opted_out,
    })
}

pub async fn get_per_course_stats(
    conn: &mut PgConnection,
) -> ModelResult<Vec<EctsReminderCourseStats>> {
    let res = sqlx::query_as!(
        EctsReminderCourseStats,
        r#"
SELECT
  c.id AS course_id,
  c.name AS course_name,
  COUNT(DISTINCT cmc.id) FILTER (
    WHERE cmc.eligible_for_ects = true AND cmc.passed = true
  ) AS "eligible_completions!",
  COUNT(DISTINCT cmc.id) FILTER (
    WHERE cmc.eligible_for_ects = true AND cmc.passed = true AND ud.country = 'FI'
  ) AS "finland_eligible_completions!",
  COUNT(DISTINCT ers_i.id) AS "initial_emails_sent!",
  COUNT(DISTINCT ers_f.id) AS "follow_up_emails_sent!",
  COUNT(DISTINCT reg.course_module_completion_id) AS "registered_after_email!"
FROM courses c
LEFT JOIN course_module_completions cmc ON cmc.course_id = c.id AND cmc.deleted_at IS NULL
LEFT JOIN user_details ud ON ud.user_id = cmc.user_id
LEFT JOIN ects_reminder_email_sends ers_i
  ON ers_i.course_module_completion_id = cmc.id
  AND ers_i.email_type = 'initial'
  AND ers_i.deleted_at IS NULL
LEFT JOIN ects_reminder_email_sends ers_f
  ON ers_f.course_module_completion_id = cmc.id
  AND ers_f.email_type = 'follow_up'
  AND ers_f.deleted_at IS NULL
LEFT JOIN course_module_completion_registered_to_study_registries reg
  ON reg.course_module_completion_id = cmc.id
  AND reg.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ects_reminder_email_sends e2
    WHERE e2.course_module_completion_id = cmc.id AND e2.deleted_at IS NULL
  )
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name
HAVING COUNT(DISTINCT ers_i.id) > 0 OR COUNT(DISTINCT ers_f.id) > 0
ORDER BY "initial_emails_sent!" DESC
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
