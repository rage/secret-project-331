use serde_json::Value;

use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationMessageToolCall {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub message_id: Uuid,
    pub tool_name: String,
    pub tool_arguments: Value,
    pub tool_call_id: String,
}

impl Default for ChatbotConversationMessageToolCall {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            message_id: Uuid::nil(),
            tool_name: Default::default(),
            tool_arguments: Default::default(),
            tool_call_id: Default::default(),
        }
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessageToolCall,
    msg_id: Uuid,
) -> ModelResult<ChatbotConversationMessageToolCall> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolCall,
        r#"
        INSERT INTO chatbot_conversation_message_tool_calls (
          message_id,
          tool_name,
          tool_arguments,
          tool_call_id
        ) VALUES ($1, $2, $3, $4) RETURNING *
                "#,
        msg_id,
        input.tool_name,
        input.tool_arguments,
        input.tool_call_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert_batch(
    conn: &mut PgConnection,
    input: Vec<ChatbotConversationMessageToolCall>,
    msg_id: Uuid,
) -> ModelResult<ChatbotConversationMessageToolCall> {
    let tool_names: Vec<String> = input.iter().map(|i| i.tool_name.to_owned()).collect();
    let tool_args: Vec<Value> = input.iter().map(|i| i.tool_arguments.to_owned()).collect();
    let tool_ids: Vec<String> = input.iter().map(|i| i.tool_call_id.to_owned()).collect();

    let res = sqlx::query_as!(
        ChatbotConversationMessageToolCall,
        r#"
        INSERT INTO chatbot_conversation_message_tool_calls (
          message_id,
          tool_name,
          tool_arguments,
          tool_call_id
        ) SELECT $1,
            UNNEST($2::VARCHAR(255)[]),
            UNNEST($3::JSONB[]),
            UNNEST($4::VARCHAR(255)[])
        RETURNING *
                "#,
        msg_id,
        &tool_names,
        &tool_args,
        &tool_ids,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ChatbotConversationMessageToolCall> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolCall,
        r#"
        SELECT * FROM chatbot_conversation_message_tool_calls
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
    msg_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessageToolCall>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolCall,
        r#"
        SELECT * FROM chatbot_conversation_message_tool_calls
        WHERE message_id = $1
        AND deleted_at IS NULL
        "#,
        msg_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn delete_all_by_message_id(
    conn: &mut PgConnection,
    msg_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessageToolCall>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolCall,
        r#"
        UPDATE chatbot_conversation_message_tool_calls
        SET deleted_at = NOW()
        WHERE message_id = $1
        RETURNING *
        "#,
        msg_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
