/*!
Functions and structs for interacting with the database.

Each submodule corresponds to a database table.
*/
pub mod chapters;
pub mod course_instance_enrollments;
pub mod course_instances;
pub mod course_language_groups;
pub mod course_module_completion_registered_to_study_registries;
pub mod course_module_completions;
pub mod course_modules;
pub mod courses;
pub mod email_deliveries;
pub mod email_templates;
pub mod exams;
pub mod exercise_repositories;
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
pub mod library;
pub mod material_references;
pub mod open_university_registration_links;
pub mod organizations;
pub mod page_history;
pub mod page_visit_datum;
pub mod page_visit_datum_daily_visit_hashing_keys;
pub mod pages;
pub mod peer_review_configs;
pub mod peer_review_question_submissions;
pub mod peer_review_questions;
pub mod peer_review_queue_entries;
pub mod peer_review_submissions;
pub mod pending_roles;
pub mod playground_examples;
pub mod proposed_block_edits;
pub mod proposed_page_edits;
pub mod regradings;
pub mod repository_exercises;
pub mod roles;
pub mod study_registry_registrars;
pub mod teacher_grading_decisions;
pub mod url_redirections;
pub mod user_course_settings;
pub mod user_exercise_slide_states;
pub mod user_exercise_states;
pub mod user_exercise_task_states;
pub mod users;

pub mod error;
pub mod prelude;
#[cfg(test)]
pub mod test_helper;

use uuid::Uuid;

pub use self::error::{ModelError, ModelErrorType, ModelResult};
use crate::prelude::*;

#[macro_use]
extern crate tracing;

/// Helper struct to use with functions that insert data into the database.
pub enum PKeyPolicy<T> {
    /// Ids will be generated based on the associated data. Usually only used in
    /// local test environments where reproducible database states are desired.
    Fixed(T),
    /// Ids will be generated on the database level. This should be the default
    /// behavior.
    Generate,
}

impl<T> PKeyPolicy<T> {
    /// Gets reference to the fixed data, if there are any.
    pub fn fixed(&self) -> Option<&T> {
        match self {
            PKeyPolicy::Fixed(t) => Some(t),
            PKeyPolicy::Generate => None,
        }
    }

    /// Maps `PKeyPolicy<T>` to `PKeyPolicy<U>` by applying a function to the contained value.
    pub fn map<U, F>(self, f: F) -> PKeyPolicy<U>
    where
        F: FnOnce(T) -> U,
    {
        match self {
            PKeyPolicy::Fixed(x) => PKeyPolicy::Fixed(f(x)),
            PKeyPolicy::Generate => PKeyPolicy::Generate,
        }
    }

    /// Maps a reference of contained data in `Fixed(T)` to `PKeyPolicy<U>` by applying a function
    /// to the contained value. This is useful whenever a referenced value can be used instead of
    /// having to consume the original value.
    pub fn map_ref<U, F>(&self, f: F) -> PKeyPolicy<U>
    where
        F: FnOnce(&T) -> U,
    {
        match self {
            PKeyPolicy::Fixed(x) => PKeyPolicy::Fixed(f(x)),
            PKeyPolicy::Generate => PKeyPolicy::Generate,
        }
    }
}

/// Many database tables are related to either a course or an exam
#[derive(Clone, Copy)]
pub enum CourseOrExamId {
    Course(Uuid),
    Exam(Uuid),
}

impl CourseOrExamId {
    pub fn from(course_id: Option<Uuid>, exam_id: Option<Uuid>) -> ModelResult<Self> {
        match (course_id, exam_id) {
            (Some(course_id), None) => Ok(Self::Course(course_id)),
            (None, Some(exam_id)) => Ok(Self::Exam(exam_id)),
            (Some(_), Some(_)) => Err(ModelError::new(
                ModelErrorType::Generic,
                "Database row had both a course id and an exam id".to_string(),
                None,
            )),
            (None, None) => Err(ModelError::new(
                ModelErrorType::Generic,
                "Database row did not have a course id or an exam id".to_string(),
                None,
            )),
        }
    }

    pub fn to_course_and_exam_ids(self) -> (Option<Uuid>, Option<Uuid>) {
        match self {
            Self::Course(instance_id) => (Some(instance_id), None),
            Self::Exam(exam_id) => (None, Some(exam_id)),
        }
    }
    pub fn exam_id(self) -> Option<Uuid> {
        if let CourseOrExamId::Exam(id) = self {
            Some(id)
        } else {
            None
        }
    }
}
