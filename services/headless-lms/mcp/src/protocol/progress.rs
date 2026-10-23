//! Progress notifications on the call's response stream. A no-op unless the client sent a
//! progress token and the transport streams the response.

use serde_json::{Value, json};
use tokio::sync::mpsc::UnboundedSender;

#[derive(Debug, Clone, Default)]
pub struct ProgressReporter {
    token: Option<Value>,
    sink: Option<UnboundedSender<Value>>,
}

impl ProgressReporter {
    /// `sink` receives complete JSON-RPC notification messages for the transport to stream.
    pub fn new(token: Option<Value>, sink: Option<UnboundedSender<Value>>) -> Self {
        Self { token, sink }
    }

    pub fn disabled() -> Self {
        Self::default()
    }

    pub fn is_enabled(&self) -> bool {
        self.token.is_some() && self.sink.is_some()
    }

    /// Reports `progress` out of `total` (when known). Never fails the call.
    pub fn report(&self, progress: f64, total: Option<f64>, message: Option<&str>) {
        let (Some(token), Some(sink)) = (&self.token, &self.sink) else {
            return;
        };
        let mut params = json!({"progressToken": token, "progress": progress});
        if let Some(total) = total {
            params["total"] = json!(total);
        }
        if let Some(message) = message {
            params["message"] = json!(message);
        }
        let _ = sink
            .send(json!({"jsonrpc": "2.0", "method": "notifications/progress", "params": params}));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sends_only_with_token_and_sink() {
        let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
        ProgressReporter::new(None, Some(sender.clone())).report(1.0, None, None);
        assert!(receiver.try_recv().is_err());
        ProgressReporter::new(Some(json!("t")), Some(sender)).report(
            1.0,
            Some(4.0),
            Some("validating"),
        );
        let sent = receiver.try_recv().unwrap();
        assert_eq!(sent["params"]["progressToken"], json!("t"));
        assert_eq!(sent["params"]["total"], json!(4.0));
    }
}
