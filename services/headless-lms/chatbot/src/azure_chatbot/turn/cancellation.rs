//! Keeps a turn that the client abandoned from losing what it had already streamed.

use std::pin::Pin;
use std::sync::{
    Arc,
    atomic::{self, AtomicBool},
};
use std::task::{Context, Poll};

use bytes::Bytes;
use futures::Stream;
use pin_project::pin_project;
use sqlx::PgPool;
use tokio::sync::Mutex;

use crate::azure_chatbot::client_tool_calls::repair::answer_unfinished_tool_calls;
use crate::chatbot_error::ChatbotResult;
use crate::llm_utils::estimate_tokens;
use crate::prelude::*;

/// Ties a turn's cancellation guard to its response stream, so cleanup runs when the client drops
/// the stream rather than whenever the turn's driver function returns.
#[pin_project]
pub(super) struct GuardedStream<S> {
    guard: RequestCancelledGuard,
    #[pin]
    stream: S,
}

impl<S> GuardedStream<S> {
    pub(super) fn new(guard: RequestCancelledGuard, stream: S) -> Self {
        Self { guard, stream }
    }
}

impl<S> Stream for GuardedStream<S>
where
    S: Stream<Item = ChatbotResult<Bytes>> + Send,
{
    type Item = S::Item;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.project();
        let polled = this.stream.poll_next(cx);
        // Log stream errors here in the clean format; actix's dispatcher otherwise only
        // surfaces them as a terse Display line once the error is in the response body.
        if let Poll::Ready(Some(Err(error))) = &polled {
            error!("Chatbot response stream error:\n{error:?}");
        }
        polled
    }
}

pub(super) struct RequestCancelledGuard {
    pub(super) conversation_id: Uuid,
    /// The responses this turn's rounds were given, which is what bounds the tool calls the
    /// cleanup may answer to the ones this turn made.
    pub(super) response_ids: Arc<Mutex<Vec<String>>>,
    pub(super) response_message_id: Arc<Mutex<Option<Uuid>>>,
    pub(super) full_response_text: Arc<Mutex<String>>,
    pub(super) pool: PgPool,
    pub(super) done: Arc<AtomicBool>,
}

impl Drop for RequestCancelledGuard {
    fn drop(&mut self) {
        if self.done.load(atomic::Ordering::Relaxed) {
            return;
        }
        info!("Request ended before the turn completed. Cleaning up.");
        // Nothing awaits this task, so failures are logged instead of panicked on: a panic here
        // would be invisible apart from a stray tracing event.
        tokio::spawn(clean_up_abandoned_turn(
            self.pool.clone(),
            self.conversation_id,
            self.response_ids.clone(),
            self.response_message_id.clone(),
            self.full_response_text.clone(),
        ));
    }
}

/// Cleans up after a turn the client abandoned mid-stream: answers the tool calls it left without
/// an output, then deletes the response message if it never received any text, or saves the text
/// it did receive as its (incomplete) answer.
///
/// The tool calls are answered first and whether or not there is a message: a call with no output
/// makes the LLM reject every later message of the conversation, while a turn that died in a tool
/// round created no message at all.
///
/// Unlike [`save_partial_answer`], this decides whether there is anything to save.
async fn clean_up_abandoned_turn(
    pool: PgPool,
    conversation_id: Uuid,
    response_ids: Arc<Mutex<Vec<String>>>,
    response_message_id: Arc<Mutex<Option<Uuid>>>,
    full_response_text: Arc<Mutex<String>>,
) {
    let mut conn = match pool.acquire().await {
        Ok(conn) => conn,
        Err(err) => {
            error!(
                "Could not acquire a connection to clean up after a cancelled chatbot request: {err}"
            );
            return;
        }
    };
    let response_ids = response_ids.lock().await.clone();
    if let Err(err) = answer_unfinished_tool_calls(&mut conn, conversation_id, &response_ids).await
    {
        error!("Could not answer the tool calls an abandoned chatbot turn left unfinished: {err}");
    }
    info!("Verifying the received message has been handled");
    let Some(id) = response_message_id.lock().await.to_owned() else {
        info!("No response message was created for this request, nothing else to clean up.");
        return;
    };
    let full_response_text = full_response_text.lock().await;
    if full_response_text.is_empty() {
        info!("No response received. Deleting the response message");
        if let Err(err) = models::chatbot_conversation_messages::delete(&mut conn, id).await {
            error!("Could not delete the empty chatbot response message {id}: {err}");
        }
        return;
    }
    info!("Response received but not completed. Saving the text received so far.");
    let estimated_cost = estimate_tokens(&full_response_text);
    // Below the default log level, same as the equivalent line in `parse_text_response`: the
    // answer text is learner-facing content, which `summarize_input_for_log` exists to keep out
    // of the request-side logs, and this is the response-side counterpart of that.
    trace!(
        "End of chatbot response stream. Estimated cost: {}. Response: {}",
        estimated_cost, *full_response_text
    );
    if let Err(err) = save_partial_answer(&mut conn, id, &full_response_text, estimated_cost).await
    {
        error!("Could not save the partial chatbot response message {id}: {err}");
    }
}

/// Saves `text` as the (incomplete) answer of the message `message_id` already names, billed for
/// `used_tokens`.
///
/// Bumps the parent message row transactionally — see
/// [`chatbot_conversation_messages::update`](models::chatbot_conversation_messages::update).
/// Callers decide for themselves whether an empty `text` is worth saving at all; this always does.
pub(super) async fn save_partial_answer(
    conn: &mut PgConnection,
    message_id: Uuid,
    text: &str,
    used_tokens: i32,
) -> ChatbotResult<()> {
    models::chatbot_conversation_messages::update(conn, message_id, text, true, used_tokens)
        .await?;
    Ok(())
}
