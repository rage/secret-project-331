//! Progress notifications on the call's response stream. A no-op unless the client sent a
//! progress token and the transport streams the response.

use rmcp::model::{
    JsonRpcNotification, JsonRpcVersion2_0, ProgressNotification, ProgressNotificationParam,
    ProgressToken,
};
use serde_json::Value;
use tokio::sync::mpsc::UnboundedSender;

/// Sends progress notifications for one call.
#[derive(Debug, Clone, Default)]
pub struct ProgressReporter {
    token: Option<ProgressToken>,
    sink: Option<UnboundedSender<Value>>,
}

impl ProgressReporter {
    /// `sink` receives complete JSON-RPC notification messages for the transport to stream.
    pub fn new(token: Option<ProgressToken>, sink: Option<UnboundedSender<Value>>) -> Self {
        Self { token, sink }
    }

    /// Reports `progress` out of `total` (when known). Never fails the call.
    pub fn report(&self, progress: f64, total: Option<f64>, message: Option<&str>) {
        let (Some(token), Some(sink)) = (&self.token, &self.sink) else {
            return;
        };
        let mut params = ProgressNotificationParam::new(token.clone(), progress);
        params.total = total;
        params.message = message.map(str::to_string);
        let notification = JsonRpcNotification {
            jsonrpc: JsonRpcVersion2_0,
            notification: ProgressNotification::new(params),
        };
        if let Ok(notification) = serde_json::to_value(notification) {
            let _ = sink.send(notification);
        }
    }
}

#[cfg(test)]
mod tests {
    use rmcp::model::NumberOrString;
    use serde_json::json;

    use super::*;

    #[test]
    fn sends_only_with_token_and_sink() {
        let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
        ProgressReporter::new(None, Some(sender.clone())).report(1.0, None, None);
        assert!(receiver.try_recv().is_err());
        let token = ProgressToken(NumberOrString::String("t".into()));
        ProgressReporter::new(Some(token), Some(sender)).report(1.0, Some(4.0), Some("validating"));
        let sent = receiver.try_recv().unwrap();
        assert_eq!(sent["params"]["progressToken"], json!("t"));
        assert_eq!(sent["params"]["total"], json!(4.0));
    }
}
