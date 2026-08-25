//! One tool-call round: running the calls the server answers, storing each beside its output, and
//! handing the round's items on to the next request.

use std::ops::DerefMut;

use futures::StreamExt;
use futures::stream::BoxStream;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_conversation_messages::{self, ChatbotConversationMessage};
use headless_lms_models::chatbot_conversation_messages_citations::{
    self, ChatbotConversationMessageCitation,
};
use tracing::trace;
use url::Url;

use crate::azure_chatbot::azure::protocol::{
    AISearchOutput, OutputItem, ReceivedOutputItem, ResponseOutput, check_response_complete,
    check_response_output,
};
use crate::azure_chatbot::azure::sse::{AzureStreamEvent, ParsedResponseLine};
use crate::azure_chatbot::azure::transport::ResponseLinesStream;
use crate::azure_chatbot::client_tool_calls::abort::permission_revoked_output;
use crate::azure_chatbot::events::{StreamItem, TurnEvent};
use crate::azure_chatbot::request::replayable_input_message;
use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::{
    ChatbotToolCallResult, call_chatbot_tool, check_client_tool_arguments, client_tool_permission,
};
use crate::citations::chatbot_cited_documents_to_citations;
use crate::llm_utils::{APIInputMessage, APIOutputMessage, MessageContent};
use crate::prelude::*;
use crate::user_context::ChatbotUserContext;

/// How a round item that isn't a text `Message` or `FunctionCall` gets persisted, decided without
/// a database connection or Azure configuration: a plain insert, or an insert followed by
/// resolving the search result's cited documents.
enum StoragePlan {
    Insert(ChatbotConversationMessage),
    InsertAndCite {
        message: ChatbotConversationMessage,
        document_urls: Vec<Url>,
        response_id: String,
    },
}

/// Routes an output item to how it should be persisted, or rejects it.
///
/// `Message`, `FunctionCall` and `FunctionCallOutput` are each handled by their caller before a
/// call would reach here (a text `Message` is streamed, a refusal `Message` is inserted here, a
/// `FunctionCall` is recorded by the round that receives it, and a `FunctionCallOutput` never
/// arrives from Azure at all) — the error arms below are the guard against a caller passing one in
/// anyway, on an unexpected wire shape, not a normal path.
fn storage_plan(item: OutputItem, conversation_id: Uuid) -> ChatbotResult<StoragePlan> {
    match item {
        OutputItem::AzureAiSearchCall { .. } | OutputItem::Reasoning { .. } => {
            let message = APIOutputMessage { message_type: item }
                .to_chatbot_conversation_message(conversation_id)?;
            Ok(StoragePlan::Insert(message))
        }
        OutputItem::AzureAiSearchCallOutput {
            call_id,
            output,
            response_id,
        } => {
            // A search that failed or found nothing reports itself in the output text, which is
            // stored and replayed to the model either way. Only its citations are lost.
            let document_urls = match serde_json::from_str::<AISearchOutput>(&output) {
                Ok(search_output) => search_output.get_urls,
                Err(error) => {
                    warn!("Storing an Azure AI Search output that carries no citations: {error}");
                    Vec::new()
                }
            };
            let message = APIOutputMessage {
                message_type: OutputItem::AzureAiSearchCallOutput {
                    call_id,
                    output,
                    response_id: response_id.clone(),
                },
            }
            .to_chatbot_conversation_message(conversation_id)?;
            if document_urls.is_empty() {
                return Ok(StoragePlan::Insert(message));
            }
            Ok(StoragePlan::InsertAndCite {
                message,
                document_urls,
                response_id,
            })
        }
        OutputItem::Message {
            content: content @ MessageContent::Refusal(..),
            response_id,
            role,
        } => {
            let message = APIOutputMessage {
                message_type: OutputItem::Message {
                    content,
                    response_id,
                    role,
                },
            }
            .to_chatbot_conversation_message(conversation_id)?;
            Ok(StoragePlan::Insert(message))
        }
        OutputItem::Message { .. } => Err(chatbot_err!(
            UnexpectedProtocolShape,
            "Unexpected message output item, it should have been streamed.".to_string()
        )),
        OutputItem::FunctionCall { .. } => Err(chatbot_err!(
            UnexpectedProtocolShape,
            "Unexpected function call output item, it should have been processed.".to_string()
        )),
        OutputItem::FunctionCallOutput { .. } => Err(chatbot_err!(
            StreamInvariantViolation,
            "Unexpected function call output item, this shouldn't happen.".to_string()
        )),
    }
}

/// Inserts an Azure AI Search output item, then best-effort resolves its cited documents.
///
/// A citation lookup failure is logged and swallowed rather than propagated: the search-output
/// item is already stored correctly by the time citations run, and a citation is an annotation on
/// it, not something worth ending the round over.
async fn store_search_output_with_citations(
    conn: &mut PgConnection,
    message: ChatbotConversationMessage,
    document_urls: Vec<Url>,
    response_id: &str,
    conversation_id: Uuid,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<ChatbotConversationMessage> {
    let api_key = if let Some(azure_config) = &app_config.azure_configuration
        && let Some(search_config) = &azure_config.search_config
    {
        &search_config.search_api_key
    } else {
        return Err(chatbot_err!(
            Other,
            "Azure search configuration not found, cannot process Azure AI search output item."
                .to_string()
        ));
    };

    let conversation_message = chatbot_conversation_messages::insert(conn, message).await?;

    let res = chatbot_cited_documents_to_citations(
        conn,
        app_config.test_chatbot,
        document_urls,
        api_key,
        conversation_message.id,
        conversation_id,
    )
    .await;

    if let Err(e) = res {
        error!("Failed to save cited documents in the DB. Response id: {response_id} Error: {e}");
    };

    Ok(conversation_message)
}

/// Persists a round item that isn't a text `Message` or `FunctionCall`: `Reasoning` and
/// `AzureAiSearchCall` insert as-is, a refusal `Message` inserts as-is, and an
/// `AzureAiSearchCallOutput` additionally resolves its cited documents (see
/// [`store_search_output_with_citations`] for why that half alone swallows its errors). Errors on
/// a text `Message`, `FunctionCall` or `FunctionCallOutput` — see [`storage_plan`].
pub(super) async fn store_output_item(
    conn: &mut PgConnection,
    item: OutputItem,
    conversation_id: Uuid,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<ChatbotConversationMessage> {
    match storage_plan(item, conversation_id)? {
        StoragePlan::Insert(message) => {
            Ok(chatbot_conversation_messages::insert(conn, message).await?)
        }
        StoragePlan::InsertAndCite {
            message,
            document_urls,
            response_id,
        } => {
            store_search_output_with_citations(
                conn,
                message,
                document_urls,
                &response_id,
                conversation_id,
                app_config,
            )
            .await
        }
    }
}

/// Whether the round that produced `item` stores it itself, so that whoever else sees the item
/// must not store it as well.
///
/// Exhaustive on purpose: an item kind that later needs round-owned storage has to be answered
/// here rather than fall through a `matches!` somewhere and end up stored twice.
pub(super) fn is_stored_by_round(item: &OutputItem) -> bool {
    match item {
        OutputItem::FunctionCall { .. } | OutputItem::FunctionCallOutput { .. } => true,
        OutputItem::Message { .. }
        | OutputItem::Reasoning { .. }
        | OutputItem::AzureAiSearchCall { .. }
        | OutputItem::AzureAiSearchCallOutput { .. } => false,
    }
}

/// One item of a tool-call round, held until the round is known complete so it can be stored in
/// its original stream order.
///
/// A round's function calls are only run, and inserted, once every item has streamed in; a
/// `Passthrough` item stored as soon as it streams would then land ahead of all of them instead of
/// next to the call it belongs beside. See [`TurnEvent::ItemAnnounced`].
enum PendingRoundItem {
    FunctionCall {
        tool_name: String,
        call_id: String,
        arguments: String,
    },
    Passthrough(OutputItem),
}

/// What one tool-call round accumulates while it streams: the items it acts on once Azure has sent
/// them all, the input the next round is sent, and whether the turn ends suspended instead of
/// asking again.
struct ToolRound {
    pending_items: Vec<PendingRoundItem>,
    next_round_input: Vec<APIInputMessage>,
    /// The response every item of this round belongs to.
    response_id: String,
    suspended: bool,
}

impl ToolRound {
    fn new(response_id: String) -> Self {
        Self {
            pending_items: Vec::new(),
            next_round_input: Vec::new(),
            response_id,
            suspended: false,
        }
    }

    /// Queues an item for the finalize pass.
    ///
    /// Only an item Azure has sent whole may be queued: it sends each one twice, and the earlier
    /// copy has neither a call's arguments nor a reasoning item's payload, both of which the next
    /// request has to carry. Errors on the item kinds the round handles before it reaches here: a
    /// `Message` is either streamed or, as a refusal, stored as it arrives, and a
    /// `FunctionCallOutput` never arrives from Azure at all.
    fn queue(&mut self, item: OutputItem) -> ChatbotResult<()> {
        let pending = match item {
            OutputItem::FunctionCall {
                tool_name,
                call_id,
                arguments,
                ..
            } => PendingRoundItem::FunctionCall {
                tool_name,
                call_id,
                arguments,
            },
            OutputItem::Reasoning { .. }
            | OutputItem::AzureAiSearchCall { .. }
            | OutputItem::AzureAiSearchCallOutput { .. } => PendingRoundItem::Passthrough(item),
            OutputItem::Message { .. } | OutputItem::FunctionCallOutput { .. } => {
                return Err(chatbot_err!(
                    UnexpectedProtocolShape,
                    "Unexpected output item queued for the round's finalize pass.".to_string()
                ));
            }
        };
        self.pending_items.push(pending);
        Ok(())
    }

    fn has_function_calls(&self) -> bool {
        self.pending_items
            .iter()
            .any(|item| matches!(item, PendingRoundItem::FunctionCall { .. }))
    }
}

/// What the round does with one call the model made.
enum PlannedToolCall {
    /// Only the client can answer it: record the call without an output and end the turn.
    Suspend,
    /// The server answers it, in this round.
    Run,
    /// A client call the tool would not accept, carrying the output the LLM is given for it.
    Refuse(String),
}

/// Decides who answers a call the model made, before anything about it is stored.
///
/// A client tool's permission and arguments are both checked here, not when an answer arrives:
/// nothing can answer a call the tool would reject or the caller may not make, so it has to fail
/// while the turn can still hand the LLM a failure output. The server tools are checked the same
/// way inside [`call_chatbot_tool`]. Errors on a rejection the turn cannot survive — see
/// [`recover_or_terminate`].
async fn plan_tool_call(
    conn: &mut PgConnection,
    user_context: &ChatbotUserContext,
    tool_name: &str,
    arguments: &str,
) -> ChatbotResult<PlannedToolCall> {
    let Some(permission) = client_tool_permission(tool_name) else {
        return Ok(PlannedToolCall::Run);
    };
    if let Some(output) =
        permission_revoked_output(conn, user_context, permission, tool_name).await?
    {
        return Ok(PlannedToolCall::Refuse(output.to_string()));
    }
    match check_client_tool_arguments(tool_name, arguments) {
        Ok(()) => Ok(PlannedToolCall::Suspend),
        Err(error) => Ok(PlannedToolCall::Refuse(recover_or_terminate(
            error,
            tool_name,
            "A client chatbot tool call was refused before the turn could suspend on it, reporting the failure to the LLM.",
        )?)),
    }
}

/// Stores a finished tool call beside its output, and converts both rows back into the items the
/// next round is sent.
///
/// The two rows go in one transaction: a call stored without its output is exactly the history the
/// unanswered-call sweep exists to repair, and the LLM rejects the conversation until it is.
async fn record_tool_call(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    response_id: &str,
    call_id: &str,
    tool_name: &str,
    result: ChatbotToolCallResult,
) -> ChatbotResult<Vec<APIInputMessage>> {
    let citations = result.citations;
    let tool_call_message = APIOutputMessage {
        message_type: OutputItem::FunctionCall {
            response_id: response_id.to_owned(),
            call_id: call_id.to_owned(),
            tool_name: tool_name.to_owned(),
            arguments: result.arguments,
        },
    };
    let output_message = APIOutputMessage {
        message_type: OutputItem::FunctionCallOutput {
            call_id: call_id.to_owned(),
            output: result.output,
            response_id: response_id.to_owned(),
        },
    };

    let mut tx = conn.begin().await?;
    let stored_call = chatbot_conversation_messages::insert(
        &mut tx,
        tool_call_message.to_chatbot_conversation_message(conversation_id)?,
    )
    .await?;
    let stored_output = chatbot_conversation_messages::insert(
        &mut tx,
        output_message.to_chatbot_conversation_message(conversation_id)?,
    )
    .await?;

    if !citations.is_empty() {
        let (rows, page_ids) = citations
            .into_iter()
            .map(|citation| {
                (
                    ChatbotConversationMessageCitation {
                        conversation_message_id: stored_output.id,
                        conversation_id,
                        title: citation.title,
                        content: citation.snippet,
                        document_url: citation.document_url,
                        citation_number: citation.citation_number,
                        ..Default::default()
                    },
                    Some(citation.page_id),
                )
            })
            .unzip();
        chatbot_conversation_messages_citations::insert_batch(&mut tx, rows, page_ids).await?;
    }

    tx.commit().await?;

    Ok(vec![
        APIInputMessage::try_from(stored_call)?,
        APIInputMessage::try_from(stored_output)?,
    ])
}

/// The item with a reasoning payload left out, for an event that only names the item.
///
/// A reasoning `encrypted_content` is multi-KB base64, and a deferred item is stored by the round
/// that produced it rather than from the event, which nothing downstream reads more than the id of.
fn item_without_reasoning_payload(item: &OutputItem) -> OutputItem {
    match item {
        OutputItem::Reasoning {
            response_id, id, ..
        } => OutputItem::Reasoning {
            response_id: response_id.clone(),
            id: id.clone(),
            summary: Vec::new(),
            encrypted_content: None,
        },
        other => other.clone(),
    }
}

/// Streams and parses one tool-call round of a response from Azure, consuming `lines`.
///
/// Runs the calls the server answers, stores each call beside its output, and ends the round by
/// yielding [`TurnEvent::Messages`] with the items the next round is sent. Those items are
/// converted from the rows this round wrote, not from what it meant to write, so that a round
/// continued in memory and one replayed from the conversation hand Azure the same prefix. A call
/// only the client can answer is stored without an output and ends the turn with
/// [`TurnEvent::Suspended`] instead: the answer arrives in a later request, which rebuilds its
/// input from the conversation.
///
/// `calls_from_classification` are this round's function calls that arrived before the response
/// was classified. They have already been streamed to the client; the round takes them over so
/// that it, and only it, records them.
///
/// Takes `conn` by value rather than by reference so that the caller can hand over the pooled
/// connection it no longer needs, instead of keeping one borrowed for as long as this stream lives.
pub(super) async fn parse_tool<'a, C>(
    mut conn: C,
    app_config: &'a ApplicationConfiguration,
    mut lines: ResponseLinesStream<'a>,
    conversation_id: Uuid,
    response_id: String,
    user_context: &'a ChatbotUserContext,
    calls_from_classification: Vec<OutputItem>,
) -> BoxStream<'a, ChatbotResult<TurnEvent>>
where
    C: DerefMut<Target = PgConnection> + Send + 'a,
{
    let mut round = ToolRound::new(response_id);
    let mut response_received = false;
    let mut response_incomplete = false;
    let mut preceding_event: Option<AzureStreamEvent> = None;

    trace!("Parsing tool calls...");

    Box::pin(async_stream::try_stream! {
    for call in calls_from_classification {
        round.queue(call)?;
    }
    while let Some(val) = lines.next().await {
        let line = val?;
        let response_output: ResponseOutput = match ParsedResponseLine::parse(&line)? {
            Some(ParsedResponseLine::Event(event)) => {
                trace!("Event: {event:?}");
                match &event {
                    AzureStreamEvent::ResponseCompleted => {
                        response_received = true;
                    }
                    AzureStreamEvent::Incomplete => {
                        response_received = true;
                        response_incomplete = true;
                    }
                    AzureStreamEvent::OutputTextDelta => {
                        Err(chatbot_err!(UnexpectedProtocolShape,
                            "Error: Received response text while parsing tool calls. Either the tool call parsing failed or the LLM responded in an unexpected way."
                        ))?
                    }
                    AzureStreamEvent::ErrorReported => {
                        // error is logged in the next iteration
                     }
                    _ => {}
                };
                preceding_event = Some(event);
                continue;
            }
            Some(ParsedResponseLine::Data(data)) => *data,
            None => {
                continue;
            }
        };

        let event = AzureStreamEvent::of_data_line(preceding_event.take(), response_output.response_type.as_deref());

        check_response_output(&response_output, Some(&round.response_id), "streaming_tool_call_round")?;

        if response_received {
            // A round cut short carries calls whose arguments may be truncated, so it must not
            // go on to run them.
            check_response_complete(&response_output, response_incomplete)?;
            if !round.has_function_calls() {
                Err(chatbot_err!(StreamInvariantViolation,
                    "The LLM response was supposed to contain function calls, but no function calls were found"
                ))?
            }
            let response_id = round.response_id.clone();

            for pending_item in std::mem::take(&mut round.pending_items) {
                let (name, id, args) = match pending_item {
                    PendingRoundItem::FunctionCall { tool_name, call_id, arguments } => {
                        (tool_name, call_id, arguments)
                    }
                    // Stored here, in the round's original stream order alongside the function
                    // calls, rather than as soon as it streamed in: see
                    // [`TurnEvent::ItemAnnounced`].
                    PendingRoundItem::Passthrough(item) => {
                        let stored = store_output_item(&mut conn, item, conversation_id, app_config).await?;
                        if let Some(input) = replayable_input_message(stored)? {
                            round.next_round_input.push(input);
                        }
                        continue;
                    }
                };
                let refused_client_call = match plan_tool_call(&mut conn, user_context, &name, &args).await? {
                    PlannedToolCall::Suspend => {
                        // Recorded without an output: the client answers it through the
                        // tool-response endpoint, which resumes the turn from the conversation
                        // as stored, so the call has to be in the conversation before the turn
                        // ends.
                        let tool_call_message = APIOutputMessage {
                            message_type: OutputItem::FunctionCall {
                                response_id: response_id.clone(),
                                call_id: id,
                                tool_name: name,
                                arguments: args,
                            },
                        };
                        chatbot_conversation_messages::insert(
                            &mut conn,
                            tool_call_message.to_chatbot_conversation_message(conversation_id)?,
                        )
                        .await?;
                        round.suspended = true;
                        continue;
                    }
                    PlannedToolCall::Refuse(output) => Some(output),
                    PlannedToolCall::Run => None,
                };

                let tool_result = if let Some(output) = refused_client_call {
                    ChatbotToolCallResult {
                        arguments: args,
                        output,
                        citations: Vec::new(),
                    }
                } else {
                    // The tool runs outside the transaction so a failure cannot leave a
                    // function call without its output. `args` is only borrowed here, so it is
                    // still available below on the error path.
                    let tool_call =
                        call_chatbot_tool(&mut conn, app_config, &name, &args, user_context).await;
                    match tool_call {
                        Ok(result) => result,
                        Err(error) => ChatbotToolCallResult {
                            output: recover_or_terminate(
                                error,
                                &name,
                                "Chatbot tool call failed, reporting the failure to the LLM.",
                            )?,
                            arguments: args,
                            citations: Vec::new(),
                        },
                    }
                };

                let recorded = record_tool_call(
                    &mut conn,
                    conversation_id,
                    &response_id,
                    &id,
                    &name,
                    tool_result,
                )
                .await?;
                round.next_round_input.extend(recorded);

                yield TurnEvent::Item(StreamItem::ServerToolOutput { call_id: id });
            }

            if round.suspended {
                // No further round: the answers the turn is missing arrive in later requests, and
                // the resumed turn rebuilds its input from the conversation rather than from here.
                yield TurnEvent::Suspended;
            } else {
                yield TurnEvent::Messages(std::mem::take(&mut round.next_round_input));
            }
            return;
        } else if let Some(item) = response_output.item.and_then(ReceivedOutputItem::known) {
            let finished = matches!(event, Some(AzureStreamEvent::OutputItemDone));
            match &item {
                OutputItem::FunctionCall { tool_name, call_id, arguments, .. } => {
                    // The first call of a round loses its `added` copy to the stream type
                    // detection, so a round that queued both copies would record every later call
                    // twice, once with no arguments at all.
                    if finished {
                        round.pending_items.push(PendingRoundItem::FunctionCall {
                            tool_name: tool_name.clone(),
                            call_id: call_id.clone(),
                            arguments: arguments.clone(),
                        });
                    }
                    yield TurnEvent::Item(StreamItem::Received { item, finished: false });
                }
                // Azure's `added` copy of a message has no content yet, and an empty content
                // reads as text rather than as the refusal the done copy will carry.
                OutputItem::Message { .. } if !finished => {}
                OutputItem::Message { content, .. } => {
                    if let MessageContent::Refusal(..) = content {
                        // Stored as it arrives, ahead of the round's deferred items, so that its
                        // place in the conversation is the one the next round's input gives it.
                        let stored = store_output_item(&mut conn, item, conversation_id, app_config).await?;
                        let message_id = stored.id;
                        let text = match &stored.message {
                            chatbot_conversation_messages::Message::Text(text_message) => {
                                text_message.text.clone()
                            }
                            other => Err(chatbot_err!(
                                StreamInvariantViolation,
                                format!("A stored refusal message came back as {other:?}.")
                            ))?,
                        };
                        round.next_round_input.push(APIInputMessage::try_from(stored)?);
                        yield TurnEvent::Refusal { text, message_id };
                    } else {
                    Err(chatbot_err!(
                        UnexpectedProtocolShape,
                        "Received a message item while parsing tool calls.".to_string()
                    ))?}
                },
                _ => {
                    // Storage is deferred to the round's finalize pass (see
                    // `PendingRoundItem::Passthrough` above), which is what keeps this item at its
                    // stream position relative to the round's function calls instead of landing
                    // ahead of all of them.
                    if finished {
                        yield TurnEvent::ItemAnnounced(item_without_reasoning_payload(&item));
                        round.queue(item)?;
                    } else {
                        yield TurnEvent::Item(StreamItem::Received { item, finished });
                    }
                }
            }
        }
    }
    // Reached only when Azure stopped sending before it completed the response. Without it the
    // round yields nothing and the turn silently asks again, with a call in its input that has no
    // output after it.
    Err(chatbot_err!(StreamEndedEarly, "Stream ended unexpectedly"))?;
    })
}

/// Decides whether a tool-call error ends the turn or is reported to the LLM as a failed call.
///
/// `context` opens the warning logged for the non-terminating case; the caller still owns whether
/// the recovered text is wrapped as a suspended call's answer or a served call's output.
fn recover_or_terminate(
    error: ChatbotError,
    tool_name: &str,
    context: &str,
) -> ChatbotResult<String> {
    if error.error_type().should_terminate_stream() {
        return Err(error);
    }
    warn!("{context} Tool: {tool_name}. Error: {error:?}");
    Ok(tool_failure_output_for_llm(&error))
}

/// Turn a failed tool call into a function call output the LLM can act on, so it can
/// recover or explain the failure to the user instead of the turn dying.
///
/// Only messages written in tool code are passed through; anything else is reported
/// generically, because other messages are built from library errors and can carry
/// internals such as SQL or endpoint URLs.
fn tool_failure_output_for_llm(error: &ChatbotError) -> String {
    let reason = match error.error_type() {
        ChatbotErrorType::InvalidToolName
        | ChatbotErrorType::InvalidToolArguments
        | ChatbotErrorType::ToolUseError => error.message(),
        _ => "The tool is unavailable.",
    };
    format!(
        "The tool call failed and returned no data. Reason: {reason} Answer the user without this tool, or tell them what you would need to answer."
    )
}

#[cfg(test)]
mod tests {
    use headless_lms_models::{
        insert_data,
        test_helper::{Conn, insert_chatbot_conversation},
    };

    use super::*;
    use crate::azure_chatbot::azure::protocol::InputItem;
    use crate::azure_chatbot::test_helpers::{azure_response_stream, shape};
    use crate::chatbot_tools::tool_permission::test_helpers::context;

    /// Azure sends an item as `added` before it sends it as `done`, and only the `done` copy is
    /// whole or stored. Carrying both into the next round would send the item twice, and with
    /// `store` off the `added` copy of a reasoning item has no `encrypted_content`, which Azure
    /// rejects outright.
    #[tokio::test]
    async fn only_the_finished_copy_of_a_streamed_item_reaches_the_next_round() {
        insert_data!(:tx);
        let (_configuration, conversation_id) = insert_chatbot_conversation(tx.as_mut()).await;
        let user_context = context(None, None, Vec::new());
        let app_config =
            ApplicationConfiguration::mock_conf().expect("the mock configuration builds");

        let mut events = parse_tool(
            tx.as_mut() as &mut PgConnection,
            &app_config,
            azure_response_stream(&[
                "event: response.output_item.added",
                r#"data: {"type":"response.output_item.added","item":{"type":"reasoning","id":"rs_1","response_id":"resp_1","summary":[]}}"#,
                "event: response.output_item.done",
                r#"data: {"type":"response.output_item.done","item":{"type":"reasoning","id":"rs_1","response_id":"resp_1","summary":[],"encrypted_content":"payload"}}"#,
                "event: response.output_item.done",
                r#"data: {"type":"response.output_item.done","item":{"type":"function_call","id":"fc_1","response_id":"resp_1","call_id":"call_1","name":"no_such_tool","arguments":"{}"}}"#,
                "event: response.completed",
                r#"data: {"type":"response.completed","response":{"id":"resp_1"}}"#,
            ]),
            conversation_id,
            "resp_1".to_string(),
            &user_context,
            Vec::new(),
        )
        .await;

        let mut next_round = None;
        while let Some(event) = events.next().await {
            if let TurnEvent::Messages(messages) = event.expect("the round streams to the end") {
                next_round = Some(messages);
            }
        }

        let next_round = next_round.expect("the round hands its items on");
        assert_eq!(
            shape(&next_round),
            vec!["reasoning:rs_1", "call:call_1", "output:call_1"],
        );
        let InputItem::Reasoning {
            encrypted_content, ..
        } = &next_round[0].message_type
        else {
            panic!("the first item is the reasoning item");
        };
        assert_eq!(encrypted_content.as_deref(), Some("payload"));
    }

    /// A search that failed or found nothing reports itself as plain text rather than the
    /// `AISearchOutput` JSON shape, and that text must still be stored, with just its citations
    /// skipped, rather than aborting the round.
    #[test]
    fn a_non_conforming_search_output_is_stored_without_citations() {
        let item = OutputItem::AzureAiSearchCallOutput {
            response_id: "resp_1".to_string(),
            call_id: "call_1".to_string(),
            output: "remote tool call failed".to_string(),
        };

        let plan =
            storage_plan(item, Uuid::new_v4()).expect("a non-conforming output still stores");
        assert!(matches!(plan, StoragePlan::Insert(_)));
    }

    /// A proxy that closes the body cleanly before `response.completed` must not let the round
    /// loop silently with a call in its input that has no output after it.
    #[tokio::test]
    async fn a_stream_that_ends_before_response_completed_errors() {
        insert_data!(:tx);
        let (_configuration, conversation_id) = insert_chatbot_conversation(tx.as_mut()).await;
        let user_context = context(None, None, Vec::new());
        let app_config =
            ApplicationConfiguration::mock_conf().expect("the mock configuration builds");

        let mut events = parse_tool(
            tx.as_mut() as &mut PgConnection,
            &app_config,
            azure_response_stream(&[
                "event: response.output_item.done",
                r#"data: {"type":"response.output_item.done","item":{"type":"function_call","id":"fc_1","response_id":"resp_1","call_id":"call_1","name":"no_such_tool","arguments":"{}"}}"#,
            ]),
            conversation_id,
            "resp_1".to_string(),
            &user_context,
            Vec::new(),
        )
        .await;

        let error = loop {
            match events.next().await.expect("the stream ends in an error") {
                Ok(_) => continue,
                Err(error) => break error,
            }
        };
        assert_eq!(*error.error_type(), ChatbotErrorType::StreamEndedEarly);
    }
}
