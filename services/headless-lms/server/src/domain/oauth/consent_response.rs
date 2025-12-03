use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ConsentResponse {
    pub redirect_uri: String,
}
