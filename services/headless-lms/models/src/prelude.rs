//! Re-exports commonly used types for convenient use across the crate.
//! Intended to be glob-imported like `use crate::prelude::*;`.

pub use headless_lms_base::prelude_base_and_re_exports::*;
pub use headless_lms_utils::prelude::*;
pub use headless_lms_utils::{file_store::FileStore, pagination::Pagination};
pub use sqlx::{Connection, FromRow, PgConnection, PgPool, Pool, Postgres, Type};
#[cfg(feature = "ts-rs")]
pub use ts_rs::TS;

pub use crate::{
    CourseOrExamId, ModelError, ModelErrorType, ModelResult, PKeyPolicy, error::TryToOptional,
};
