//! The wire side of the Azure Responses API: its request and response shapes, how a tool is
//! advertised in a request, its SSE framing, and the HTTP call. Nothing here knows about
//! conversations, what a tool does or the database.

pub mod protocol;
pub(super) mod sse;
pub mod tools;
pub(super) mod transport;
