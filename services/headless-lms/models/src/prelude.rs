//! Re-exports commonly used types for convenient use across the crate.
//! Intended to be glob-imported like `use crate::controllers::prelude::*;`.

pub use chrono::{DateTime, Utc};
pub use futures::prelude::*;
pub use headless_lms_utils as utils;
pub use headless_lms_utils::pagination::Pagination;
pub use serde::{Deserialize, Serialize};
pub use sqlx::{Connection, FromRow, PgConnection, PgPool, Type};
pub use ts_rs::TS;
pub use uuid::Uuid;

pub use crate::{ModelError, ModelResult};
