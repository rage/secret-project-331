use futures::future::OptionFuture;
use utoipa::ToSchema;

use crate::{
    chatbot_conversation_messages::ChatbotConversationMessage,
    chatbot_conversation_messages_citations::ChatbotConversationMessageCitation,
    chatbot_conversation_suggested_messages::ChatbotConversationSuggestedMessage, prelude::*,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct ChatbotConversation {
    pub id: Uuid,
    pub anonymous_token: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub chatbot_configuration_id: Uuid,
    pub conversation_title: Option<String>,
    /// Set for conversations with the course design assistant about this plan.
    pub course_designer_plan_id: Option<Uuid>,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, ToSchema)]

/// Everything needed to display the chatbot to the user.
pub struct ChatbotConversationInfo {
    pub current_conversation: Option<ChatbotConversation>,
    pub current_conversation_messages: Option<Vec<ChatbotConversationMessage>>,
    pub current_conversation_message_citations: Option<Vec<ChatbotConversationMessageCitation>>,
    pub chatbot_name: String,
    pub course_name: Option<String>,
    pub hide_citations: bool,
    /// What to offer the learner as their next message. Absent when nothing should be offered: the
    /// configuration has suggestions off, or the conversation is at a point where a suggestion does
    /// not belong, such as a turn suspended on a question to the learner. Empty means suggestions
    /// are wanted but none have been generated yet, which is what makes the endpoint generate them.
    pub suggested_messages: Option<Vec<ChatbotConversationSuggestedMessage>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversation,
) -> ModelResult<ChatbotConversation> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
INSERT INTO chatbot_conversations (
    course_id,
    user_id,
    anonymous_token,
    chatbot_configuration_id,
    conversation_title
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
        "#,
        input.course_id,
        input.user_id,
        input.anonymous_token,
        input.chatbot_configuration_id,
        input.conversation_title
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ChatbotConversation> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
SELECT *
FROM chatbot_conversations
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Soft deletes a conversation, after which it accepts no further messages.
///
/// Deleting one that is already deleted is not an error, so a caller does not have to check first.
/// See [crate::chatbot_configurations::delete] for removing the configuration a conversation
/// belongs to.
///
/// Nothing in production deletes a conversation; this exists for tests.
pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE chatbot_conversations
SET deleted_at = now()
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn create_for_user_and_configuration(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    user_id: Option<Uuid>,
    anonymous_token: Option<String>,
    chatbot_configuration_id: Uuid,
) -> ModelResult<ChatbotConversation> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
INSERT INTO chatbot_conversations (
    id,
    course_id,
    user_id,
    anonymous_token,
    chatbot_configuration_id,
    conversation_title
  )
SELECT $1,
  chatbot_configurations.course_id,
  $2,
  $3,
  chatbot_configurations.id,
  NULL
FROM chatbot_configurations
WHERE chatbot_configurations.id = $4
  AND chatbot_configurations.deleted_at IS NULL
RETURNING *
        "#,
        pkey_policy.into_uuid(),
        user_id,
        anonymous_token,
        chatbot_configuration_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_latest_conversation_for_user(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    anonymous_token: Option<String>,
    chatbot_configuration_id: Uuid,
) -> ModelResult<ChatbotConversation> {
    if let (Some(_user_id), Some(_anonymous_token)) = (&user_id, &anonymous_token) {
        return Err(model_err!(
            InvalidRequest,
            "User ID and anonymous token cannot both be present".to_string()
        ));
    }
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
SELECT *
FROM chatbot_conversations
WHERE (
    user_id = $1
    OR anonymous_token = $2
  )
  AND chatbot_configuration_id = $3
  AND course_designer_plan_id IS NULL
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
        "#,
        user_id,
        anonymous_token,
        chatbot_configuration_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_conversation_for_user(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    anonymous_token: Option<String>,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
) -> ModelResult<ChatbotConversation> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
SELECT *
FROM chatbot_conversations
WHERE (
    user_id = $1
    OR anonymous_token = $2
  )
  AND chatbot_configuration_id = $3
  AND id = $4
  AND course_designer_plan_id IS NULL
  AND deleted_at IS NULL
        "#,
        user_id,
        anonymous_token,
        chatbot_configuration_id,
        conversation_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_conversations_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<ChatbotConversation>> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
SELECT *
FROM chatbot_conversations
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
        "#,
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn update_conversation_title(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    conversation_title: String,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE chatbot_conversations
SET conversation_title = $1
WHERE id = $2
  AND deleted_at IS NULL
        "#,
        conversation_title,
        conversation_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Gets specific conversation or latest conversation for the user, if any. If conversation_id is not provided then latest conversation is given. Also inlcudes information about the chatbot so that the chatbot ui can be rendered using the information.
pub async fn get_conversation_info(
    tx: &mut PgConnection,
    user_id: Option<Uuid>,
    anonymous_token: Option<String>,
    chatbot_configuration_id: Uuid,
    conversation_id: Option<Uuid>,
) -> ModelResult<ChatbotConversationInfo> {
    let chatbot_configuration =
        crate::chatbot_configurations::get_by_id(tx, chatbot_configuration_id).await?;
    let course = if let Some(course_id) = chatbot_configuration.course_id {
        Some(crate::courses::get_course(tx, course_id).await?)
    } else {
        None
    };

    let current_conversation = if let Some(conversation_id) = conversation_id {
        get_conversation_for_user(
            tx,
            user_id,
            anonymous_token,
            chatbot_configuration_id,
            conversation_id,
        )
        .await
        .optional()?
    } else {
        get_latest_conversation_for_user(tx, user_id, anonymous_token, chatbot_configuration_id)
            .await
            .optional()?
    };

    conversation_info_for(tx, chatbot_configuration, course, current_conversation).await
}

/// The display info of `current_conversation` (or of no conversation) held with
/// `chatbot_configuration`.
async fn conversation_info_for(
    tx: &mut PgConnection,
    chatbot_configuration: crate::chatbot_configurations::ChatbotConfiguration,
    course: Option<crate::courses::Course>,
    current_conversation: Option<ChatbotConversation>,
) -> ModelResult<ChatbotConversationInfo> {
    let conversation_id = current_conversation.as_ref().map(|c| c.id);

    let current_conversation_messages = OptionFuture::from(conversation_id.map(|id| {
        crate::chatbot_conversation_messages::get_by_conversation_id_for_display(tx, id)
    }))
    .await
    .transpose()?;

    let current_conversation_message_citations =
        OptionFuture::from(conversation_id.map(|id| {
            crate::chatbot_conversation_messages_citations::get_by_conversation_id(tx, id)
        }))
        .await
        .transpose()?;

    let suggested_messages = if chatbot_configuration.suggest_next_messages
        && let Some(ccm) = &current_conversation_messages
        // A suspended turn is waiting for the learner to answer the chatbot's own question, which
        // is not a moment to suggest asking something else.
        && !crate::chatbot_conversation_messages::turn_is_suspended(ccm)
        && let Some(last_ccm) = ccm.last()
    {
        let sm = crate::chatbot_conversation_suggested_messages::get_by_conversation_message_id(
            tx,
            last_ccm.id.to_owned(),
        )
        .await?;
        // return an empty vec if there are not yet any suggested messages
        Some(sm)
    } else {
        None
    };

    Ok(ChatbotConversationInfo {
        current_conversation,
        current_conversation_messages,
        current_conversation_message_citations,
        suggested_messages,
        // Don't want to expose everything from the chatbot configuration to the user because it contains private information like the prompt.
        chatbot_name: chatbot_configuration.chatbot_name,
        course_name: course.map(|course| course.name),
        hide_citations: chatbot_configuration.hide_citations,
    })
}

/// Starts a conversation between `user_id` and the course design assistant about a plan.
///
/// The caller must have checked that the user is a member of the plan.
pub async fn create_for_course_plan(
    conn: &mut PgConnection,
    user_id: Uuid,
    chatbot_configuration_id: Uuid,
    course_designer_plan_id: Uuid,
) -> ModelResult<ChatbotConversation> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
INSERT INTO chatbot_conversations (
    course_id,
    user_id,
    chatbot_configuration_id,
    course_designer_plan_id
  )
SELECT chatbot_configurations.course_id,
  $1,
  chatbot_configurations.id,
  $3
FROM chatbot_configurations
WHERE chatbot_configurations.id = $2
  AND chatbot_configurations.deleted_at IS NULL
RETURNING *
        "#,
        user_id,
        chatbot_configuration_id,
        course_designer_plan_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The user's latest conversation about the plan with this assistant configuration, if any.
pub async fn get_latest_for_course_plan(
    conn: &mut PgConnection,
    user_id: Uuid,
    chatbot_configuration_id: Uuid,
    course_designer_plan_id: Uuid,
) -> ModelResult<Option<ChatbotConversation>> {
    let res = sqlx::query_as!(
        ChatbotConversation,
        r#"
SELECT *
FROM chatbot_conversations
WHERE user_id = $1
  AND chatbot_configuration_id = $2
  AND course_designer_plan_id = $3
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
        "#,
        user_id,
        chatbot_configuration_id,
        course_designer_plan_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Display info of one of the user's conversations about a plan. Never offers suggested messages.
///
/// Fails with `RecordNotFound` when the conversation is not the user's, not about this plan or not
/// held with this configuration.
pub async fn get_course_plan_conversation_info(
    conn: &mut PgConnection,
    user_id: Uuid,
    chatbot_configuration_id: Uuid,
    course_designer_plan_id: Uuid,
    conversation_id: Uuid,
) -> ModelResult<ChatbotConversationInfo> {
    let conversation = sqlx::query_as!(
        ChatbotConversation,
        r#"
SELECT *
FROM chatbot_conversations
WHERE id = $1
  AND user_id = $2
  AND chatbot_configuration_id = $3
  AND course_designer_plan_id = $4
  AND deleted_at IS NULL
        "#,
        conversation_id,
        user_id,
        chatbot_configuration_id,
        course_designer_plan_id
    )
    .fetch_one(&mut *conn)
    .await?;
    let chatbot_configuration =
        crate::chatbot_configurations::get_by_id(conn, chatbot_configuration_id).await?;
    let course = if let Some(course_id) = chatbot_configuration.course_id {
        Some(crate::courses::get_course(conn, course_id).await?)
    } else {
        None
    };
    let info =
        conversation_info_for(conn, chatbot_configuration, course, Some(conversation)).await?;
    Ok(ChatbotConversationInfo {
        suggested_messages: None,
        ..info
    })
}
