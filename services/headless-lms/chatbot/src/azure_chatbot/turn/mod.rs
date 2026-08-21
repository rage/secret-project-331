//! The turn driver: keeps asking Azure while a round answers itself with tool calls, and ends on
//! an answer, an error, a suspension, or the round budget.

mod cancellation;
mod round;
mod text_response;

use std::pin::Pin;
use std::sync::{
    Arc,
    atomic::{self, AtomicBool},
};

use bytes::Bytes;
use futures::{Stream, StreamExt};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_conversation_message_messages::{
    ChatbotConversationMessageMessage, MessageRole,
};
use headless_lms_models::chatbot_conversation_messages::{ChatbotConversationMessage, Message};
use sqlx::PgPool;
use tokio::sync::Mutex;
use tracing::trace;

use super::azure::protocol::{LLMRequest, OutputItem};
use super::azure::sse::detect_response_kind;
use super::azure::transport::{ResponseStreamType, make_request_and_create_stream};
use super::client_tool_calls::answer::{client_tool_output_for_answer, rejected_tool_answer_error};
use super::client_tool_calls::repair::{
    answer_stale_unfinished_tool_calls, answer_unfinished_tool_calls,
};
use super::events::{
    ChatbotChatStreamEvent, StreamItem, TurnEvent, error_event_from_error, error_event_from_text,
    ndjson_line, single_event_stream, stream_event_for,
};
use super::request::replayable_input_message;
use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::ClientToolAnswer;
use crate::conversation_context::ChatbotPageContext;
use crate::llm_utils::{estimate_tokens, summarize_input_for_log};
use crate::prelude::*;
use crate::user_context::ChatbotUserContext;
use cancellation::{GuardedStream, RequestCancelledGuard, save_partial_answer};
use round::{is_stored_by_round, parse_tool, store_output_item};
use text_response::parse_text_response;

/// How many LLM requests one turn may make, bounding a model that keeps calling tools instead of
/// answering.
const MAX_TOOL_CALL_ROUNDS_PER_TURN: u32 = 15;

/// Starts a turn for a new user message, and streams its NDJSON events to the client.
pub async fn send_chat_request_and_parse_stream(
    pool: PgPool,
    app_configuration: &ApplicationConfiguration,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
    message: &str,
    page_context: Option<ChatbotPageContext>,
    user_context: ChatbotUserContext,
) -> ChatbotResult<Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>>> {
    begin_turn(
        pool,
        app_configuration,
        conversation_id,
        user_context,
        TurnStart::NewUserMessage {
            chatbot_configuration_id,
            message,
            page_context,
        },
    )
    .await
}

/// Records a client's answer to a tool call the turn suspended on, and continues that turn once
/// nothing else is outstanding.
///
/// Of a round of parallel calls, only the request that answers the last one gets the resumed turn;
/// the others get a stream carrying `Suspended` again, so a client reads every response the same
/// way. `tool_call_id` must be a client-answered call of `conversation_id` that has no answer yet
/// and `answer` must fit what that call offered, or this fails with
/// [ChatbotErrorType::InvalidToolAnswer] and writes nothing.
pub async fn answer_tool_call_and_resume_stream(
    pool: PgPool,
    app_configuration: &ApplicationConfiguration,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
    tool_call_id: &str,
    answer: &ClientToolAnswer,
    user_context: ChatbotUserContext,
) -> ChatbotResult<Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>>> {
    begin_turn(
        pool,
        app_configuration,
        conversation_id,
        user_context,
        TurnStart::ResumedFromToolAnswer {
            chatbot_configuration_id,
            tool_call_id,
            answer,
        },
    )
    .await
}

/// What starts a turn: a new message from the user, or one resuming after the client answered a
/// tool call the previous turn suspended on.
enum TurnStart<'a> {
    NewUserMessage {
        chatbot_configuration_id: Uuid,
        message: &'a str,
        page_context: Option<ChatbotPageContext>,
    },
    ResumedFromToolAnswer {
        chatbot_configuration_id: Uuid,
        tool_call_id: &'a str,
        answer: &'a ClientToolAnswer,
    },
}

/// Shared preamble of both ways a turn can begin: acquire a connection, repair any tool call a
/// dead turn of this conversation left unanswered, build the request the turn runs with, and hand
/// off to [stream_turn] — or, on a resume that is still waiting on another call, return the
/// [ChatbotChatStreamEvent::Suspended] stream without ever reaching it.
///
/// Repairing before either path reads the conversation's history is required, not incidental: an
/// unanswered call from a dead turn makes the LLM reject every later message of the conversation.
/// Only long-dead calls are touched: another request may be streaming a turn of this same
/// conversation.
async fn begin_turn(
    pool: PgPool,
    app_configuration: &ApplicationConfiguration,
    conversation_id: Uuid,
    user_context: ChatbotUserContext,
    start: TurnStart<'_>,
) -> ChatbotResult<Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>>> {
    let mut conn = pool.acquire().await?;
    let unanswered = answer_stale_unfinished_tool_calls(&mut conn, conversation_id).await?;
    let app_config = app_configuration.to_owned();

    let chat_request = match start {
        TurnStart::NewUserMessage {
            chatbot_configuration_id,
            message,
            page_context,
        } => {
            LLMRequest::build_and_insert_incoming_user_message_to_db(
                &mut conn,
                chatbot_configuration_id,
                conversation_id,
                message,
                page_context,
                &user_context,
                &app_config,
            )
            .await?
        }
        TurnStart::ResumedFromToolAnswer {
            chatbot_configuration_id,
            tool_call_id,
            answer,
        } => {
            let answered = client_tool_output_for_answer(
                &mut conn,
                conversation_id,
                &unanswered,
                tool_call_id,
                answer,
                &user_context,
            )
            .await?;

            let outcome = models::chatbot_conversation_messages::answer_client_tool_call(
                &mut conn,
                conversation_id,
                tool_call_id,
                answered.output,
                answered.client_answer,
            )
            .await
            .map_err(rejected_tool_answer_error)?;

            if !outcome.turn_can_resume {
                trace!(
                    "Tool call {tool_call_id} answered, the turn is still waiting for another answer"
                );
                return single_event_stream(ChatbotChatStreamEvent::Suspended);
            }

            let configuration =
                models::chatbot_configurations::get_by_id(&mut conn, chatbot_configuration_id)
                    .await?;
            LLMRequest::build_from_conversation(
                &mut conn,
                &configuration,
                conversation_id,
                &user_context,
                &app_config,
            )
            .await?
        }
    };

    Ok(stream_turn(
        pool,
        app_config,
        conversation_id,
        chat_request,
        user_context,
    ))
}

/// What a round that ended in error becomes: logs it, answers whatever tool call the turn left
/// without an output, and either returns the wire event for an error the turn survives or the
/// original error for one that ends it.
///
/// The reap belongs here rather than at each failing site, so that no error path can end a turn
/// without it: a call with no output makes the LLM reject every later message of the conversation.
/// `response_ids` are the responses this turn's rounds were given, which keeps the reap off the
/// calls of a turn streaming in another request.
///
/// Takes the pool rather than a connection: the call sites hold their round's connection under a
/// live borrow, or have already given theirs back, so this acquires its own for the reap.
async fn recover_from_round_error(
    pool: &PgPool,
    conversation_id: Uuid,
    response_ids: &[String],
    input_summary: &str,
    error: ChatbotError,
) -> ChatbotResult<Bytes> {
    let response_id = response_ids.last().map(String::as_str);
    error!(
        input = %input_summary,
        "Stream ended unexpectedly. Response id: {} Error: {}", response_id.unwrap_or("not received"), error
    );
    let mut conn = pool.acquire().await?;
    if let Err(e2) = answer_unfinished_tool_calls(&mut conn, conversation_id, response_ids).await {
        error!(
            "Error in chatbot streaming and couldn't answer unfinished tool calls: {e2}. Response id: {}",
            response_id.unwrap_or("not received")
        );
    }
    if error.error_type().should_terminate_stream() {
        return Err(error);
    }
    error_event_from_error(&error)
}

/// Builds the wire event for a round-ending error, folding in the input summary and response ids
/// every call site of [recover_from_round_error] otherwise repeats.
async fn recover_and_summarize(
    pool: &PgPool,
    conversation_id: Uuid,
    response_ids: &Mutex<Vec<String>>,
    input: &[crate::llm_utils::APIInputMessage],
    error: ChatbotError,
) -> ChatbotResult<Bytes> {
    let input_summary = summarize_input_for_log(input);
    let round_response_ids = response_ids.lock().await.clone();
    recover_from_round_error(
        pool,
        conversation_id,
        &round_response_ids,
        &input_summary,
        error,
    )
    .await
}

/// Runs the request rounds of one turn against the LLM and streams its events as NDJSON.
///
/// Keeps asking the LLM as long as a round ends in tool calls it answered itself, and ends the
/// turn on a text answer, an error, a suspension, or the iteration limit. Owns the cancellation
/// guard, so a client that disappears mid-turn still gets what arrived saved.
fn stream_turn(
    pool: PgPool,
    app_config: ApplicationConfiguration,
    conversation_id: Uuid,
    mut chat_request: LLMRequest,
    user_context: ChatbotUserContext,
) -> Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>> {
    let mut rounds_left = MAX_TOOL_CALL_ROUNDS_PER_TURN;

    let done = Arc::new(AtomicBool::new(false));
    let full_response_text = Arc::new(Mutex::new(String::new()));
    let response_message_id: Arc<Mutex<Option<Uuid>>> = Arc::new(Mutex::new(None));
    // Shared with the guard so that its cleanup answers this turn's tool calls and no other
    // turn's.
    let response_ids: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    let guard = RequestCancelledGuard {
        conversation_id,
        response_ids: response_ids.clone(),
        response_message_id: response_message_id.clone(),
        full_response_text: full_response_text.clone(),
        pool: pool.clone(),
        done: done.clone(),
    };

    let response_stream = async_stream::try_stream! {
        'outer: loop {
            if rounds_left == 0 {
                error!("Maximum tool call iterations exceeded");
                yield error_event_from_text("Maximum tool call iterations exceeded. The LLM may be stuck in a loop.")?;
                done.store(true, atomic::Ordering::Relaxed);
                break 'outer;
            }
            rounds_left -= 1;

            let lines = match make_request_and_create_stream(&chat_request, &app_config).await {
                Ok(val) => val,
                Err(error) => {
                    let event = recover_and_summarize(&pool, conversation_id, &response_ids, &chat_request.input, error).await?;
                    yield event;
                    done.store(true, atomic::Ordering::Relaxed);
                    break 'outer;
                },
            };
            let classified = match detect_response_kind(lines).await {
                Ok(classified) => classified,
                Err(e) => {
                    let event = recover_and_summarize(&pool, conversation_id, &response_ids, &chat_request.input, e).await?;
                    yield event;
                    done.store(true, atomic::Ordering::Relaxed);
                    break 'outer;
                },
            };
            let received_response_id = classified.response_id;
            let typed_response_stream = classified.stream;
            // One statement, so no guard is alive across the awaits below: `?` inside `try_stream!`
            // parks the generator rather than returning, and a guard held at one is never released.
            response_ids.lock().await.push(received_response_id.clone());

            // Acquired only now: the request and its classification need no database, and the pool
            // is shared with the rest of the application.
            let mut conn = pool.acquire().await?;

            let mut calls_from_classification = Vec::new();
            for stream_item in classified.items {
                if let StreamItem::Received { item, finished: true } = &stream_item {
                    if is_stored_by_round(item) {
                        // A function call classifies the round it opens, so it arrives here rather
                        // than in the round that runs it; hand it over to be recorded there.
                        calls_from_classification.push(item.to_owned());
                    } else {
                        let stored = match store_output_item(&mut conn, item.to_owned(), conversation_id, &app_config)
                            .await
                            .and_then(replayable_input_message)
                        {
                            Ok(stored) => stored,
                            Err(e) => {
                                let event = recover_and_summarize(&pool, conversation_id, &response_ids, &chat_request.input, e).await?;
                                yield event;
                                done.store(true, atomic::Ordering::Relaxed);
                                break 'outer;
                            }
                        };
                        if let Some(stored) = stored {
                            chat_request.input.push(stored);
                        }
                    }
                }
                if let Some(event) = stream_event_for(stream_item) {
                    yield ndjson_line(&event)?;
                };
            }

            // Some only for a round that streams an answer, which is the only round whose events
            // address a message of their own.
            let (mut final_stream, text_message_id) = match typed_response_stream {
                ResponseStreamType::ToolCall(stream) => {
                    // The round writes a row per call as it goes, so it keeps the connection.
                    (parse_tool(conn, &app_config, stream, conversation_id, received_response_id, &user_context, calls_from_classification).await, None)
                }
                ResponseStreamType::TextResponse(stream) => {
                    let response_message = models::chatbot_conversation_messages::insert(
                        &mut conn,
                        ChatbotConversationMessage {
                            conversation_id,
                            message: Message::Text(ChatbotConversationMessageMessage {
                                text: "".to_string(),
                                message_role: MessageRole::Assistant,
                                message_is_complete: false,
                                response_id: Some(received_response_id.clone()),
                                ..Default::default()
                            }),
                            ..Default::default()
                        },
                    ).await?;

                    // One statement, so the guard is not alive across the awaits below: `?` inside
                    // `try_stream!` parks the generator rather than returning, and a guard held at
                    // one is never released.
                    *response_message_id.lock().await = Some(response_message.id);

                    // Move the citations of the turn onto the message that cites them before its
                    // text reaches the learner, so the markers in it have something behind them.
                    models::chatbot_conversation_messages_citations::attach_turn_citations_to_message(
                        &mut conn,
                        conversation_id,
                        response_message.id,
                    ).await?;

                    // Given back before the answer streams, which takes as long as the model takes
                    // to write it; what little the loop below stores acquires its own.
                    drop(conn);

                    (parse_text_response(stream, full_response_text.clone(), received_response_id).await, Some(response_message.id))
                }
            };

            while let Some(line) = final_stream.next().await {
                let val = match line {
                    Ok(val) => val,
                    Err(e) => {
                        if let Some(message_id) = text_message_id {
                            let full_response_as_string = full_response_text.lock().await.clone();
                            let mut conn = pool.acquire().await?;
                            if full_response_as_string.is_empty() {
                                // Nothing ever reached this message, and an empty one that is
                                // never completed replays into every later turn. Cleared first so
                                // the cancellation guard does not try to clean it up again.
                                *response_message_id.lock().await = None;
                                models::chatbot_conversation_messages::delete(&mut conn, message_id).await?;
                            } else {
                                let used_tokens = estimate_tokens(&full_response_as_string);
                                save_partial_answer(&mut conn, message_id, &full_response_as_string, used_tokens).await?;
                            }
                        };
                        let event = recover_and_summarize(&pool, conversation_id, &response_ids, &chat_request.input, e).await?;
                        yield event;
                        done.store(true, atomic::Ordering::Relaxed);
                        break 'outer;
                    }
                };
                match val {
                    TurnEvent::Delta(text) => {
                        match text_message_id {
                            Some(message_id) => yield ndjson_line(&ChatbotChatStreamEvent::Delta { text, message_id })?,
                            None => Err(chatbot_err!(StreamInvariantViolation, "Received answer text from a round that streams no answer."))?,
                        }
                    },
                    TurnEvent::Refusal { text, message_id } => {
                        yield ndjson_line(&ChatbotChatStreamEvent::Delta { text, message_id })?;
                    },
                    TurnEvent::Item(stream_item) => {
                        // A `Message` among these is an unexpected wire shape, not a normal
                        // path; store_output_item errors on it rather than storing it.
                        if let StreamItem::Received { item, finished: true } = &stream_item
                            && !is_stored_by_round(item)
                        {
                            let mut conn = pool.acquire().await?;
                            store_output_item(&mut conn, item.to_owned(), conversation_id, &app_config).await?;
                            // A search output stored after the answer's message was created keeps
                            // its citations on the tool-output row, out of reach of the markers in
                            // the answer that cite them.
                            if let Some(message_id) = text_message_id
                                && matches!(item, OutputItem::AzureAiSearchCallOutput { .. })
                            {
                                models::chatbot_conversation_messages_citations::attach_turn_citations_to_message(
                                    &mut conn,
                                    conversation_id,
                                    message_id,
                                ).await?;
                            }
                        }

                        if let Some(response) = stream_event_for(stream_item) {
                            yield ndjson_line(&response)?;
                        };
                    },
                    TurnEvent::ItemAnnounced(item) => {
                        // Stored by the round that produced it, at its position among that
                        // round's other items (see `TurnEvent::ItemAnnounced`); this only converts
                        // and forwards it to the client.
                        if let Some(response) = stream_event_for(StreamItem::Received { item, finished: true }) {
                            yield ndjson_line(&response)?;
                        };
                    },
                    TurnEvent::Messages(messages) => {
                        chat_request.input.extend(messages);
                    },
                    TurnEvent::Done { text, used_tokens } => {
                        match text_message_id {
                            Some(message_id) => {
                                let mut conn = pool.acquire().await?;
                                models::chatbot_conversation_messages::update(
                                    &mut conn,
                                    message_id,
                                    &text,
                                    true,
                                    used_tokens,
                                ).await?;
                            }
                            None => Err(chatbot_err!(StreamInvariantViolation, "A round that streams no answer reported one finished."))?,
                        }
                        done.store(true, atomic::Ordering::Relaxed);
                        yield ndjson_line(&ChatbotChatStreamEvent::Done)?;
                        break 'outer;
                    }
                    TurnEvent::Suspended => {
                        yield ndjson_line(&ChatbotChatStreamEvent::Suspended)?;
                        // The turn ended on purpose, so the guard must not treat the conversation
                        // as one that died mid-answer and clean up after it.
                        done.store(true, atomic::Ordering::Relaxed);
                        break 'outer;
                    }
                }
            }
        }
    };

    Box::pin(GuardedStream::new(guard, response_stream))
}
