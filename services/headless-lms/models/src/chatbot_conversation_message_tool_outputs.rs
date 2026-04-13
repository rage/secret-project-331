use crate::{chatbot_conversation_message_tool_calls::ToolKind, prelude::*};

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationMessageToolOutput {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chatbot_conversation_message_id: Uuid,
    pub output: String,
    pub tool_call_id: String,
    pub tool_kind: ToolKind,
}

impl Default for ChatbotConversationMessageToolOutput {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            chatbot_conversation_message_id: Uuid::nil(),
            output: Default::default(),
            tool_call_id: Default::default(),
            tool_kind: ToolKind::Function,
        }
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessageToolOutput,
    msg_id: Uuid,
) -> ModelResult<ChatbotConversationMessageToolOutput> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolOutput,
        r#"
INSERT INTO chatbot_conversation_message_tool_outputs (
    chatbot_conversation_message_id,
    output,
    tool_call_id,
    tool_kind
  )
VALUES ($1, $2, $3, $4)
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    output,
    tool_call_id,
    tool_kind as "tool_kind: ToolKind"
        "#,
        msg_id,
        input.output,
        input.tool_call_id,
        input.tool_kind as ToolKind,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ChatbotConversationMessageToolOutput> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolOutput,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    output,
    tool_call_id,
    tool_kind as "tool_kind: ToolKind"
FROM chatbot_conversation_message_tool_outputs
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
) -> ModelResult<Option<ChatbotConversationMessageToolOutput>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolOutput,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    output,
    tool_call_id,
    tool_kind as "tool_kind: ToolKind"
FROM chatbot_conversation_message_tool_outputs
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
) -> ModelResult<ChatbotConversationMessageToolOutput> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolOutput,
        r#"
UPDATE chatbot_conversation_message_tool_outputs
SET deleted_at = NOW()
WHERE id = $1
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    output,
    tool_call_id,
    tool_kind as "tool_kind: ToolKind"
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
