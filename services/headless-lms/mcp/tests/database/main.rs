//! The tools against the test database, end to end through the protocol layer and the HTTP route.
//! Each test commits a fresh course of its own into `<DATABASE_URL_TEST database>_mcp`, which
//! every run drops and recreates.

#![allow(clippy::unwrap_used)]

mod concurrency;
mod course_list;
mod deadlines;
mod editing;
mod exercise_list;
mod exercises;
mod fixture;
mod oauth_route;
mod pairing;
mod public_course;
mod reverts;
mod review;
mod settings;
mod specs;
