use std::collections::{HashMap, HashSet};

use utoipa::ToSchema;

use crate::{
    chatbot_conversation_message_messages::{self, ChatbotConversationMessageMessage, MessageRole},
    chatbot_conversation_message_reasoning::{self, ChatbotConversationMessageReasoning},
    chatbot_conversation_message_tool_calls::{self, ChatbotConversationMessageToolCall},
    chatbot_conversation_message_tool_outputs::{self, ChatbotConversationMessageToolOutput},
    error::missing_model_error,
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
    /// A complete text message ready to be inserted by [insert]; `id` and `order_number` are the
    /// database's to assign.
    ///
    /// `used_tokens` is the caller's estimate of what the text costs the LLM's context, and is
    /// explicit because nothing recomputes it later. `response_id` has to be set for every role
    /// but the user's: the not_null_for_llm_generated_messages constraint demands one.
    pub fn text(
        conversation_id: Uuid,
        message_role: MessageRole,
        text: String,
        used_tokens: i32,
        response_id: Option<String>,
    ) -> Self {
        Self {
            conversation_id,
            message: Message::Text(ChatbotConversationMessageMessage {
                text,
                message_role,
                message_is_complete: true,
                used_tokens,
                response_id,
                ..Default::default()
            }),
            ..Default::default()
        }
    }

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

/// Locks the conversation row so that only one transaction at a time allocates an
/// `order_number` for it; without this two concurrent inserts pick the same number and one
/// of them violates the (conversation_id, order_number, deleted_at) unique index.
///
/// Errors if the conversation does not exist or has been deleted. The caller's transaction
/// holds the lock until it ends, so it must be a transaction that only writes messages and
/// never waits on an LLM request.
async fn lock_conversation_for_order_number_allocation(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<()> {
    // FOR NO KEY UPDATE excludes other allocators without blocking foreign key checks from
    // the conversation's other child rows.
    sqlx::query!(
        r#"
SELECT id
FROM chatbot_conversations
WHERE id = $1
  AND deleted_at IS NULL
FOR NO KEY UPDATE
        "#,
        conversation_id
    )
    .fetch_optional(conn)
    .await?
    .ok_or_else(missing_model_error(
        ModelErrorType::RecordNotFound,
        format!("Chatbot conversation {conversation_id} does not exist or has been deleted"),
    ))?;
    Ok(())
}

/// Appends a message to a conversation, allocating the next `order_number` for it.
///
/// Inserts both the message row and the row of the inner message type carried by
/// `input.message`; `input.id` and `input.order_number` are ignored and assigned by the
/// database. Errors if the conversation does not exist or has been deleted.
pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessage,
) -> ModelResult<ChatbotConversationMessage> {
    let mut tx = conn.begin().await?;
    lock_conversation_for_order_number_allocation(&mut tx, input.conversation_id).await?;
    let res = insert_locked(&mut tx, input).await?;
    tx.commit().await?;
    Ok(res)
}

/// [insert] for a caller whose own transaction already holds the conversation lock, which is what
/// makes the `order_number` allocation safe. Taking it again would only cost round trips.
async fn insert_locked(
    conn: &mut PgConnection,
    input: ChatbotConversationMessage,
) -> ModelResult<ChatbotConversationMessage> {
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
    .fetch_one(&mut *conn)
    .await?;

    let inner = match input.message {
        Message::Text(message) => {
            let res = chatbot_conversation_message_messages::insert(conn, message, msg.id).await?;
            Message::Text(res)
        }
        Message::ToolCall(tool_call) => {
            let res =
                chatbot_conversation_message_tool_calls::insert(conn, tool_call, msg.id).await?;
            Message::ToolCall(res)
        }
        Message::ToolOutput(tool_output) => {
            let res = chatbot_conversation_message_tool_outputs::insert(conn, tool_output, msg.id)
                .await?;
            Message::ToolOutput(res)
        }
        Message::Reasoning(reasoning) => {
            let res =
                chatbot_conversation_message_reasoning::insert(conn, reasoning, msg.id).await?;
            Message::Reasoning(res)
        }
    };

    Ok(ChatbotConversationMessage::from_row(msg, inner))
}

// todo
pub async fn insert_for_conversation_user_and_configuration(
    conn: &mut PgConnection,
    input: ChatbotConversationMessage,
    user_id: Option<Uuid>,
    anonymous_token: Option<String>,
    chatbot_configuration_id: Uuid,
) -> ModelResult<ChatbotConversationMessage> {
    if let (Some(_user_id), Some(_anonymous_token)) = (&user_id, &anonymous_token) {
        return Err(model_err!(
            InvalidRequest,
            "User ID and anonymous token cannot both be present".to_string()
        ));
    }
    let mut tx = conn.begin().await?;

    // Doubles as the order_number allocation lock, see
    // lock_conversation_for_order_number_allocation.
    sqlx::query!(
        r#"
SELECT id
FROM chatbot_conversations
WHERE id = $1
  AND (
    user_id = $2
    OR anonymous_token = $3
  )
  AND chatbot_configuration_id = $4
  AND deleted_at IS NULL
FOR NO KEY UPDATE
        "#,
        input.conversation_id,
        user_id,
        anonymous_token,
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
                chatbot_conversation_message_messages::insert(&mut tx, message, msg.id).await?;
            Message::Text(res)
        }
        Message::ToolCall(tool_call) => {
            let res =
                chatbot_conversation_message_tool_calls::insert(&mut tx, tool_call, msg.id).await?;
            Message::ToolCall(res)
        }
        Message::ToolOutput(tool_output) => {
            let res =
                chatbot_conversation_message_tool_outputs::insert(&mut tx, tool_output, msg.id)
                    .await?;
            Message::ToolOutput(res)
        }
        Message::Reasoning(reasoning) => {
            let res =
                chatbot_conversation_message_reasoning::insert(&mut tx, reasoning, msg.id).await?;
            Message::Reasoning(res)
        }
    };

    let res = ChatbotConversationMessage::from_row(msg, inner);
    tx.commit().await?;
    Ok(res)
}

/// Whether a reasoning message is read with its `encrypted_content`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReasoningPayload {
    /// For replaying the conversation to the LLM, which is the only reader of the payload.
    Include,
    /// For display: the payload is never serialized to the browser, so reading it only pays
    /// Postgres to hand back an opaque blob.
    Omit,
}

pub async fn get_by_conversation_id(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessage>> {
    get_conversation_messages(conn, conversation_id, ReasoningPayload::Include).await
}

/// [get_by_conversation_id] for callers that only display the conversation.
pub async fn get_by_conversation_id_for_display(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessage>> {
    get_conversation_messages(conn, conversation_id, ReasoningPayload::Omit).await
}

async fn get_conversation_messages(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    reasoning_payload: ReasoningPayload,
) -> ModelResult<Vec<ChatbotConversationMessage>> {
    let mut tx = conn.begin().await?;
    let rows: Vec<ChatbotConversationMessageRow> = sqlx::query_as!(
        ChatbotConversationMessageRow,
        r#"
SELECT *
FROM chatbot_conversation_messages
WHERE conversation_id = $1
AND deleted_at IS NULL
ORDER BY order_number
        "#,
        conversation_id
    )
    .fetch_all(&mut *tx)
    .await?;
    let message_ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let mut inner_messages = get_inner_messages(&mut tx, &message_ids, reasoning_payload).await?;
    tx.commit().await?;

    rows.into_iter()
        .map(|row| {
            let inner_message = inner_messages
                .remove(&row.id)
                .ok_or_else(missing_inner_message_error())?;
            Ok(ChatbotConversationMessage::from_row(row, inner_message))
        })
        .collect()
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<ChatbotConversationMessage> {
    let mut tx = conn.begin().await?;

    let row = sqlx::query_as!(
        ChatbotConversationMessageRow,
        r#"
UPDATE chatbot_conversation_messages
SET deleted_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING *
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;

    // delete the child
    let child = delete_message_fields(&mut tx, row.id).await?;

    let res = ChatbotConversationMessage::from_row(row, child);
    tx.commit().await?;
    Ok(res)
}

/// The text of the conversation's newest developer message, which is where its page context is
/// recorded.
///
/// Exists so the page context check does not have to materialize the whole conversation while the
/// caller holds the conversation lock: [get_by_conversation_id] costs several queries per message,
/// and every one of them is lock-held latency on the learner's send.
pub async fn get_latest_developer_message_text(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<Option<String>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT ccmm.text
FROM chatbot_conversation_message_messages AS ccmm
  JOIN chatbot_conversation_messages AS ccm ON ccm.id = ccmm.chatbot_conversation_message_id
WHERE ccm.conversation_id = $1
  AND ccmm.message_role = 'developer'
  AND ccmm.deleted_at IS NULL
  AND ccm.deleted_at IS NULL
ORDER BY ccm.order_number DESC
LIMIT 1
        "#,
        conversation_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Which unanswered tool calls a repair may abort.
pub enum UnansweredToolCallScope<'a> {
    /// The calls of the turn the caller is itself running, named by the responses that turn's
    /// rounds were given. A call of another turn is one that turn may be about to answer, and a
    /// `tool_call_id` that ends up with two outputs is replayed as two and rejected by the
    /// provider for the rest of the conversation.
    OwnTurn(&'a [String]),
    /// The calls of any turn that have gone unanswered since the cutoff, for a caller repairing
    /// what turns it knows nothing about left behind.
    AnyTurnOlderThan(DateTime<Utc>),
}

/// Sometimes during chatbot conversation streaming, the stream ends unexpectedly while a
/// tool call has been made but not answered. This happens also with provider tools that
/// we can't control. In this case, the conversation is left in a state which is invalid,
/// so we need to answer the un-answered tool calls to inform of the failure and continue
/// the conversation.
///
/// A [`ClientTool`](chatbot_conversation_message_tool_calls::ToolKind::ClientTool) call with no
/// output is not a failure but a suspended turn waiting for the client, and is left alone.
/// [abort_pending_client_tool_calls] is what ends the wait.
///
/// `scope` bounds which calls may be aborted, because nothing serializes the requests of one
/// conversation and a call whose output has not been written yet may belong to a turn still
/// streaming in another request.
///
/// Which calls to answer is decided again under the conversation lock, in one transaction with the
/// inserts: two sweeps racing would otherwise both answer the same call, and a `tool_call_id`
/// carrying two outputs is replayed as two and rejected by the provider for the rest of the
/// conversation.
///
/// The read before that only decides whether there is anything to repair, and must stay unlocked.
/// A request that already holds this conversation's row locked on another pooled connection would
/// otherwise block here forever on a sweep that had nothing to write.
///
/// `output_text` is what an answered call reports to the LLM. Returns the calls left unanswered,
/// which a caller that goes on to work on one of them can use instead of reading them again.
pub async fn answer_hanging_tool_call_messages_for_conversation(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    scope: UnansweredToolCallScope<'_>,
    output_text: &str,
) -> ModelResult<Vec<ChatbotConversationMessageToolCall>> {
    let needs_answering = |tool_call: &ChatbotConversationMessageToolCall| {
        !tool_call.tool_kind.is_answered_by_client()
            && match scope {
                UnansweredToolCallScope::OwnTurn(response_ids) => {
                    response_ids.contains(&tool_call.response_id)
                }
                UnansweredToolCallScope::AnyTurnOlderThan(cutoff) => tool_call.created_at < cutoff,
            }
    };

    let unanswered =
        chatbot_conversation_message_tool_calls::get_unanswered_tool_calls_for_conversation(
            conn,
            conversation_id,
        )
        .await?;
    if !unanswered.iter().any(&needs_answering) {
        return Ok(unanswered);
    }

    let mut tx = conn.begin().await?;
    lock_conversation_for_order_number_allocation(&mut tx, conversation_id).await?;
    let res = answer_unanswered_tool_calls(&mut tx, conversation_id, output_text, needs_answering)
        .await?;
    tx.commit().await?;
    Ok(res)
}

/// Answers with `output_text` every unanswered tool call of the conversation that `needs_answering`
/// accepts, and returns the ones it left alone.
///
/// Must be called with the conversation lock held: which calls are unanswered is read here and the
/// outputs are written against that read, and a call that ends up with two outputs is replayed as
/// two and rejected by the provider for the rest of the conversation.
async fn answer_unanswered_tool_calls(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    output_text: &str,
    needs_answering: impl Fn(&ChatbotConversationMessageToolCall) -> bool,
) -> ModelResult<Vec<ChatbotConversationMessageToolCall>> {
    let unanswered =
        chatbot_conversation_message_tool_calls::get_unanswered_tool_calls_for_conversation(
            conn,
            conversation_id,
        )
        .await?;

    let (to_answer, left_alone): (Vec<_>, Vec<_>) =
        unanswered.into_iter().partition(&needs_answering);
    for tool_call in to_answer {
        insert_locked(
            conn,
            tool_call_output_message(conversation_id, tool_call, output_text.to_string(), None),
        )
        .await?;
    }
    Ok(left_alone)
}

/// Ends the wait of every still unanswered
/// [`ClientTool`](chatbot_conversation_message_tool_calls::ToolKind::ClientTool) call of the
/// conversation by answering it with `output_text`, so a suspended turn cannot outlive the message
/// that replaced it.
///
/// Must be called inside the transaction that inserts the new user message: it takes the
/// conversation lock and the caller's transaction holds it to the end, which is what makes the
/// abort and the new message one decision against a concurrent [answer_client_tool_call]. Called
/// on its own the lock is released immediately and a resume can slip in between.
pub async fn abort_pending_client_tool_calls(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    output_text: &str,
) -> ModelResult<()> {
    lock_conversation_for_order_number_allocation(conn, conversation_id).await?;
    answer_unanswered_tool_calls(conn, conversation_id, output_text, |tool_call| {
        tool_call.tool_kind.is_answered_by_client()
    })
    .await?;
    Ok(())
}

/// Whether the conversation's newest turn is suspended: waiting for the client to answer a
/// [`ClientTool`](chatbot_conversation_message_tool_calls::ToolKind::ClientTool) call it made.
///
/// Such a turn has not ended, it continues in the request that brings the answer, without the
/// learner writing anything. See [waiting_client_tool_call_ids] for which calls those are.
pub fn turn_is_suspended(messages: &[ChatbotConversationMessage]) -> bool {
    !waiting_client_tool_call_ids(messages).is_empty()
}

/// The `tool_call_id`s of the conversation's client tool calls that no output answers, in message
/// order: what a suspended turn is waiting for the client to answer.
///
/// `messages` are a conversation's messages in order, as [get_by_conversation_id] returns them; a
/// call is answered by a tool output carrying its `tool_call_id`, which is also how aborting one is
/// recorded.
pub fn waiting_client_tool_call_ids(messages: &[ChatbotConversationMessage]) -> Vec<&str> {
    let answered: HashSet<&str> = messages
        .iter()
        .filter_map(|message| match &message.message {
            Message::ToolOutput(output) => Some(output.tool_call_id.as_str()),
            _ => None,
        })
        .collect();

    messages
        .iter()
        .filter_map(|message| match &message.message {
            Message::ToolCall(call)
                if call.tool_kind.is_answered_by_client()
                    && !answered.contains(call.tool_call_id.as_str()) =>
            {
                Some(call.tool_call_id.as_str())
            }
            _ => None,
        })
        .collect()
}

/// What answering a client tool call left the suspended turn in.
#[derive(Debug, Clone, PartialEq)]
pub struct ClientToolAnswerOutcome {
    pub answer: ChatbotConversationMessage,
    /// Whether this was the last answer the turn was waiting for, and so the one answerer of a
    /// round of parallel calls that may resume it.
    pub turn_can_resume: bool,
}

/// Records the client's answer to a tool call of a suspended turn and reports whether the turn
/// may now resume. `output` is the answer in the form the LLM reads; `client_answer` is the
/// payload the client sent, kept for callers that need the answer as data, and None when no client
/// answer was applied.
///
/// Writing the answer and deciding who resumes happen in one transaction that holds the
/// conversation lock, so of two clients answering different calls of the same round at the same
/// time exactly one is told to resume, instead of both or neither. The lock is released by the
/// commit, before any resumed request is made.
///
/// Errors with [ModelErrorType::RecordNotFound] when the conversation has no such call, and with
/// [ModelErrorType::InvalidRequest] when the call is not one a client answers or already has an
/// answer. Those are the client's mistakes and no answer is written.
pub async fn answer_client_tool_call(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    tool_call_id: &str,
    output: String,
    client_answer: Option<serde_json::Value>,
) -> ModelResult<ClientToolAnswerOutcome> {
    let mut tx = conn.begin().await?;
    lock_conversation_for_order_number_allocation(&mut tx, conversation_id).await?;

    let mut unanswered =
        chatbot_conversation_message_tool_calls::get_unanswered_tool_calls_for_conversation(
            &mut tx,
            conversation_id,
        )
        .await?;

    // The unanswered calls already carry the row; the single-row query is only needed on a miss, to
    // tell a call the conversation does not have from one that already has an answer.
    let (tool_call, is_unanswered) = match unanswered
        .iter()
        .position(|call| call.tool_call_id == tool_call_id)
    {
        Some(index) => (unanswered.swap_remove(index), true),
        None => {
            match chatbot_conversation_message_tool_calls::get_by_conversation_and_tool_call_id(
                &mut tx,
                conversation_id,
                tool_call_id,
            )
            .await?
            {
                Some(call) => (call, false),
                None => {
                    tx.rollback().await?;
                    return Err(model_err!(
                        RecordNotFound,
                        format!(
                            "Chatbot conversation {conversation_id} has no tool call {tool_call_id}"
                        )
                    ));
                }
            }
        }
    };

    if !tool_call.tool_kind.is_answered_by_client() {
        tx.rollback().await?;
        return Err(model_err!(
            InvalidRequest,
            format!("Tool call {tool_call_id} is not answered by the client")
        ));
    }
    if !is_unanswered {
        tx.rollback().await?;
        return Err(model_err!(
            InvalidRequest,
            format!("Tool call {tool_call_id} has already been answered")
        ));
    }

    // A round's parallel calls share the id of the response that made them, and only those hold
    // this turn: an unanswered call of some other turn, alive or dead, must not suppress the
    // resume.
    let turn_can_resume = !unanswered.iter().any(|call| {
        call.tool_kind.is_answered_by_client() && call.response_id == tool_call.response_id
    });

    let answer = insert_locked(
        &mut tx,
        tool_call_output_message(conversation_id, tool_call, output, client_answer),
    )
    .await?;

    tx.commit().await?;
    Ok(ClientToolAnswerOutcome {
        answer,
        turn_can_resume,
    })
}

/// The output message that answers `tool_call`, inheriting the kind and the response id of the
/// call. An output we author has no Azure response of its own, and inventing an id would collide
/// with the citation re-pointing that matches on `response_id`.
fn tool_call_output_message(
    conversation_id: Uuid,
    tool_call: ChatbotConversationMessageToolCall,
    output: String,
    client_answer: Option<serde_json::Value>,
) -> ChatbotConversationMessage {
    ChatbotConversationMessage {
        conversation_id,
        message: Message::ToolOutput(ChatbotConversationMessageToolOutput {
            output,
            client_answer,
            tool_call_id: tool_call.tool_call_id,
            tool_kind: tool_call.tool_kind,
            response_id: tool_call.response_id,
            ..Default::default()
        }),
        ..Default::default()
    }
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
  AND deleted_at IS NULL
RETURNING *
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;

    // update the parent
    let child = chatbot_conversation_message_messages::update(
        &mut tx,
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

/// The inner message of the given [ChatbotConversationMessage].
pub async fn get_message_fields(conn: &mut PgConnection, message_id: Uuid) -> ModelResult<Message> {
    get_inner_messages(conn, &[message_id], ReasoningPayload::Include)
        .await?
        .remove(&message_id)
        .ok_or_else(missing_inner_message_error())
}

/// The inner message of each of `message_ids`, keyed by the id of the message carrying it.
///
/// One query per message kind instead of per message, so reading a conversation costs the same
/// four round trips however many messages it has. A message with no inner message is absent from
/// the map.
async fn get_inner_messages(
    conn: &mut PgConnection,
    message_ids: &[Uuid],
    reasoning_payload: ReasoningPayload,
) -> ModelResult<HashMap<Uuid, Message>> {
    let mut res = HashMap::with_capacity(message_ids.len());
    if message_ids.is_empty() {
        return Ok(res);
    }

    for text in get_text_messages(&mut *conn, message_ids).await? {
        res.entry(text.chatbot_conversation_message_id)
            .or_insert(Message::Text(text));
    }
    for tool_call in get_tool_calls(&mut *conn, message_ids).await? {
        res.entry(tool_call.chatbot_conversation_message_id)
            .or_insert(Message::ToolCall(tool_call));
    }
    for tool_output in get_tool_outputs(&mut *conn, message_ids).await? {
        res.entry(tool_output.chatbot_conversation_message_id)
            .or_insert(Message::ToolOutput(tool_output));
    }
    for reasoning in get_reasonings(&mut *conn, message_ids, reasoning_payload).await? {
        res.entry(reasoning.chatbot_conversation_message_id)
            .or_insert(Message::Reasoning(reasoning));
    }
    Ok(res)
}

fn missing_inner_message_error() -> impl FnOnce() -> ModelError {
    missing_model_error(
        ModelErrorType::RecordNotFound,
        "No inner message found for this ChatbotConversationMessage",
    )
}

async fn get_text_messages(
    conn: &mut PgConnection,
    message_ids: &[Uuid],
) -> ModelResult<Vec<ChatbotConversationMessageMessage>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageMessage,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    chatbot_conversation_message_id,
    text,
    message_role as "message_role: MessageRole",
    message_is_complete,
    used_tokens,
    response_id
FROM chatbot_conversation_message_messages
WHERE chatbot_conversation_message_id = ANY($1)
  AND deleted_at IS NULL
        "#,
        message_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

async fn get_tool_calls(
    conn: &mut PgConnection,
    message_ids: &[Uuid],
) -> ModelResult<Vec<ChatbotConversationMessageToolCall>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolCall,
        r#"
SELECT *
FROM chatbot_conversation_message_tool_calls
WHERE chatbot_conversation_message_id = ANY($1)
  AND deleted_at IS NULL
        "#,
        message_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

async fn get_tool_outputs(
    conn: &mut PgConnection,
    message_ids: &[Uuid],
) -> ModelResult<Vec<ChatbotConversationMessageToolOutput>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageToolOutput,
        r#"
SELECT *
FROM chatbot_conversation_message_tool_outputs
WHERE chatbot_conversation_message_id = ANY($1)
  AND deleted_at IS NULL
        "#,
        message_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

async fn get_reasonings(
    conn: &mut PgConnection,
    message_ids: &[Uuid],
    reasoning_payload: ReasoningPayload,
) -> ModelResult<Vec<ChatbotConversationMessageReasoning>> {
    let res = match reasoning_payload {
        ReasoningPayload::Include => {
            sqlx::query_as!(
                ChatbotConversationMessageReasoning,
                r#"
SELECT *
FROM chatbot_conversation_message_reasoning
WHERE chatbot_conversation_message_id = ANY($1)
  AND deleted_at IS NULL
                "#,
                message_ids
            )
            .fetch_all(conn)
            .await?
        }
        ReasoningPayload::Omit => {
            sqlx::query_as!(
                ChatbotConversationMessageReasoning,
                r#"
SELECT id,
  chatbot_conversation_message_id,
  created_at,
  updated_at,
  deleted_at,
  summary,
  reasoning_id,
  response_id,
  NULL::TEXT AS encrypted_content
FROM chatbot_conversation_message_reasoning
WHERE chatbot_conversation_message_id = ANY($1)
  AND deleted_at IS NULL
                "#,
                message_ids
            )
            .fetch_all(conn)
            .await?
        }
    };
    Ok(res)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        chatbot_conversation_message_messages::MessageRole,
        chatbot_conversation_message_tool_calls::ToolKind, chatbot_conversations, test_helper::*,
    };

    /// The response id every message of these tests is generated under, so that a message and the
    /// output answering it agree on one.
    const RESPONSE_ID: &str = "resp_test";

    /// The responses of a turn whose rounds all got [`RESPONSE_ID`].
    fn own_turn_response_ids() -> Vec<String> {
        vec![RESPONSE_ID.to_string()]
    }

    fn user_message(conversation_id: Uuid, text: &str) -> ChatbotConversationMessage {
        chatbot_text_message(conversation_id, MessageRole::User, text, None)
    }

    fn developer_message(conversation_id: Uuid, text: &str) -> ChatbotConversationMessage {
        chatbot_text_message(
            conversation_id,
            MessageRole::Developer,
            text,
            Some("page-context"),
        )
    }

    fn tool_call_message(
        conversation_id: Uuid,
        tool_call_id: &str,
        tool_kind: ToolKind,
    ) -> ChatbotConversationMessage {
        chatbot_tool_call_message(conversation_id, tool_call_id, tool_kind, RESPONSE_ID)
    }

    /// The conversation as one line per message, for asserting on both content and order.
    fn message_summary(messages: &[ChatbotConversationMessage]) -> Vec<String> {
        messages
            .iter()
            .map(|message| match &message.message {
                Message::ToolCall(call) => format!("call {}", call.tool_call_id),
                Message::ToolOutput(output) => format!("output {}", output.tool_call_id),
                Message::Text(text) => format!("text {}", text.text),
                Message::Reasoning(..) => "reasoning".to_string(),
            })
            .collect()
    }

    #[tokio::test]
    async fn numbers_messages_in_insertion_order() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;

        let first = insert(tx.as_mut(), user_message(conversation, "first"))
            .await
            .unwrap();
        let second = insert(tx.as_mut(), user_message(conversation, "second"))
            .await
            .unwrap();

        assert_eq!((first.order_number, second.order_number), (1, 2));
    }

    #[tokio::test]
    async fn refuses_to_add_a_message_to_a_deleted_conversation() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        crate::chatbot_conversations::delete(tx.as_mut(), conversation)
            .await
            .unwrap();

        let error = insert(tx.as_mut(), user_message(conversation, "hello"))
            .await
            .expect_err("adding a message to a deleted conversation must fail");

        assert!(matches!(error.error_type(), ModelErrorType::RecordNotFound));
    }

    /// A tool call left unanswered by a dead turn makes the LLM reject every later message of the
    /// conversation, so the sweep at the head of the next turn has to complete it.
    #[tokio::test]
    async fn answers_a_hanging_tool_call_before_the_next_message() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_1", ToolKind::Function),
        )
        .await
        .unwrap();

        answer_hanging_tool_call_messages_for_conversation(
            tx.as_mut(),
            conversation,
            UnansweredToolCallScope::OwnTurn(&own_turn_response_ids()),
            "aborted",
        )
        .await
        .unwrap();
        insert(tx.as_mut(), user_message(conversation, "hello again"))
            .await
            .unwrap();

        let hanging =
            chatbot_conversation_message_tool_calls::get_unanswered_tool_calls_for_conversation(
                tx.as_mut(),
                conversation,
            )
            .await
            .unwrap();
        assert!(hanging.is_empty());

        let messages = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert_eq!(
            message_summary(&messages),
            vec!["call call_1", "output call_1", "text hello again"]
        );
    }

    /// What a repeat of the page context is compared against: the newest developer message, not
    /// the newest message, so that staying on a page adds no further context however many turns
    /// the conversation has. Scoped to the conversation, since a shared page has one context text
    /// across every learner reading it.
    #[tokio::test]
    async fn the_latest_developer_message_is_the_newest_one_of_that_conversation() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;

        assert_eq!(
            get_latest_developer_message_text(tx.as_mut(), conversation)
                .await
                .unwrap(),
            None
        );

        for message in [
            developer_message(conversation, "reading page one"),
            user_message(conversation, "what is this"),
            developer_message(conversation, "reading page two"),
            user_message(conversation, "and this"),
        ] {
            insert(tx.as_mut(), message).await.unwrap();
        }

        assert_eq!(
            get_latest_developer_message_text(tx.as_mut(), conversation)
                .await
                .unwrap()
                .as_deref(),
            Some("reading page two")
        );

        let (_other_configuration, other_conversation) =
            insert_chatbot_conversation(tx.as_mut()).await;
        insert(
            tx.as_mut(),
            developer_message(other_conversation, "reading somewhere else"),
        )
        .await
        .unwrap();
        assert_eq!(
            get_latest_developer_message_text(tx.as_mut(), conversation)
                .await
                .unwrap()
                .as_deref(),
            Some("reading page two")
        );
    }

    /// Nothing serializes two requests for one conversation, so a sweep running at the head of one
    /// request must not abort the call of a turn still streaming in another. A cutoff is what
    /// separates the two, since a live turn's call was written moments ago.
    #[tokio::test]
    async fn the_sweep_leaves_a_call_newer_than_the_cutoff_to_the_turn_that_made_it() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_in_flight", ToolKind::Function),
        )
        .await
        .unwrap();

        let cutoff = Utc::now() - chrono::Duration::minutes(10);
        answer_hanging_tool_call_messages_for_conversation(
            tx.as_mut(),
            conversation,
            UnansweredToolCallScope::AnyTurnOlderThan(cutoff),
            "aborted",
        )
        .await
        .unwrap();

        let messages = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert_eq!(message_summary(&messages), vec!["call call_in_flight"]);

        // Past the cutoff the same call is fair game, which is what unsticks a conversation whose
        // turn really did die.
        answer_hanging_tool_call_messages_for_conversation(
            tx.as_mut(),
            conversation,
            UnansweredToolCallScope::AnyTurnOlderThan(Utc::now() + chrono::Duration::minutes(10)),
            "aborted",
        )
        .await
        .unwrap();

        let messages = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert_eq!(
            message_summary(&messages),
            vec!["call call_in_flight", "output call_in_flight"]
        );
    }

    /// A client tool call with no output is a suspended turn waiting for an answer, not a dead one,
    /// and looks exactly like an abandoned call to the sweep unless the sweep reads its kind.
    #[tokio::test]
    async fn the_sweep_repairs_an_abandoned_call_and_leaves_a_waiting_one_alone() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_abandoned", ToolKind::Function),
        )
        .await
        .unwrap();
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_waiting", ToolKind::ClientTool),
        )
        .await
        .unwrap();

        answer_hanging_tool_call_messages_for_conversation(
            tx.as_mut(),
            conversation,
            UnansweredToolCallScope::OwnTurn(&own_turn_response_ids()),
            "aborted",
        )
        .await
        .unwrap();

        let messages = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert_eq!(
            waiting_client_tool_call_ids(&messages),
            vec!["call_waiting"]
        );
        assert_eq!(
            message_summary(&messages),
            vec![
                "call call_abandoned",
                "call call_waiting",
                "output call_abandoned"
            ]
        );
    }

    /// The learner sending a new message instead of answering ends the wait, and the aborted call
    /// still has to end up with an output so the history stays valid.
    #[tokio::test]
    async fn a_new_message_aborts_a_pending_client_tool_call() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_1", ToolKind::ClientTool),
        )
        .await
        .unwrap();

        abort_pending_client_tool_calls(tx.as_mut(), conversation, "the user moved on")
            .await
            .unwrap();
        insert(tx.as_mut(), user_message(conversation, "never mind"))
            .await
            .unwrap();

        let messages = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert!(waiting_client_tool_call_ids(&messages).is_empty());
        assert_eq!(
            message_summary(&messages),
            vec!["call call_1", "output call_1", "text never mind"]
        );
        let Some(Message::ToolOutput(output)) =
            messages.get(1).map(|message| &message.message).cloned()
        else {
            panic!("the aborted call is answered by a tool output");
        };
        assert_eq!(output.tool_kind, ToolKind::ClientTool);
        assert_eq!(output.response_id, RESPONSE_ID);
        assert_eq!(output.output, "the user moved on");
    }

    /// Only one answerer of a round of parallel calls may resume the turn, and it has to be the one
    /// that completes the round.
    #[tokio::test]
    async fn only_the_last_answer_of_a_round_resumes_the_turn() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        for tool_call_id in ["call_1", "call_2"] {
            insert(
                tx.as_mut(),
                tool_call_message(conversation, tool_call_id, ToolKind::ClientTool),
            )
            .await
            .unwrap();
        }

        let client_answer = serde_json::json!({ "choice_index": 1 });
        let first = answer_client_tool_call(
            tx.as_mut(),
            conversation,
            "call_1",
            "first".to_string(),
            Some(client_answer.clone()),
        )
        .await
        .unwrap();
        let second = answer_client_tool_call(
            tx.as_mut(),
            conversation,
            "call_2",
            "second".to_string(),
            None,
        )
        .await
        .unwrap();

        assert!(!first.turn_can_resume);
        assert!(second.turn_can_resume);
        let Message::ToolOutput(output) = first.answer.message else {
            panic!("an answer is a tool output");
        };
        assert_eq!(output.response_id, RESPONSE_ID);
        assert_eq!(output.tool_kind, ToolKind::ClientTool);

        let messages = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        let Some(Message::ToolOutput(stored)) =
            messages.get(2).map(|message| &message.message).cloned()
        else {
            panic!("the first answer is a tool output");
        };
        assert_eq!(stored.client_answer, Some(client_answer));
    }

    /// An answer the conversation has no room for must be refused cleanly, and must not leave a
    /// second output behind for a call that already has one.
    #[tokio::test]
    async fn refuses_answers_the_conversation_has_no_room_for() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        let (_other_configuration, other_conversation) =
            insert_chatbot_conversation(tx.as_mut()).await;
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_client", ToolKind::ClientTool),
        )
        .await
        .unwrap();
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_function", ToolKind::Function),
        )
        .await
        .unwrap();
        insert(
            tx.as_mut(),
            tool_call_message(other_conversation, "call_elsewhere", ToolKind::ClientTool),
        )
        .await
        .unwrap();
        answer_client_tool_call(
            tx.as_mut(),
            conversation,
            "call_client",
            "done".to_string(),
            None,
        )
        .await
        .unwrap();

        for (tool_call_id, expected) in [
            ("call_unknown", ModelErrorType::RecordNotFound),
            ("call_elsewhere", ModelErrorType::RecordNotFound),
            ("call_function", ModelErrorType::InvalidRequest),
            ("call_client", ModelErrorType::InvalidRequest),
        ] {
            let error = answer_client_tool_call(
                tx.as_mut(),
                conversation,
                tool_call_id,
                "again".to_string(),
                None,
            )
            .await
            .expect_err("the answer must be refused");
            assert_eq!(
                std::mem::discriminant(error.error_type()),
                std::mem::discriminant(&expected),
                "answering {tool_call_id}: {error:?}"
            );
        }

        let messages = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert_eq!(
            message_summary(&messages),
            vec![
                "call call_client",
                "call call_function",
                "output call_client"
            ]
        );
    }

    /// A learner who reloads while a call is waiting has to be able to answer it still, and the
    /// conversation info is everything the chatbot ui gets to work that out from.
    #[tokio::test]
    async fn a_waiting_client_tool_call_is_discoverable_from_the_conversation_info() {
        insert_data!(:tx);
        let (configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_1", ToolKind::ClientTool),
        )
        .await
        .unwrap();
        let anonymous_token = chatbot_conversations::get_by_id(tx.as_mut(), conversation)
            .await
            .unwrap()
            .anonymous_token;

        let info = chatbot_conversations::get_current_conversation_info(
            tx.as_mut(),
            None,
            anonymous_token,
            configuration,
        )
        .await
        .unwrap();

        let messages = info
            .current_conversation_messages
            .expect("the conversation has messages");
        assert_eq!(waiting_client_tool_call_ids(&messages), vec!["call_1"]);
        let Some(Message::ToolCall(call)) = messages.first().map(|message| &message.message) else {
            panic!("the waiting call is in the conversation");
        };
        assert_eq!(call.tool_kind, ToolKind::ClientTool);
    }

    /// Suggesting what to ask next is generated from the conversation's last message and costs an
    /// LLM call, so a suspended turn must not offer any: its last message is the question the
    /// chatbot is waiting for an answer to.
    #[tokio::test]
    async fn no_suggestions_are_offered_while_a_turn_is_suspended() {
        insert_data!(:tx);
        let (configuration, conversation) =
            insert_chatbot_conversation_suggesting_messages(tx.as_mut(), true).await;
        let anonymous_token = chatbot_conversations::get_by_id(tx.as_mut(), conversation)
            .await
            .unwrap()
            .anonymous_token;
        insert(tx.as_mut(), user_message(conversation, "which loop"))
            .await
            .unwrap();
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_1", ToolKind::ClientTool),
        )
        .await
        .unwrap();

        let while_suspended = chatbot_conversations::get_current_conversation_info(
            tx.as_mut(),
            None,
            anonymous_token.clone(),
            configuration,
        )
        .await
        .unwrap();

        assert!(while_suspended.suggested_messages.is_none());

        answer_client_tool_call(
            tx.as_mut(),
            conversation,
            "call_1",
            "for loops".to_string(),
            None,
        )
        .await
        .unwrap();
        let after_the_answer = chatbot_conversations::get_current_conversation_info(
            tx.as_mut(),
            None,
            anonymous_token,
            configuration,
        )
        .await
        .unwrap();

        assert_eq!(
            after_the_answer
                .suggested_messages
                .map(|suggestions| suggestions.len()),
            Some(0)
        );
    }

    /// What a suspended turn looks like to everything that reads the conversation instead of
    /// running it: a client tool call that no output answers.
    #[tokio::test]
    async fn turn_is_suspended_only_while_a_client_tool_call_waits() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        insert(tx.as_mut(), user_message(conversation, "which loop"))
            .await
            .unwrap();
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_function", ToolKind::Function),
        )
        .await
        .unwrap();

        let with_a_function_call = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert!(!turn_is_suspended(&with_a_function_call));

        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_client", ToolKind::ClientTool),
        )
        .await
        .unwrap();
        let with_a_waiting_question = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert!(turn_is_suspended(&with_a_waiting_question));

        answer_client_tool_call(
            tx.as_mut(),
            conversation,
            "call_client",
            "for loops".to_string(),
            None,
        )
        .await
        .unwrap();
        let answered = get_by_conversation_id(tx.as_mut(), conversation)
            .await
            .unwrap();
        assert!(!turn_is_suspended(&answered));
    }

    /// `tool_call_id` comes from the provider and can repeat across conversations, so an output
    /// with the same id elsewhere must not make a call look answered.
    #[tokio::test]
    async fn a_tool_output_of_another_conversation_does_not_answer_a_tool_call() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        let (_other_configuration, other_conversation) =
            insert_chatbot_conversation(tx.as_mut()).await;
        insert(
            tx.as_mut(),
            tool_call_message(conversation, "call_1", ToolKind::Function),
        )
        .await
        .unwrap();
        insert(
            tx.as_mut(),
            tool_call_message(other_conversation, "call_1", ToolKind::Function),
        )
        .await
        .unwrap();

        answer_hanging_tool_call_messages_for_conversation(
            tx.as_mut(),
            other_conversation,
            UnansweredToolCallScope::OwnTurn(&own_turn_response_ids()),
            "aborted",
        )
        .await
        .unwrap();

        let hanging =
            chatbot_conversation_message_tool_calls::get_unanswered_tool_calls_for_conversation(
                tx.as_mut(),
                conversation,
            )
            .await
            .unwrap();
        assert_eq!(hanging.len(), 1);
        assert_eq!(hanging[0].tool_call_id, "call_1");
    }
}
