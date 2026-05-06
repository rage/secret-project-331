use utoipa::ToSchema;

use crate::{
    chatbot_conversation_message_messages::{self, ChatbotConversationMessageMessage},
    chatbot_conversation_message_reasoning::{self, ChatbotConversationMessageReasoning},
    chatbot_conversation_message_tool_calls::{self, ChatbotConversationMessageToolCall},
    chatbot_conversation_message_tool_outputs::{self, ChatbotConversationMessageToolOutput},
    prelude::*,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ChatbotConversationMessageRow {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub conversation_id: Uuid,
    pub order_number: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(untagged)]
pub enum Message {
    Text(ChatbotConversationMessageMessage),
    ToolCall(ChatbotConversationMessageToolCall),
    ToolOutput(ChatbotConversationMessageToolOutput),
    Reasoning(ChatbotConversationMessageReasoning),
}

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug, ToSchema)]
pub struct ChatbotConversationMessage {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub conversation_id: Uuid,
    pub order_number: i32,
    pub message: Message,
}

impl Default for ChatbotConversationMessage {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            conversation_id: Uuid::nil(),
            order_number: Default::default(),
            message: Message::Text(ChatbotConversationMessageMessage::default()),
        }
    }
}

impl ChatbotConversationMessage {
    pub fn from_row(r: ChatbotConversationMessageRow, m: Message) -> Self {
        ChatbotConversationMessage {
            id: r.id,
            created_at: r.created_at,
            updated_at: r.updated_at,
            deleted_at: r.deleted_at,
            conversation_id: r.conversation_id,
            order_number: r.order_number,
            message: m,
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
INSERT INTO chatbot_conversation_messages (conversation_id, order_number)
VALUES (
    $1,
    COALESCE((
      SELECT order_number
      FROM chatbot_conversation_messages
      WHERE conversation_id = $1
        AND deleted_at IS NULL
      ORDER BY order_number DESC
      LIMIT 1
    ), 0) + 1
  )
RETURNING *
        "#,
        input.conversation_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    let inner = match input.message {
        Message::Text(message) => {
            let res =
                chatbot_conversation_message_messages::insert(&mut *tx, message, msg.id).await?;
            Message::Text(res)
        }
        Message::ToolCall(tool_call) => {
            let res = chatbot_conversation_message_tool_calls::insert(&mut *tx, tool_call, msg.id)
                .await?;
            Message::ToolCall(res)
        }
        Message::ToolOutput(tool_output) => {
            let res =
                chatbot_conversation_message_tool_outputs::insert(&mut *tx, tool_output, msg.id)
                    .await?;
            Message::ToolOutput(res)
        }
        Message::Reasoning(reasoning) => {
            let res =
                chatbot_conversation_message_reasoning::insert(&mut *tx, reasoning, msg.id).await?;
            Message::Reasoning(res)
        }
    };

    let res = ChatbotConversationMessage::from_row(msg, inner);
    tx.commit().await?;
    Ok(res)
}

// todo
pub async fn insert_for_conversation_user_and_configuration(
    conn: &mut PgConnection,
    input: ChatbotConversationMessage,
    user_id: Uuid,
    chatbot_configuration_id: Uuid,
) -> ModelResult<ChatbotConversationMessage> {
    let mut tx = conn.begin().await?;

    sqlx::query!(
        r#"
SELECT id
FROM chatbot_conversations
WHERE id = $1
  AND user_id = $2
  AND chatbot_configuration_id = $3
  AND deleted_at IS NULL
        "#,
        input.conversation_id,
        user_id,
        chatbot_configuration_id
    )
    .fetch_one(&mut *tx)
    .await?;

    let msg = sqlx::query_as!(
        ChatbotConversationMessageRow,
        r#"
INSERT INTO chatbot_conversation_messages (
    conversation_id,
    order_number
)
VALUES (
    $1,
    COALESCE((
      SELECT order_number
      FROM chatbot_conversation_messages
      WHERE conversation_id = $1
        AND deleted_at IS NULL
      ORDER BY order_number DESC
      LIMIT 1
    ), 0) + 1
)
RETURNING *
        "#,
        input.conversation_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    let inner = match input.message {
        Message::Text(message) => {
            let res =
                chatbot_conversation_message_messages::insert(&mut *tx, message, msg.id).await?;
            Message::Text(res)
        }
        Message::ToolCall(tool_call) => {
            let res = chatbot_conversation_message_tool_calls::insert(&mut *tx, tool_call, msg.id)
                .await?;
            Message::ToolCall(res)
        }
        Message::ToolOutput(tool_output) => {
            let res =
                chatbot_conversation_message_tool_outputs::insert(&mut *tx, tool_output, msg.id)
                    .await?;
            Message::ToolOutput(res)
        }
        Message::Reasoning(reasoning) => {
            let res =
                chatbot_conversation_message_reasoning::insert(&mut *tx, reasoning, msg.id).await?;
            Message::Reasoning(res)
        }
    };

    let res = ChatbotConversationMessage::from_row(msg, inner);
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
    order_number
FROM chatbot_conversation_messages
WHERE conversation_id = $1
AND deleted_at IS NULL
        "#,
        conversation_id
    )
    .fetch_all(&mut *tx)
    .await?;
    // Should have the same order as in the conversation.
    msgs.sort_by_key(|a| a.order_number);
    let mut res = vec![];
    for m in msgs {
        let msg = message_row_to_message(&mut tx, m).await?;
        res.push(msg);
    }
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
RETURNING *
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;

    // delete the child
    let child = delete_message_fields(&mut *tx, row.id).await?;

    let res = ChatbotConversationMessage::from_row(row, child);
    tx.commit().await?;
    Ok(res)
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    text: &str,
    message_is_complete: bool,
    used_tokens: i32,
) -> ModelResult<ChatbotConversationMessage> {
    let mut tx = conn.begin().await?;

    let row = sqlx::query_as!(
        ChatbotConversationMessageRow,
        r#"
UPDATE chatbot_conversation_messages
SET updated_at = NOW()
WHERE id = $1
RETURNING *
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;

    // update the parent
    let child = chatbot_conversation_message_messages::update(
        &mut *tx,
        row.id,
        text,
        message_is_complete,
        used_tokens,
    )
    .await?;

    let res = ChatbotConversationMessage::from_row(row, Message::Text(child));
    tx.commit().await?;

    Ok(res)
}

pub async fn message_row_to_message(
    conn: &mut PgConnection,
    row: ChatbotConversationMessageRow,
) -> ModelResult<ChatbotConversationMessage> {
    let inner_message = get_message_fields(conn, row.id).await?;
    let res = ChatbotConversationMessage::from_row(row, inner_message);
    Ok(res)
}

pub async fn get_message_fields(conn: &mut PgConnection, message_id: Uuid) -> ModelResult<Message> {
    if let Some(message) =
        chatbot_conversation_message_messages::get_by_message_id(conn, message_id).await?
    {
        Ok(Message::Text(message))
    } else if let Some(tool_call) =
        chatbot_conversation_message_tool_calls::get_by_message_id(conn, message_id).await?
    {
        Ok(Message::ToolCall(tool_call))
    } else if let Some(tool_output) =
        chatbot_conversation_message_tool_outputs::get_by_message_id(conn, message_id).await?
    {
        Ok(Message::ToolOutput(tool_output))
    } else if let Some(reasoning) =
        chatbot_conversation_message_reasoning::get_by_message_id(conn, message_id).await?
    {
        Ok(Message::Reasoning(reasoning))
    } else {
        Err(ModelError::new(
            ModelErrorType::RecordNotFound,
            "No inner message found for this ChatbotConversationMessage",
            None,
        ))
    }
}

pub async fn delete_message_fields(
    conn: &mut PgConnection,
    message_id: Uuid,
) -> ModelResult<Message> {
    if let Some(message) =
        chatbot_conversation_message_messages::get_by_message_id(conn, message_id).await?
    {
        let res = chatbot_conversation_message_messages::delete(conn, message.id).await?;
        Ok(Message::Text(res))
    } else if let Some(tool_call) =
        chatbot_conversation_message_tool_calls::get_by_message_id(conn, message_id).await?
    {
        let res = chatbot_conversation_message_tool_calls::delete(conn, tool_call.id).await?;
        Ok(Message::ToolCall(res))
    } else if let Some(tool_output) =
        chatbot_conversation_message_tool_outputs::get_by_message_id(conn, message_id).await?
    {
        let res = chatbot_conversation_message_tool_outputs::delete(conn, tool_output.id).await?;
        Ok(Message::ToolOutput(res))
    } else if let Some(reasoning) =
        chatbot_conversation_message_reasoning::get_by_message_id(conn, message_id).await?
    {
        let res = chatbot_conversation_message_reasoning::delete(conn, reasoning.id).await?;
        Ok(Message::Reasoning(res))
    } else {
        Err(ModelError::new(
            ModelErrorType::RecordNotFound,
            "No inner message found for this ChatbotConversationMessage",
            None,
        ))
    }
}
