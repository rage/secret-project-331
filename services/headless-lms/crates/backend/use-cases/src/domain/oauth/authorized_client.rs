use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AuthorizedClient {
    pub client_id: Uuid,
    pub client_name: String,
    pub scopes: Vec<String>,
}
