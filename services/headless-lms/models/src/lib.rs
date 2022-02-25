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
pub mod exams;
pub mod exercise_service_info;
pub mod exercise_services;
pub mod exercise_slide_submissions;
pub mod exercise_slides;
pub mod exercise_task_gradings;
pub mod exercise_task_regrading_submissions;
pub mod exercise_task_submissions;
pub mod exercise_tasks;
pub mod exercises;
pub mod feedback;
pub mod glossary;
pub mod organizations;
pub mod page_history;
pub mod pages;
pub mod playground_examples;
pub mod proposed_block_edits;
pub mod proposed_page_edits;
pub mod regradings;
pub mod roles;
pub mod url_redirections;
pub mod user_course_settings;
pub mod user_exercise_states;
pub mod users;

mod error;
mod prelude;
#[cfg(test)]
pub mod test_helper;

use uuid::Uuid;

pub use self::error::{ModelError, ModelResult};

#[macro_use]
extern crate tracing;

/// Many database tables are related to either a course or an exam
pub enum CourseOrExamId {
    Course(Uuid),
    Exam(Uuid),
}

impl CourseOrExamId {
    pub fn from(course_id: Option<Uuid>, exam_id: Option<Uuid>) -> ModelResult<Self> {
        match (course_id, exam_id) {
            (Some(course_id), None) => Ok(Self::Course(course_id)),
            (None, Some(exam_id)) => Ok(Self::Exam(exam_id)),
            (Some(_), Some(_)) => Err(ModelError::Generic(
                "Database row had both a course id and an exam id".to_string(),
            )),
            (None, None) => Err(ModelError::Generic(
                "Database row did not have a course id or an exam id".to_string(),
            )),
        }
    }
}
