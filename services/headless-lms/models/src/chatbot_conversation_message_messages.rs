use crate::prelude::*;
use std::fmt;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "message_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    Assistant,
    User,
    Developer,
    System,
}

impl fmt::Display for MessageRole {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationMessageMessage {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chatbot_conversation_message_id: Uuid,
    pub text: String,
    pub message_role: MessageRole,
    pub message_is_complete: bool,
    pub used_tokens: i32,
}

impl Default for ChatbotConversationMessageMessage {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            chatbot_conversation_message_id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            text: Default::default(),
            message_role: MessageRole::System,
            message_is_complete: false,
            used_tokens: Default::default(),
        }
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessageMessage,
    message_id: Uuid,
) -> ModelResult<ChatbotConversationMessageMessage> {
    if input.message_role == MessageRole::System {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Cannot save chatbot conversation message with role system to the database.",
            None,
        ));
    }
    let res = sqlx::query_as!(
        ChatbotConversationMessageMessage,
        r#"
INSERT INTO chatbot_conversation_message_messages (
    chatbot_conversation_message_id,
    text,
    message_role,
    message_is_complete,
    used_tokens
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    text,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens
        "#,
        message_id,
        input.text,
        input.message_role as MessageRole,
        input.message_is_complete,
        input.used_tokens,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update(
    conn: &mut PgConnection,
    conversation_message_id: Uuid,
    text: &str,
    message_is_complete: bool,
    used_tokens: i32,
) -> ModelResult<ChatbotConversationMessageMessage> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageMessage,
        r#"
UPDATE chatbot_conversation_message_messages
SET text = $2, message_is_complete = $3, used_tokens = $4
WHERE chatbot_conversation_message_id = $1
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    text,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens
        "#,
        conversation_message_id,
        text.to_string(),
        message_is_complete,
        used_tokens
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ChatbotConversationMessageMessage> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageMessage,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    text,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens
FROM chatbot_conversation_message_messages
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
) -> ModelResult<Option<ChatbotConversationMessageMessage>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageMessage,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    text,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens
FROM chatbot_conversation_message_messages
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
) -> ModelResult<ChatbotConversationMessageMessage> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageMessage,
        r#"
UPDATE chatbot_conversation_message_messages
SET deleted_at = NOW()
WHERE id = $1
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    text,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
