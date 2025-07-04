//! Re-exports commonly used types for convenient use across the crate.
//! Intended to be glob-imported like `use crate::prelude::*;`.

pub use crate::controllers::UploadResult;
pub use crate::controllers::helpers::file_uploading::{
    StoreKind, upload_field_from_cms, upload_file_from_cms,
};
pub use crate::domain::authorization::{
    Action as Act, AuthUser, Resource as Res, authorize, authorize_access_to_course_material,
    parse_secret_key_from_header, skip_authorize,
};
pub use crate::domain::{
    self,
    error::{ControllerError, ControllerErrorType, ControllerResult},
    request_id::RequestId,
};
pub use crate::generated_docs;
pub use actix_multipart::Multipart;
pub use actix_web::web::{self, ServiceConfig};
pub use actix_web::{HttpRequest, HttpResponse};
pub use anyhow::Context;
pub use headless_lms_models as models;
pub use headless_lms_models::PKeyPolicy;
pub use headless_lms_models::error::TryToOptional;
pub use headless_lms_utils::error::backend_error::BackendError;
pub use headless_lms_utils::{
    ApplicationConfiguration, cache::Cache, file_store::FileStore, pagination::Pagination,
};
pub use serde::{Deserialize, Serialize};
pub use sqlx::{Connection, FromRow, PgConnection, PgPool, Pool, Postgres, Type};
#[cfg(feature = "ts_rs")]
pub use ts_rs::TS;
pub use uuid::Uuid;
