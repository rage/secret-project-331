#![allow(unused_imports)]
pub use crate::domain::authorization::{
    Action as Act, AuthorizedOk, Resource as Res, authorize, authorize_access_to_course_material,
    skip_authorize,
};
pub(crate) use crate::domain::error::controller_err;
pub use crate::domain::{
    self,
    error::{ControllerError, ControllerErrorType, ControllerResult},
    request_id::RequestId,
};
pub use actix_web::{
    HttpRequest, HttpResponse,
    web::{self, ServiceConfig},
};
pub use headless_lms_base::prelude_base_and_re_exports::*;
pub use headless_lms_cache::cache::Cache;
pub use headless_lms_file_store::file_store::FileStore;
pub use headless_lms_models as models;
pub use headless_lms_models::re_exports::*;
pub use headless_lms_utils::pagination::Pagination;
pub use headless_lms_utils::prelude::*;
pub use rand::{Rng, RngExt};
