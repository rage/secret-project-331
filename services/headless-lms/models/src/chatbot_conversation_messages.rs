use crate::{
    chatbot_conversation_message_tool_calls::{self, ToolCallFields},
    chatbot_conversation_message_tool_outputs::{self, ToolOutput},
    prelude::*,
};

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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ChatbotConversationMessageRow {
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
}

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug)]
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
    pub tool_output: Option<ToolOutput>,
    pub tool_call_fields: Vec<ToolCallFields>,
}

impl Default for ChatbotConversationMessage {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            conversation_id: Uuid::nil(),
            message: Default::default(),
            message_role: MessageRole::System,
            message_is_complete: false,
            used_tokens: Default::default(),
            order_number: Default::default(),
            tool_output: None,
            tool_call_fields: Default::default(),
        }
    }
}

impl ChatbotConversationMessage {
    pub fn from_row(
        r: ChatbotConversationMessageRow,
        o: Option<ToolOutput>,
        c: Vec<ToolCallFields>,
    ) -> Self {
        ChatbotConversationMessage {
            id: r.id,
            created_at: r.created_at,
            updated_at: r.updated_at,
            deleted_at: r.deleted_at,
            conversation_id: r.conversation_id,
            message: r.message,
            message_role: r.message_role,
            message_is_complete: r.message_is_complete,
            used_tokens: r.used_tokens,
            order_number: r.order_number,
            tool_output: o,
            tool_call_fields: c,
        }
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessage,
) -> ModelResult<ChatbotConversationMessage> {
    let mut tx = conn.begin().await?;
    let msg = sqlx::query_as!(
        ChatbotConversationMessageRow,
        r#"
INSERT INTO chatbot_conversation_messages (
    conversation_id,
    message,
    message_role,
    message_is_complete,
    used_tokens,
    order_number,
    tool_output_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
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
    tool_output_id
        "#,
        input.conversation_id,
        input.message,
        input.message_role as MessageRole,
        input.message_is_complete,
        input.used_tokens,
        input.order_number,
        None::<Uuid>,
    )
    .fetch_one(&mut *tx)
    .await?;

    let (tool_output_id, tool_output) = match msg.message_role {
        MessageRole::Assistant => {
            if msg.message.is_some() {
                (None, None)
            } else if !input.tool_call_fields.is_empty() {
                for fields in &input.tool_call_fields {
                    chatbot_conversation_message_tool_calls::insert(
                        &mut tx,
                        fields.clone(),
                        msg.id,
                    )
                    .await?;
                }
                (None, None)
            } else {
                return ModelResult::Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "A chatbot conversation message with role 'assistant' has to have either a message or tool calls",
                    None,
                ));
            }
        }
        MessageRole::Tool => {
            if let Some(output) = input.tool_output {
                let o_res =
                    chatbot_conversation_message_tool_outputs::insert(&mut tx, output, msg.id)
                        .await?;
                (Some(o_res.id), Some(o_res))
            } else {
                return ModelResult::Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "A chatbot conversation message with role 'tool' must have tool output",
                    None,
                ));
            }
        }
        MessageRole::User => (None, None),
        MessageRole::System => {
            return ModelResult::Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                "Can't save system message to database",
                None,
            ));
        }
    };

    // Update the message to contain the tool_output_id if it was created
    if tool_output_id.is_some() {
        sqlx::query_as!(
            ChatbotConversationMessageRow,
            r#"
        UPDATE chatbot_conversation_messages
        SET tool_output_id = $1
        WHERE id = $2
        "#,
            tool_output_id,
            msg.id,
        )
        .execute(&mut *tx)
        .await?;
    }

    let res = ChatbotConversationMessage::from_row(msg, tool_output, input.tool_call_fields);

    tx.commit().await?;

    Ok(res)
}

pub async fn get_by_conversation_id(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessage>> {
    let mut tx = conn.begin().await?;
    let mut msgs: Vec<ChatbotConversationMessageRow> = sqlx::query_as!(
        ChatbotConversationMessageRow,
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
    tool_output_id
FROM chatbot_conversation_messages
WHERE conversation_id = $1
AND deleted_at IS NULL
        "#,
        conversation_id
    )
    .fetch_all(&mut *tx)
    .await?;
    // Should have the same order as in the conversation.
    msgs.sort_by(|a, b| a.order_number.cmp(&b.order_number));
    let mut res = vec![];
    for m in msgs {
        let msg = message_row_to_message(&mut tx, m).await?;
        res.push(msg);
    }
    tx.commit().await?;
    Ok(res)
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    message: &str,
    message_is_complete: bool,
    used_tokens: i32,
) -> ModelResult<ChatbotConversationMessage> {
    let mut tx = conn.begin().await?;
    let row = sqlx::query_as!(
        ChatbotConversationMessageRow,
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
    tool_output_id
        "#,
        id,
        Some(message),
        message_is_complete,
        used_tokens
    )
    .fetch_one(&mut *tx)
    .await?;

    let res = message_row_to_message(&mut tx, row).await?;

    tx.commit().await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<ChatbotConversationMessage> {
    let mut tx = conn.begin().await?;

    let row = sqlx::query_as!(
        ChatbotConversationMessageRow,
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
    tool_output_id
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;

    if let Some(output_id) = row.tool_output_id {
        chatbot_conversation_message_tool_outputs::delete(&mut tx, output_id).await?;
    }
    chatbot_conversation_message_tool_calls::delete_all_by_message_id(&mut tx, row.id).await?;

    let res = message_row_to_message(&mut tx, row).await?;
    tx.commit().await?;
    Ok(res)
}

pub async fn message_row_to_message(
    conn: &mut PgConnection,
    row: ChatbotConversationMessageRow,
) -> ModelResult<ChatbotConversationMessage> {
    let o = if let Some(id) = row.tool_output_id {
        Some(chatbot_conversation_message_tool_outputs::get_by_id(conn, id).await?)
    } else {
        None
    };
    let c = chatbot_conversation_message_tool_calls::get_by_message_id(conn, row.id).await?;
    let res = ChatbotConversationMessage::from_row(row, o, c);
    Ok(res)
}
