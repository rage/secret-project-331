//! What a chatbot request says about the course material page the learner has open.

use serde::{Deserialize, Serialize};
use tracing::warn;
use utoipa::ToSchema;

use headless_lms_models::{
    chatbot_conversation_message_messages::MessageRole,
    chatbot_conversation_messages::ChatbotConversationMessage, pages::PageChatbotContext,
};

use crate::{llm_utils::estimate_tokens, prelude::*};

/// Stands in for the Azure response id of a page context message, which we write ourselves and
/// which therefore has no Azure response behind it. The `not_null_for_llm_generated_messages`
/// check constraint demands one for every message that is not from the user; the initial
/// assistant message of a conversation stands in for it the same way.
const PAGE_CONTEXT_RESPONSE_ID: &str = "page-context";

/// What the learner has open when they send a message.
///
/// Only the page id is accepted: everything the model reads is looked up from the database.
/// The context becomes a developer message, which the model weighs above the learner's own
/// words, so a client that could write its text could give itself instructions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct ChatbotPageContext {
    pub page_id: Uuid,
}

/// The page the learner claims to have open, or `None` when nothing about it may be shown to the
/// model.
///
/// Read before the conversation is locked, since it depends on nothing the lock protects. The
/// context is advisory, so a page id that leads nowhere is dropped rather than failing the
/// message it came with: the id is the client's, and a learner whose page was deleted under them
/// would otherwise be unable to write to the chatbot at all. `course_id` is the course of the
/// chatbot configuration; a configuration with no course accepts no page context at all.
pub async fn resolve_page_context(
    conn: &mut PgConnection,
    page_context: ChatbotPageContext,
    course_id: Option<Uuid>,
) -> Option<PageChatbotContext> {
    let Ok(page) = models::pages::get_page_chatbot_context(conn, page_context.page_id).await else {
        warn!(
            page_id = %page_context.page_id,
            "Ignoring chatbot page context for a page that could not be read"
        );
        return None;
    };
    // Both sides are optional, and a bare `!=` would let a course-less configuration through for
    // every course-less page: by DB constraint those are exactly the anonymously reachable
    // configurations on one side and every exam page on the other.
    if course_id.is_none() || page.course_id != course_id {
        warn!(
            page_id = %page.id,
            "Ignoring chatbot page context for a page outside the chatbot's course"
        );
        return None;
    }
    // `get_page_chatbot_context` reads a page whatever its state, and the id reaches us as the
    // client's claim to be on it, so a title nobody is meant to see yet would otherwise reach the
    // model.
    if page.hidden || page.deleted_at.is_some() {
        warn!(
            page_id = %page.id,
            "Ignoring chatbot page context for a page that is not published"
        );
        return None;
    }

    Some(page)
}

/// Records what the learner is looking at as a developer message in the conversation, so that
/// it survives a history rebuild instead of being prepended in memory on every request.
///
/// Writes nothing when the conversation's newest page context already says the same thing.
/// `course_name` is the name of the course the chatbot belongs to.
///
/// Must be called inside the transaction that took the conversation lock: whether this context
/// repeats the newest one is decided from the conversation, so two requests reading it before
/// either writes would both conclude it changed and both write.
pub async fn insert_page_context_message_if_changed(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    page: &PageChatbotContext,
    course_name: Option<&str>,
) -> ChatbotResult<()> {
    let text = page_context_text(&page.title, page.chapter_name.as_deref(), course_name);
    let latest = models::chatbot_conversation_messages::get_latest_developer_message_text(
        conn,
        conversation_id,
    )
    .await?;
    if latest.as_deref() == Some(text.as_str()) {
        return Ok(());
    }

    models::chatbot_conversation_messages::insert(
        conn,
        page_context_message(conversation_id, text),
    )
    .await?;
    Ok(())
}

/// Describes the learner's place in the course to the model. Parts that could not be resolved
/// are left out rather than named as unknown.
fn page_context_text(
    page_title: &str,
    chapter_name: Option<&str>,
    course_name: Option<&str>,
) -> String {
    let mut location = format!("the page \"{page_title}\"");
    if let Some(chapter_name) = chapter_name {
        location.push_str(&format!(" in the chapter \"{chapter_name}\""));
    }
    if let Some(course_name) = course_name {
        location.push_str(&format!(" of the course \"{course_name}\""));
    }
    format!(
        "The learner is reading {location}. Take that as what they are asking about when their message does not say."
    )
}

fn page_context_message(conversation_id: Uuid, text: String) -> ChatbotConversationMessage {
    let used_tokens = estimate_tokens(&text);
    ChatbotConversationMessage::text(
        conversation_id,
        MessageRole::Developer,
        text,
        used_tokens,
        Some(PAGE_CONTEXT_RESPONSE_ID.to_string()),
    )
}

#[cfg(test)]
mod tests {
    use headless_lms_models::chatbot_conversation_messages::Message;

    use crate::{
        azure_chatbot::InputItem,
        llm_utils::{APIInputMessage, APIOutputMessage},
    };

    use super::*;

    #[test]
    fn page_context_text_omits_what_is_unknown() {
        let full = page_context_text("Loops", Some("Basics"), Some("Programming"));
        assert!(full.contains(
            "the page \"Loops\" in the chapter \"Basics\" of the course \"Programming\""
        ));

        let page_only = page_context_text("Loops", None, None);
        assert!(page_only.contains("the page \"Loops\""));
        assert!(!page_only.contains("chapter"));
        assert!(!page_only.contains("course"));
    }

    #[test]
    fn page_context_message_is_a_developer_message_that_satisfies_the_check_constraint() {
        let message = page_context_message(Uuid::new_v4(), "Reading a page".to_string());
        let Message::Text(text) = message.message else {
            panic!("expected a text message");
        };
        assert_eq!(text.message_role, MessageRole::Developer);
        assert_eq!(text.response_id.as_deref(), Some(PAGE_CONTEXT_RESPONSE_ID));
    }

    /// A stored page context has to survive both directions of the history rebuild, otherwise
    /// every later message of the conversation fails to convert.
    #[test]
    fn a_stored_page_context_converts_back_into_a_developer_message() {
        let message = page_context_message(Uuid::new_v4(), "Reading a page".to_string());

        let input = APIInputMessage::try_from(message.clone()).expect("input conversion");
        let InputItem::Message { role, content } = input.message_type else {
            panic!("expected a message input item");
        };
        assert_eq!(role, MessageRole::Developer);
        assert_eq!(content.get_content_text(), "Reading a page");

        let output = APIOutputMessage::try_from(message).expect("output conversion");
        let InputItem::Message { role, .. } = APIInputMessage::from(output).message_type else {
            panic!("expected a message input item");
        };
        assert_eq!(role, MessageRole::Developer);
    }
}
