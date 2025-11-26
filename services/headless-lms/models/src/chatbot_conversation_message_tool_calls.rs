use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ToolCallFields {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub message_id: Uuid,
    pub tool_name: String,
    pub tool_arguments: String,
    pub tool_call_id: String,
}

impl Default for ToolCallFields {
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
    input: ToolCallFields,
    msg_id: Uuid,
) -> ModelResult<ToolCallFields> {
    let res = sqlx::query_as!(
        ToolCallFields,
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

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ToolCallFields> {
    let res = sqlx::query_as!(
        ToolCallFields,
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
) -> ModelResult<Vec<ToolCallFields>> {
    let res = sqlx::query_as!(
        ToolCallFields,
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
) -> ModelResult<Vec<ToolCallFields>> {
    let res = sqlx::query_as!(
        ToolCallFields,
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
