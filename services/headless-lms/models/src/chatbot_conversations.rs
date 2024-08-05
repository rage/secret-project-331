use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversation {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub user_id: Uuid,
    pub chatbot_configuration_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversation,
) -> ModelResult<ChatbotConversation> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
INSERT INTO chatbot_conversations (course_id, user_id, chatbot_configuration_id)
VALUES ($1, $2, $3)
RETURNING *
        "#,
        input.course_id,
        input.user_id,
        input.chatbot_configuration_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
