use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct TeacherNewsletterItems {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub returned_exercises_count: i64,
    pub completed_course_count: i64,
    pub started_course_count: i64,
    pub flagged_cheaters_count_period: i64,
    pub flagged_cheaters_count_total: i64,
    pub unread_feedback_count_period: i64,
    pub unread_feedback_count_total: i64,
    pub proposal_count_period: i64,
    pub proposal_count_total: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct TeacherNewsletterSubscriptions {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub subscribed: bool,
}

pub async fn get_teacher_newsletter_subscriptions(
    conn: &mut PgConnection,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        "
SELECT tns.user_id
FROM teacher_newsletter_subscriptions AS tns
  JOIN users AS u ON u.id = tns.user_id
WHERE tns.subscribed = 't'
  AND tns.deleted_at IS NULL
  AND u.deleted_at IS NULL
        ",
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn create_newsletter_item(
    conn: &mut PgConnection,
    course_id: Uuid,
    period_start: &str,
    period_end: &str,
    returned_exercises_count: i64,
    completed_course_count: i64,
    started_course_count: i64,
    flagged_cheaters_count_period: i64,
    flagged_cheaters_count_total: i64,
    unread_feedback_count_period: i64,
    unread_feedback_count_total: i64,
    proposal_count_period: i64,
    proposal_count_total: i64,
) -> ModelResult<()> {
    let from = DateTime::parse_from_rfc3339(&(period_start.to_owned() + "T00:00:00Z"))
        .map_err(|e| model_err!(InvalidRequest, format!("Invalid start date: {}", e)))?
        .with_timezone(&Utc);

    let to = DateTime::parse_from_rfc3339(&(period_end.to_owned() + "T23:59:59Z"))
        .map_err(|e| model_err!(InvalidRequest, format!("Invalid end date: {}", e)))?
        .with_timezone(&Utc);

    sqlx::query!(
        "
INSERT INTO teacher_newsletter_items (
    course_id,
    period_start,
    period_end,
    returned_exercises_count,
    completed_course_count,
    started_course_count,
    flagged_cheaters_count_period,
    flagged_cheaters_count_total,
    unread_feedback_count_period,
    unread_feedback_count_total,
    proposal_count_period,
    proposal_count_total
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12
  )",
        course_id,
        from,
        to,
        returned_exercises_count,
        completed_course_count,
        started_course_count,
        flagged_cheaters_count_period,
        flagged_cheaters_count_total,
        unread_feedback_count_period,
        unread_feedback_count_total,
        proposal_count_period,
        proposal_count_total
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_newsletter_items(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
    period_start: &str,
    period_end: &str,
) -> ModelResult<Vec<TeacherNewsletterItems>> {
    let start_dt = DateTime::parse_from_rfc3339(&(period_start.to_owned() + "T00:00:00Z"))
        .map_err(|e| model_err!(InvalidRequest, format!("Invalid start date: {}", e)))?
        .with_timezone(&Utc);

    let end_dt = DateTime::parse_from_rfc3339(&(period_end.to_owned() + "T23:59:59Z"))
        .map_err(|e| model_err!(InvalidRequest, format!("Invalid end date: {}", e)))?
        .with_timezone(&Utc);

    let res = sqlx::query_as!(
        TeacherNewsletterItems,
        "
SELECT *
FROM teacher_newsletter_items
WHERE course_id = ANY($1)
  AND period_start >= $2
  AND period_end <= $3
  AND deleted_at IS NULL
        ",
        course_ids,
        start_dt,
        end_dt,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
