#![allow(unused_imports)]

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
pub use headless_lms_base::prelude_base_and_re_exports::*;
pub use headless_lms_models as models;
pub use headless_lms_models::re_exports::*;
pub use headless_lms_utils::prelude::*;
pub use headless_lms_utils::{cache::Cache, file_store::FileStore, pagination::Pagination};
pub use rand::Rng;
pub use rand::RngExt;
#[cfg(feature = "ts-rs")]
pub use ts_rs::TS;
