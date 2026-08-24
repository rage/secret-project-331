use crate::prelude::*;
use sqlx::PgConnection;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct ExerciseResetLog {
    pub id: Uuid,
    pub reset_by: Option<Uuid>,
    pub reset_by_first_name: Option<String>,
    pub reset_by_last_name: Option<String>,
    pub reset_for: Uuid,
    pub exercise_id: Uuid,
    pub exercise_name: String,
    pub reason: Option<String>,
    pub course_id: Uuid,
    pub reset_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Adds a log entry for reset exercises for a user
///
/// `reason` is a message key the course material translates; `teacher_feedback` is free text the
/// teacher wrote for the student and outlives the grading decision the reset soft-deletes.
pub async fn log_exercise_reset(
    tx: &mut PgConnection,
    reset_by: Option<Uuid>,
    user_id: Uuid,
    exercise_ids: &[Uuid],
    course_id: Uuid,
    reason: Option<String>,
    teacher_feedback: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
INSERT INTO exercise_reset_logs (
    reset_by,
    reset_for,
    exercise_id,
    course_id,
    reason,
    teacher_feedback,
    reset_at
  )
SELECT $1,
  $2,
  unnest($3::uuid []),
  $4,
  $5,
  $6,
  NOW()
      "#,
        reset_by,
        user_id,
        &exercise_ids,
        course_id,
        reason,
        teacher_feedback
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

pub async fn get_exercise_reset_logs_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<ExerciseResetLog>> {
    let result = sqlx::query_as!(
        ExerciseResetLog,
        r#"
SELECT erl.id,
  erl.reset_by,
  ud.first_name AS reset_by_first_name,
  ud.last_name AS reset_by_last_name,
  erl.reset_for,
  erl.exercise_id,
  e.name AS exercise_name,
  erl.reason,
  erl.course_id,
  erl.reset_at,
  erl.created_at,
  erl.updated_at,
  erl.deleted_at
FROM exercise_reset_logs erl
  JOIN exercises e ON erl.exercise_id = e.id
  LEFT JOIN user_details ud ON erl.reset_by = ud.user_id
WHERE erl.reset_for = $1
ORDER BY erl.reset_at DESC"#,
        user_id
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(result)
}

/// What the course material tells a student whose exercise was reset.
#[derive(Debug, Clone, PartialEq)]
pub struct ExerciseResetNotice {
    /// Message key the course material maps to a translation.
    pub reason: String,
    /// Free text the teacher wrote for the student while resetting.
    pub teacher_feedback: Option<String>,
}

/// The notice for the user's latest reset, or None once they have submitted again since it.
pub async fn get_reset_notice_for_exercise(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
) -> ModelResult<Option<ExerciseResetNotice>> {
    let row = sqlx::query!(
        r#"
SELECT erl.reset_by, erl.reason, erl.teacher_feedback
FROM exercise_reset_logs erl
LEFT JOIN exercise_slide_submissions es
  ON es.user_id = erl.reset_for
  AND es.exercise_id = erl.exercise_id
  AND es.created_at > erl.reset_at
WHERE erl.reset_for = $1
  AND erl.exercise_id = $2
  AND es.id IS NULL
ORDER BY erl.reset_at DESC
LIMIT 1
"#,
        user_id,
        exercise_id
    )
    .fetch_optional(conn)
    .await?;

    let notice = row.and_then(|r| {
        let reason = match (r.reason, r.reset_by) {
            (Some(reason), _) => reason,
            (None, Some(_)) => "reset-by-staff".to_string(),
            (None, None) => return None,
        };
        Some(ExerciseResetNotice {
            reason,
            teacher_feedback: r.teacher_feedback,
        })
    });

    Ok(notice)
}
