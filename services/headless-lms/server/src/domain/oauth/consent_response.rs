use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]

pub struct ConsentResponse {
    pub redirect_uri: String,
}
