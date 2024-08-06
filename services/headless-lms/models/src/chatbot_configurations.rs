use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct ChatbotConfiguration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub enabled_to_students: bool,
    pub chatbot_name: String,
    pub prompt: String,
    pub initial_message: String,
    pub weekly_tokens_per_user: i32,
    pub daily_tokens_per_user: i32,
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ChatbotConfiguration> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
SELECT * FROM chatbot_configurations
WHERE id = $1
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConfiguration,
) -> ModelResult<ChatbotConfiguration> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
INSERT INTO chatbot_configurations (
    course_id,
    enabled_to_students,
    chatbot_name,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
        "#,
        input.course_id,
        input.enabled_to_students,
        input.chatbot_name,
        input.prompt,
        input.initial_message,
        input.weekly_tokens_per_user,
        input.daily_tokens_per_user
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
