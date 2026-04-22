use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationMessageReasoning {
    pub id: Uuid,
    pub chatbot_conversation_message_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub summary: Option<String>,
    pub response_id: String,
}

impl Default for ChatbotConversationMessageReasoning {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            chatbot_conversation_message_id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            summary: None,
            response_id: Default::default(),
        }
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessageReasoning,
    msg_id: Uuid,
) -> ModelResult<ChatbotConversationMessageReasoning> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageReasoning,
        r#"
INSERT INTO chatbot_conversation_message_reasoning (
    chatbot_conversation_message_id,
    summary,
    response_id
  )
VALUES ($1, $2, $3)
RETURNING *
        "#,
        msg_id,
        input.summary,
        input.response_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ChatbotConversationMessageReasoning> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageReasoning,
        r#"
SELECT *
FROM chatbot_conversation_message_reasoning
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_message_id(
    conn: &mut PgConnection,
    message_id: Uuid,
) -> ModelResult<Option<ChatbotConversationMessageReasoning>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageReasoning,
        r#"
SELECT *
FROM chatbot_conversation_message_reasoning
WHERE chatbot_conversation_message_id = $1
  AND deleted_at IS NULL
        "#,
        message_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn delete(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ChatbotConversationMessageReasoning> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageReasoning,
        r#"
UPDATE chatbot_conversation_message_reasoning
SET deleted_at = NOW()
WHERE id = $1
RETURNING *
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
