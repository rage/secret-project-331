use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ConsentResponse {
    pub redirect_uri: String,
}
