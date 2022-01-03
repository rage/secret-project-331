/*!
Functions and structs for interacting with the database.

Each submodule corresponds to a database table.
*/
pub mod chapters;
pub mod course_instance_enrollments;
pub mod course_instances;
pub mod course_language_groups;
pub mod courses;
pub mod email_deliveries;
pub mod email_templates;
mod error;
pub mod exams;
pub mod exercise_service_info;
pub mod exercise_services;
pub mod exercise_slides;
pub mod exercise_tasks;
pub mod exercises;
pub mod feedback;
pub mod gradings;
pub mod organizations;
pub mod page_history;
pub mod pages;
pub mod playground_examples;
pub mod proposed_block_edits;
pub mod proposed_page_edits;
pub mod regrading_submissions;
pub mod regradings;
pub mod roles;
pub mod submissions;
pub mod user_course_settings;
pub mod user_exercise_states;
pub mod users;

#[cfg(test)]
pub mod test_helper;

pub use self::error::{ModelError, ModelResult};
pub use headless_lms_utils as utils;

#[macro_use]
extern crate tracing;
