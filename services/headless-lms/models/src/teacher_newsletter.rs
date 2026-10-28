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
    pub as_html: String,
    pub as_text: String,
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
SELECT user_id
FROM teacher_newsletter_subscriptions
WHERE subscribed = 't';
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
    html: String,
    text: String,
) -> ModelResult<()> {
    let from = DateTime::parse_from_rfc3339(&(period_start.to_owned() + "T00:00:00Z"))
        .map_err(|e| {
            ModelError::new(
                ModelErrorType::InvalidRequest,
                format!("Invalid start_date: {}", e),
                None,
            )
        })?
        .with_timezone(&Utc);

    let to = DateTime::parse_from_rfc3339(&(period_end.to_owned() + "T23:59:59Z"))
        .map_err(|e| {
            ModelError::new(
                ModelErrorType::InvalidRequest,
                format!("Invalid end_date: {}", e),
                None,
            )
        })?
        .with_timezone(&Utc);

    sqlx::query!(
        "
INSERT INTO teacher_newsletter_items (course_id, period_start, period_end, as_html, as_text)
VALUES ($1, $2, $3, $4, $5)
        ",
        course_id,
        from,
        to,
        html,
        text
    )
    .execute(conn)
    .await?;
    Ok(())
}
