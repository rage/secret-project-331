//! Re-exports commonly used types for convenient use across the crate.
//! Intended to be glob-imported like `use crate::controllers::prelude::*;`.

pub use crate::controllers::helpers::media::{upload_media, StoreKind};
pub use crate::controllers::{ControllerError, ControllerResult, UploadResult};
pub use crate::domain::authorization::{authorize, Action as Act, AuthUser, Resource as Res};
pub use actix_multipart::Multipart;
pub use actix_web::web::{self, HttpRequest, HttpResponse, ServiceConfig};
pub use anyhow::Context;
pub use headless_lms_models as models;
pub use headless_lms_utils::{
    file_store::FileStore, pagination::Pagination, ApplicationConfiguration,
};
pub use serde::{Deserialize, Serialize};
pub use sqlx::{Connection, FromRow, PgConnection, PgPool, Type};
pub use ts_rs::TS;
pub use uuid::Uuid;
