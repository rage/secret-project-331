use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "message_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    Assistant,
    User,
    Tool,
    System,
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationMessage {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub conversation_id: Uuid,
    pub message: Option<String>,
    pub message_role: MessageRole,
    pub message_is_complete: bool,
    pub used_tokens: i32,
    pub order_number: i32,
    pub tool_output_id: Option<Uuid>,
    pub tool_call_fields_id: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessage,
) -> ModelResult<ChatbotConversationMessage> {
    let res = sqlx::query_as!(
        ChatbotConversationMessage,
        r#"
INSERT INTO chatbot_conversation_messages (
    conversation_id,
    message,
    message_role,
    message_is_complete,
    used_tokens,
    order_number,
    tool_output_id,
    tool_call_fields_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    conversation_id,
    message,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens,
    order_number,
    tool_output_id,
    tool_call_fields_id
        "#,
        input.conversation_id,
        input.message,
        input.message_role as MessageRole,
        input.message_is_complete,
        input.used_tokens,
        input.order_number,
        input.tool_output_id,
        input.tool_call_fields_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_conversation_id(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessage>> {
    let mut res = sqlx::query_as!(
        ChatbotConversationMessage,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    conversation_id,
    message,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens,
    order_number,
    tool_output_id,
    tool_call_fields_id
FROM chatbot_conversation_messages
WHERE conversation_id = $1
        "#,
        conversation_id
    )
    .fetch_all(conn)
    .await?;
    // Should have the same order as in the conversation.
    res.sort_by(|a, b| a.order_number.cmp(&b.order_number));
    Ok(res)
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    message: &str,
    message_is_complete: bool,
    used_tokens: i32,
) -> ModelResult<ChatbotConversationMessage> {
    let res = sqlx::query_as!(
        ChatbotConversationMessage,
        r#"
UPDATE chatbot_conversation_messages
SET message = $2, message_is_complete = $3, used_tokens = $4
WHERE id = $1
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    conversation_id,
    message,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens,
    order_number,
    tool_output_id,
    tool_call_fields_id
        "#,
        id,
        message,
        message_is_complete,
        used_tokens
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<ChatbotConversationMessage> {
    let res = sqlx::query_as!(
        ChatbotConversationMessage,
        r#"
UPDATE chatbot_conversation_messages
SET deleted_at = NOW()
WHERE id = $1
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    conversation_id,
    message,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens,
    order_number,
    tool_output_id,
    tool_call_fields_id
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
