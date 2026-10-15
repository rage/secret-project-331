use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug, ToSchema)]
pub struct ChatbotConversationMessageReasoning {
    pub id: Uuid,
    pub chatbot_conversation_message_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub summary: Option<String>,
    pub reasoning_id: String,
    pub response_id: String,
    /// Never serialized: this reaches the browser as part of an untagged [`Message`], and the
    /// payload is the model's own reasoning.
    ///
    /// [`Message`]: crate::chatbot_conversation_messages::Message
    #[serde(skip)]
    pub encrypted_content: Option<String>,
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
            reasoning_id: Default::default(),
            response_id: Default::default(),
            encrypted_content: None,
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
    response_id,
    reasoning_id,
    encrypted_content
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
        "#,
        msg_id,
        input.summary,
        input.response_id,
        input.reasoning_id,
        input.encrypted_content,
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
  AND deleted_at IS NULL
RETURNING *
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

#[cfg(test)]
mod tests {
    use crate::chatbot_conversation_messages::{ChatbotConversationMessage, Message};

    use super::*;

    /// A conversation's messages are served to the browser as they are stored, so nothing but the
    /// `skip` keeps the model's own reasoning out of the response. Dropping the attribute is a
    /// one-line change that leaks every conversation's reasoning to whoever is reading it.
    #[test]
    fn a_reasoning_message_never_serializes_its_payload() {
        let message = ChatbotConversationMessage {
            message: Message::Reasoning(ChatbotConversationMessageReasoning {
                summary: Some("Thinking about loops".to_string()),
                encrypted_content: Some("the-opaque-payload".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        let json = serde_json::to_string(&message).expect("the message serializes");

        assert!(json.contains("Thinking about loops"), "{json}");
        assert!(!json.contains("encrypted_content"), "{json}");
        assert!(!json.contains("the-opaque-payload"), "{json}");
    }
}
