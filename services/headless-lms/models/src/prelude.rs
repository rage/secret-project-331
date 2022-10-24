//! Re-exports commonly used types for convenient use across the crate.
//! Intended to be glob-imported like `use crate::prelude::*;`.

pub use chrono::{DateTime, Utc};
pub use headless_lms_utils::pagination::Pagination;
pub use serde::{Deserialize, Serialize};
pub use sqlx::{Connection, FromRow, PgConnection, Type};
#[cfg(feature = "ts_rs")]
pub use ts_rs::TS;
pub use uuid::Uuid;

pub use crate::{
    error::TryToOptional, CourseOrExamId, ModelError, ModelErrorType, ModelResult, PKeyPolicy,
};
pub use headless_lms_utils::error::backend_error::BackendError;
