use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentQuery {
    pub client_id: String,
    pub redirect_uri: String,
    pub response_type: String,
    pub scopes: String,
    pub state: String,
    pub nonce: String,
}
