use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct ChatbotConversationMessageCitation {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub conversation_message_id: Uuid,
    pub conversation_id: Uuid,
    pub course_material_chapter_number: Option<i32>,
    pub title: String,
    pub content: String,
    pub document_url: String,
    pub citation_number: i32,
}

impl Default for ChatbotConversationMessageCitation {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            conversation_message_id: Uuid::nil(),
            conversation_id: Uuid::nil(),
            course_material_chapter_number: None,
            title: Default::default(),
            content: Default::default(),
            document_url: Default::default(),
            citation_number: Default::default(),
        }
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessageCitation,
) -> ModelResult<ChatbotConversationMessageCitation> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
INSERT INTO chatbot_conversation_messages_citations (
  conversation_message_id,
  conversation_id,
  course_material_chapter_number,
  title,
  content,
  document_url,
  citation_number)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
        "#,
        input.conversation_message_id,
        input.conversation_id,
        input.course_material_chapter_number,
        input.title,
        input.content,
        input.document_url,
        input.citation_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Insert a batch of citation from the same conversation
pub async fn insert_batch(
    conn: &mut PgConnection,
    input: Vec<ChatbotConversationMessageCitation>,
    page_ids: Vec<Option<Uuid>>,
) -> ModelResult<Vec<ChatbotConversationMessageCitation>> {
    if input.is_empty() {
        return Ok(vec![]);
    }
    let conv_id = input[0].conversation_id;
    let cm_ids: Vec<Uuid> = input.iter().map(|x| x.conversation_message_id).collect();
    let titles: Vec<String> = input.iter().map(|x| x.title.to_owned()).collect();
    let contents: Vec<String> = input.iter().map(|x| x.content.to_owned()).collect();
    let document_urls: Vec<String> = input.iter().map(|x| x.document_url.to_owned()).collect();
    let citation_numbers: Vec<i32> = input.iter().map(|x| x.citation_number).collect();

    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
INSERT INTO chatbot_conversation_messages_citations (
    conversation_id,
    conversation_message_id,
    title,
    content,
    document_url,
    citation_number,
    course_material_chapter_number
  )
SELECT $1,
  input.cm_id,
  input.title,
  input.content,
  input.document_url,
  input.citation_number,
  c.chapter_number
FROM (
    SELECT UNNEST($2::UUID []) cm_id,
      UNNEST($3::TEXT []) title,
      UNNEST($4::TEXT []) content,
      UNNEST($5::TEXT []) document_url,
      UNNEST($6::INTEGER []) citation_number,
      UNNEST($7::UUID []) page_id
  ) AS input
  JOIN pages p ON p.id = input.page_id
  LEFT JOIN chapters c ON p.chapter_id = c.id
WHERE c.deleted_at IS NULL
  AND p.deleted_at IS NULL
RETURNING *
        "#,
        conv_id,
        &cm_ids,
        &titles,
        &contents,
        &document_urls,
        &citation_numbers,
        &page_ids as _,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_message_id(
    conn: &mut PgConnection,
    message_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessageCitation>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
SELECT * FROM chatbot_conversation_messages_citations
WHERE conversation_message_id = $1
AND deleted_at IS NULL
        "#,
        message_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_conversation_id(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessageCitation>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
SELECT * FROM chatbot_conversation_messages_citations
WHERE conversation_id = $1
AND deleted_at IS NULL
        "#,
        conversation_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Points the citations of the conversation's newest turn at `conversation_message_id`, the
/// message whose text cites them.
///
/// A citation is saved attached to the search tool output it was read from, a message the chatbot
/// ui does not render, so a citation only becomes reachable once it is moved to the answer. The
/// turn is taken to be every message after the newest message from the user: a turn can search in
/// one round and answer in another, and the round that answers has a different Azure response id
/// than the round that searched, both when a tool call was answered on the server and when the
/// turn suspended and a later request resumed it.
pub async fn attach_turn_citations_to_message(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    conversation_message_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessageCitation>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
UPDATE chatbot_conversation_messages_citations
SET conversation_message_id = $1
WHERE conversation_id = $2
  AND deleted_at IS NULL
  AND conversation_message_id IN (
    SELECT message.id
    FROM chatbot_conversation_messages message
      JOIN chatbot_conversation_message_tool_outputs tool_output ON tool_output.chatbot_conversation_message_id = message.id
    WHERE message.conversation_id = $2
      AND message.deleted_at IS NULL
      AND tool_output.deleted_at IS NULL
      AND message.order_number > COALESCE(
        (
          SELECT MAX(user_message.order_number)
          FROM chatbot_conversation_messages user_message
            JOIN chatbot_conversation_message_messages text_message ON text_message.chatbot_conversation_message_id = user_message.id
          WHERE user_message.conversation_id = $2
            AND user_message.deleted_at IS NULL
            AND text_message.deleted_at IS NULL
            AND text_message.message_role = 'user'
        ),
        0
      )
  )
RETURNING *
        "#,
        conversation_message_id,
        conversation_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        chatbot_configurations::{self, NewChatbotConf},
        chatbot_conversation_message_messages::{ChatbotConversationMessageMessage, MessageRole},
        chatbot_conversation_message_tool_calls::{ChatbotConversationMessageToolCall, ToolKind},
        chatbot_conversation_message_tool_outputs::ChatbotConversationMessageToolOutput,
        chatbot_conversation_messages::{self, ChatbotConversationMessage, Message},
        chatbot_conversations,
        test_helper::*,
    };

    /// A publicly accessible chatbot configuration and a conversation for it. Needs no course:
    /// nothing here reads the configuration's course.
    async fn insert_conversation(conn: &mut PgConnection) -> Uuid {
        let unique = Uuid::new_v4().to_string();
        let configuration = chatbot_configurations::insert(
            conn,
            PKeyPolicy::Generate,
            NewChatbotConf {
                chatbot_name: unique.clone(),
                model_id: Uuid::new_v4(),
                publicly_accessible: true,
                ..Default::default()
            },
        )
        .await
        .unwrap();
        chatbot_conversations::create_for_user_and_configuration(
            conn,
            PKeyPolicy::Generate,
            None,
            Some(unique),
            configuration.id,
        )
        .await
        .unwrap()
        .id
    }

    async fn insert_text_message(
        conn: &mut PgConnection,
        conversation_id: Uuid,
        role: MessageRole,
        response_id: Option<&str>,
    ) -> ChatbotConversationMessage {
        chatbot_conversation_messages::insert(
            conn,
            ChatbotConversationMessage {
                conversation_id,
                message: Message::Text(ChatbotConversationMessageMessage {
                    text: "text".to_string(),
                    message_role: role,
                    message_is_complete: true,
                    response_id: response_id.map(|id| id.to_string()),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await
        .unwrap()
    }

    async fn insert_tool_call(
        conn: &mut PgConnection,
        conversation_id: Uuid,
        tool_call_id: &str,
        response_id: &str,
    ) -> ChatbotConversationMessage {
        chatbot_conversation_messages::insert(
            conn,
            ChatbotConversationMessage {
                conversation_id,
                message: Message::ToolCall(ChatbotConversationMessageToolCall {
                    tool_name: "ask_multiple_choice_question".to_string(),
                    tool_call_id: tool_call_id.to_string(),
                    tool_kind: ToolKind::ClientTool,
                    response_id: response_id.to_string(),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await
        .unwrap()
    }

    async fn insert_tool_output(
        conn: &mut PgConnection,
        conversation_id: Uuid,
        tool_call_id: &str,
        response_id: &str,
    ) -> ChatbotConversationMessage {
        chatbot_conversation_messages::insert(
            conn,
            ChatbotConversationMessage {
                conversation_id,
                message: Message::ToolOutput(ChatbotConversationMessageToolOutput {
                    output: "output".to_string(),
                    tool_call_id: tool_call_id.to_string(),
                    tool_kind: ToolKind::ClientTool,
                    response_id: response_id.to_string(),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await
        .unwrap()
    }

    async fn insert_citation(
        conn: &mut PgConnection,
        conversation_id: Uuid,
        conversation_message_id: Uuid,
    ) -> ChatbotConversationMessageCitation {
        insert(
            conn,
            ChatbotConversationMessageCitation {
                conversation_id,
                conversation_message_id,
                title: "A page".to_string(),
                content: "Cited content".to_string(),
                document_url: "https://example.com/page".to_string(),
                ..Default::default()
            },
        )
        .await
        .unwrap()
    }

    /// A turn that suspends on a client tool call answers in a later request, under an Azure
    /// response id of its own, so the search that produced the citations happened under a
    /// different one. The learner is shown the citation markers of the answer either way, so a
    /// citation left behind on the search output is a marker with nothing behind it.
    #[tokio::test]
    async fn citations_of_a_suspended_turn_reach_the_message_that_cites_them() {
        insert_data!(:tx);
        let conversation = insert_conversation(tx.as_mut()).await;
        insert_text_message(tx.as_mut(), conversation, MessageRole::User, None).await;
        let search_output =
            insert_tool_output(tx.as_mut(), conversation, "call_search", "resp_search").await;
        let citation = insert_citation(tx.as_mut(), conversation, search_output.id).await;
        insert_tool_call(tx.as_mut(), conversation, "call_question", "resp_question").await;
        insert_tool_output(tx.as_mut(), conversation, "call_question", "resp_question").await;
        let answer = insert_text_message(
            tx.as_mut(),
            conversation,
            MessageRole::Assistant,
            Some("resp_answer"),
        )
        .await;

        attach_turn_citations_to_message(tx.as_mut(), conversation, answer.id)
            .await
            .unwrap();

        let reachable = get_by_message_id(tx.as_mut(), answer.id).await.unwrap();
        assert_eq!(
            reachable.iter().map(|c| c.id).collect::<Vec<Uuid>>(),
            vec![citation.id]
        );
    }

    /// Citations of a turn that never answered belong to no message the learner reads, and moving
    /// them to the next turn's answer would credit it with sources it never cited.
    #[tokio::test]
    async fn citations_of_an_earlier_turn_are_left_where_they_are() {
        insert_data!(:tx);
        let conversation = insert_conversation(tx.as_mut()).await;
        insert_text_message(tx.as_mut(), conversation, MessageRole::User, None).await;
        let abandoned_search =
            insert_tool_output(tx.as_mut(), conversation, "call_search", "resp_search").await;
        let orphan = insert_citation(tx.as_mut(), conversation, abandoned_search.id).await;
        insert_text_message(tx.as_mut(), conversation, MessageRole::User, None).await;
        let answer = insert_text_message(
            tx.as_mut(),
            conversation,
            MessageRole::Assistant,
            Some("resp_answer"),
        )
        .await;

        attach_turn_citations_to_message(tx.as_mut(), conversation, answer.id)
            .await
            .unwrap();

        assert!(
            get_by_message_id(tx.as_mut(), answer.id)
                .await
                .unwrap()
                .is_empty()
        );
        let left = get_by_message_id(tx.as_mut(), abandoned_search.id)
            .await
            .unwrap();
        assert_eq!(
            left.iter().map(|c| c.id).collect::<Vec<Uuid>>(),
            vec![orphan.id]
        );
    }

    /// A citation belongs to one conversation, and nothing outside that conversation may claim it,
    /// however the ids of a turn happen to repeat elsewhere.
    #[tokio::test]
    async fn citations_of_another_conversation_are_not_touched() {
        insert_data!(:tx);
        let conversation = insert_conversation(tx.as_mut()).await;
        let other_conversation = insert_conversation(tx.as_mut()).await;
        insert_text_message(tx.as_mut(), other_conversation, MessageRole::User, None).await;
        let other_search = insert_tool_output(
            tx.as_mut(),
            other_conversation,
            "call_search",
            "resp_search",
        )
        .await;
        let other_citation =
            insert_citation(tx.as_mut(), other_conversation, other_search.id).await;
        insert_text_message(tx.as_mut(), conversation, MessageRole::User, None).await;
        let answer = insert_text_message(
            tx.as_mut(),
            conversation,
            MessageRole::Assistant,
            Some("resp_answer"),
        )
        .await;

        let moved = attach_turn_citations_to_message(tx.as_mut(), conversation, answer.id)
            .await
            .unwrap();

        assert!(moved.is_empty());
        assert_eq!(
            get_by_message_id(tx.as_mut(), other_search.id)
                .await
                .unwrap()
                .iter()
                .map(|c| c.id)
                .collect::<Vec<Uuid>>(),
            vec![other_citation.id]
        );
    }
}
