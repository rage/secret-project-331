use crate::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ConsentDenyQuery {
    pub client_id: String,
    pub redirect_uri: String,
    pub state: String,
}
