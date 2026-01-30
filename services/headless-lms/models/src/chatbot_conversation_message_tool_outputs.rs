use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationMessageToolOutput {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub message_id: Uuid,
    pub tool_name: String,
    pub tool_output: String,
    pub tool_call_id: String,
}

impl Default for ChatbotConversationMessageToolOutput {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            message_id: Uuid::nil(),
            tool_name: Default::default(),
            tool_output: Default::default(),
            tool_call_id: Default::default(),
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
    message_id,
    tool_name,
    tool_output,
    tool_call_id
  )
VALUES ($1, $2, $3, $4)
RETURNING *
        "#,
        msg_id,
        input.tool_name,
        input.tool_output,
        input.tool_call_id,
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
SELECT *
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
RETURNING *
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
