//! Runs one chatbot turn against the Azure Responses API and streams it to the client as NDJSON.
//!
//! A *turn* is everything the assistant does in answer to one learner message: as many *rounds*
//! as the model needs, each round one request to Azure and the response it streams back, up to
//! the answer that ends the turn. A turn is not one HTTP request — one that calls a tool the
//! client answers suspends, and a later request resumes it from the stored conversation.
//!
//! `turn`, `turn::round` and `turn::text_response` hold one `async_stream::try_stream!`
//! generator each, and the seams are between them, never inside one. A generator exits through `break 'outer` and
//! `return Err(e)?`, which no extracted helper can carry across a function boundary, so anything
//! lifted out of one has to be a pure function over values, an async fn that borrows the
//! connection and returns a value, or another stream. `azure::sse` classifies a response as a
//! plain async fn precisely because it yields nothing the turn cannot receive as a return value.

pub mod azure;
mod client_tool_calls;
pub mod events;
mod request;
#[cfg(test)]
mod test_helpers;
pub mod turn;
