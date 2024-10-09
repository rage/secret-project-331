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
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub response_max_tokens: i32,
    pub use_azure_search: bool,
    pub maintain_azure_search_index: bool,
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
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *
        "#,
        input.course_id,
        input.enabled_to_students,
        input.chatbot_name,
        input.prompt,
        input.initial_message,
        input.weekly_tokens_per_user,
        input.daily_tokens_per_user,
        input.temperature,
        input.top_p,
        input.frequency_penalty,
        input.presence_penalty,
        input.response_max_tokens
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<ChatbotConfiguration>> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        "
SELECT * FROM
chatbot_configurations
WHERE course_id = $1
AND deleted_at IS NULL
",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_for_azure_search_maintenance(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ChatbotConfiguration>> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        "
SELECT * FROM
chatbot_configurations
WHERE maintain_azure_search_index = true
AND deleted_at IS NULL
",
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
