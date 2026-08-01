//! The world installed when nothing has been pushed, and the marker that says which database it
//! belongs to.
//!
//! It holds no fixtures of its own. The restore-from-template setup path replaces the database and
//! runs no seed, so the lazily installed world is the only one the suite sees there — a different
//! world would hand the two setup scripts different fixtures with nothing in the output saying why.

use sqlx::PgPool;

use crate::prelude::*;
use crate::programs::seed::seed_courses::seed_credit_registration::{
    SUOTAR_COURSE_ID, mock_suotar_world,
};

use super::commands::world_from_push;
use super::store::World;

pub fn build() -> World {
    world_from_push(mock_suotar_world())
}

/// Something the database also knows, so a world installed against a *different* database is a
/// crisp diagnostic rather than a baffling test failure. Staleness inside one restored template is
/// invisible to it, which is what the flush on that path is for.
///
/// This is the whole of the mock's relationship with Postgres: one read, never a write.
pub async fn db_generation_marker(pool: &PgPool) -> Option<String> {
    let created_at: Option<DateTime<Utc>> =
        sqlx::query_scalar("SELECT created_at FROM courses WHERE id = $1")
            .bind(SUOTAR_COURSE_ID)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    created_at.map(|created_at| format!("db{}", created_at.timestamp_millis()))
}
