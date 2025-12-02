use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AuthorizedClient {
    pub client_id: Uuid,
    pub client_name: String,
    pub scopes: Vec<String>,
}
