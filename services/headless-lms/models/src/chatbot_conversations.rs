use futures::future::OptionFuture;

use crate::{chatbot_conversation_messages::ChatbotConversationMessage, prelude::*};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversation {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub user_id: Uuid,
    pub chatbot_configuration_id: Uuid,
}

#[derive(Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
/** Should contain all information required to display the chatbot to the user. */
pub struct ChatbotConversationInfo {
    pub current_conversation: Option<ChatbotConversation>,
    pub current_conversation_messages: Option<Vec<ChatbotConversationMessage>>,
    pub chatbot_name: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversation,
) -> ModelResult<ChatbotConversation> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
INSERT INTO chatbot_conversations (course_id, user_id, chatbot_configuration_id)
VALUES ($1, $2, $3)
RETURNING *
        "#,
        input.course_id,
        input.user_id,
        input.chatbot_configuration_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_latest_conversation_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    chatbot_configuration_id: Uuid,
) -> ModelResult<ChatbotConversation> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
SELECT *
FROM chatbot_conversations
WHERE user_id = $1
  AND chatbot_configuration_id = $2
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
        "#,
        user_id,
        chatbot_configuration_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Gets the current conversation for the user, if any. Also inlcudes information about the chatbot so that the chatbot ui can be rendered using the information.
pub async fn get_current_conversation_info(
    tx: &mut PgConnection,
    user_id: Uuid,
    chatbot_configuration_id: Uuid,
) -> ModelResult<ChatbotConversationInfo> {
    let chatbot_configuration =
        crate::chatbot_configurations::get_by_id(tx, chatbot_configuration_id).await?;
    let current_conversation =
        get_latest_conversation_for_user(tx, user_id, chatbot_configuration_id)
            .await
            .optional()?;
    let current_conversation_messages = OptionFuture::from(
        current_conversation
            .clone()
            .map(|c| crate::chatbot_conversation_messages::get_by_conversation_id(tx, c.id)),
    )
    .await
    .transpose()?;

    Ok(ChatbotConversationInfo {
        current_conversation,
        current_conversation_messages,
        // Don't want to expose everything from the chatbot configuration to the user because it contains private information like the prompt.
        chatbot_name: chatbot_configuration.chatbot_name,
    })
}
