use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, ToSchema)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ConsentDenyQuery {
    pub client_id: String,
    pub redirect_uri: String,
    pub state: String,
}
