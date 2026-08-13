//! The world installed when nothing has been pushed, and the marker that says which database it
//! belongs to.
//!
//! It is the seed's own world rather than fixtures of its own: the restore-from-template setup path
//! runs no seed, and a different world there would hand the two setup paths different fixtures.

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

/// Something the database also knows, so a world installed against a *different* database shows up as
/// a diagnostic. Staleness inside one restored template is invisible to it, which is what the flush on
/// that path is for. The mock's only read of Postgres, and it never writes.
pub async fn db_generation_marker(pool: &PgPool) -> Option<String> {
    let mut conn = pool.acquire().await.ok()?;
    let course = models::courses::get_course(&mut conn, SUOTAR_COURSE_ID)
        .await
        .ok()?;
    Some(format!("db{}", course.created_at.timestamp_millis()))
}
