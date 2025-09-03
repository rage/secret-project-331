use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentDenyQuery {
    pub redirect_uri: String,
    pub state: String,
}
