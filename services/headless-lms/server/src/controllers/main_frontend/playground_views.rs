//! Handles playground-views-related functionality, in particular the websocket connections used to update the grading for services like tmc.

use crate::prelude::*;
use actix::{
    Actor, ActorContext, Addr, AsyncContext, Handler, Message, SpawnHandle, StreamHandler,
};
use actix_web_actors::ws;
use models::exercise_task_gradings::ExerciseTaskGradingResult;
use once_cell::sync::OnceCell;
use std::{
    collections::HashMap,
    sync::RwLock,
    time::{Duration, Instant},
};

// the clients are pinged, to which they are supposed to respond with pongs, and...
const PING_INTERVAL: Duration = Duration::from_secs(10);
// ..if we get no pongs for this duration, we'll drop the connection
const CONNECTION_TIMEOUT: Duration = Duration::from_secs(60);

// stores all the ws connections so that they can be fetched by the handler that receives updated gradings
static WS_CONNECTIONS: WsConnections = WsConnections::new();

// a simple RwLock should be fine since we're not expecting a large amount of ws connections for this page
struct WsConnections(OnceCell<RwLock<HashMap<Uuid, Addr<ClientConnection>>>>);

impl WsConnections {
    const fn new() -> Self {
        Self(OnceCell::new())
    }

    fn get(&self, id: Uuid) -> Option<Addr<ClientConnection>> {
        let lock = self
            .0
            .get_or_init(Default::default)
            .read()
            .expect("should never panic with the lock");
        lock.get(&id).cloned()
    }

    fn register(&self, id: Uuid, addr: Addr<ClientConnection>) {
        let mut lock = self
            .0
            .get_or_init(Default::default)
            .write()
            .expect("should never panic with the lock");
        lock.insert(id, addr);
    }

    fn unregister(&self, id: Uuid) {
        if let Some(connections) = self.0.get() {
            let mut lock = connections
                .write()
                .expect("should never panic with the lock");
            lock.remove(&id);
        }
    }
}

// models a single client's websocket connection
struct ClientConnection {
    client_id: Uuid,
    last_pong: Instant,
    // stores the task that continuously pings the client
    ping_handle: Option<SpawnHandle>,
}

impl ClientConnection {
    fn new() -> Self {
        Self {
            client_id: Uuid::new_v4(),
            last_pong: Instant::now(),
            ping_handle: None,
        }
    }
}

impl Actor for ClientConnection {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        let id = self.client_id;
        // start the task that continuously pings the client
        let ping_handle = ctx.run_interval(PING_INTERVAL, move |socket, ctx| {
            if socket.last_pong.elapsed() > CONNECTION_TIMEOUT {
                // timed out
                WS_CONNECTIONS.unregister(id);
                ctx.text(
                    serde_json::to_string(&PlaygroundViewsMessage::TimedOut)
                        .expect("should never panic"),
                );
                ctx.stop();
            } else {
                ctx.ping(b"ping");
            }
        });
        WS_CONNECTIONS.register(id, ctx.address());
        // inform the client of their id
        ctx.text(
            serde_json::to_string(&PlaygroundViewsMessage::Registered(id))
                .expect("should never fail"),
        );
        self.ping_handle = Some(ping_handle);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ClientConnection {
    fn handle(&mut self, item: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        // currently, no messages are expected from the frontend other than pings
        match item {
            Ok(ws::Message::Ping(_)) => {
                ctx.pong(b"pong");
            }
            Ok(ws::Message::Pong(_)) => {
                self.last_pong = Instant::now();
            }
            _ => {}
        };
    }
}

// this is a little awkward, but this is a message sent from the function that handles incoming grading updates
// to the ClientConnection actor, so that it can then pass the message on to the client
#[derive(Debug, Message)]
#[rtype(result = "()")]
struct PlaygroundSubmissionMessage {
    grading_result: ExerciseTaskGradingResult,
}

impl Handler<PlaygroundSubmissionMessage> for ClientConnection {
    type Result = ();

    fn handle(
        &mut self,
        msg: PlaygroundSubmissionMessage,
        ctx: &mut Self::Context,
    ) -> Self::Result {
        // pass on the message to the client
        ctx.text(
            serde_json::to_string(&PlaygroundViewsMessage::ExerciseTaskGradingResult(
                msg.grading_result,
            ))
            .expect("should never fail"),
        );
    }
}

/// The message type for all messages sent from the server to the client from the playgrounds-views websocket connection.
#[derive(Debug, Serialize, Message)]
#[rtype(result = "()")]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(tag = "tag", content = "data")]
pub enum PlaygroundViewsMessage {
    /// Server did not receive a pong for a certain period so the connection timed out.
    TimedOut,
    /// Server accepted a new websocket connection and is informing the new client of their connection id.
    Registered(Uuid),
    /// Server received an updated grading from an exercise service and is passing it on to the client.
    ExerciseTaskGradingResult(ExerciseTaskGradingResult),
}

/// Starts a new websocket connection.
async fn websocket(
    req: HttpRequest,
    stream: web::Payload,
) -> Result<HttpResponse, ControllerError> {
    // start websocket connection
    ws::start(ClientConnection::new(), &req, stream).map_err(Into::into)
}

/// playground-views passes a URL pointing to this route to an exercise service when sending submissions so that if
/// the service has an update for a pending grading, it will be sent here and passed on to through the websocket
async fn receive_grading(
    websocket_id: web::Path<Uuid>,
    grading_result: web::Json<ExerciseTaskGradingResult>,
) -> Result<HttpResponse, ControllerError> {
    // send grading result to the corresponding websocket connection
    if let Some(conn) = WS_CONNECTIONS.get(*websocket_id) {
        conn.do_send(PlaygroundSubmissionMessage {
            grading_result: grading_result.into_inner(),
        });
    }
    Ok(HttpResponse::Ok().finish())
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/ws", web::get().to(websocket))
        .route("/grading/{websocket_id}", web::post().to(receive_grading));
}
