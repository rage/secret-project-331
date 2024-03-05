/*!
Functions and structs for interacting with the database.

Each submodule corresponds to a database table.
*/
// we always use --document-private-items, so this warning is moot
#![allow(rustdoc::private_intra_doc_links)]
pub mod certificate_configuration_to_requirements;
pub mod certificate_configurations;
pub mod certificate_fonts;
pub mod chapters;
pub mod course_background_question_answers;
pub mod course_background_questions;
pub mod course_exams;
pub mod course_instance_enrollments;
pub mod course_instances;
pub mod course_language_groups;
pub mod course_module_completion_registered_to_study_registries;
pub mod course_module_completions;
pub mod course_modules;
pub mod courses;
pub mod email_deliveries;
pub mod email_templates;
pub mod ended_processed_exams;
pub mod exams;
pub mod exercise_language_groups;
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
pub mod file_uploads;
pub mod generated_certificates;
pub mod glossary;
pub mod last_time_visited_course_materials;
pub mod library;
pub mod material_references;
pub mod offered_answers_to_peer_review_temporary;
pub mod open_university_registration_links;
pub mod organizations;
pub mod other_domain_to_course_redirections;
pub mod page_audio_files;
pub mod page_history;
pub mod page_language_groups;
pub mod page_visit_datum;
pub mod page_visit_datum_daily_visit_hashing_keys;
pub mod page_visit_datum_summary_by_courses;
pub mod page_visit_datum_summary_by_courses_countries;
pub mod page_visit_datum_summary_by_courses_device_types;
pub mod page_visit_datum_summary_by_pages;
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
pub mod research_forms;
pub mod roles;
pub mod student_countries;
pub mod study_registry_registrars;
pub mod teacher_grading_decisions;
pub mod url_redirections;
pub mod user_course_instance_exercise_service_variables;
pub mod user_course_settings;
pub mod user_details;
pub mod user_exercise_slide_states;
pub mod user_exercise_states;
pub mod user_exercise_task_states;
pub mod user_research_consents;
pub mod users;

pub mod error;

pub mod prelude;
#[cfg(test)]
pub mod test_helper;

use futures::future::BoxFuture;
use url::Url;
use uuid::Uuid;

pub use self::error::{ModelError, ModelErrorType, ModelResult};
use crate::prelude::*;

#[macro_use]
extern crate tracing;

/**
Helper struct to use with functions that insert data into the database.

## Examples

### Usage when inserting to a database

By calling `.into_uuid()` function implemented by `PKeyPolicy<Uuid>`, this enum can be used with
SQLX queries while letting the caller dictate how the primary key should be decided.

```no_run
# use headless_lms_models::{ModelResult, PKeyPolicy};
# use uuid::Uuid;
# use sqlx::PgConnection;
async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "INSERT INTO organizations (id) VALUES ($1) RETURNING id",
        pkey_policy.into_uuid(),
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

# async fn random_function(conn: &mut PgConnection) -> ModelResult<()> {
// Insert using generated id.
let foo_1_id = insert(conn, PKeyPolicy::Generate).await.unwrap();

// Insert using fixed id.
let uuid = Uuid::parse_str("8fce44cf-738e-4fc9-8d8e-47c350fd3a7f").unwrap();
let foo_2_id = insert(conn, PKeyPolicy::Fixed(uuid)).await.unwrap();
assert_eq!(foo_2_id, uuid);
# Ok(())
# }
```

### Usage in a higher-order function.

When `PKeyPolicy` is used with a higher-order function, an arbitrary struct can be provided
instead. The data can be mapped further by calling the `.map()` or `.map_ref()` methods.

```no_run
# use headless_lms_models::{ModelResult, PKeyPolicy};
# use uuid::Uuid;
# use sqlx::PgConnection;
# mod foos {
#   use headless_lms_models::{ModelResult, PKeyPolicy};
#   use uuid::Uuid;
#   use sqlx::PgConnection;
#   pub async fn insert(conn: &mut PgConnection, pkey_policy: PKeyPolicy<Uuid>) -> ModelResult<()> {
#       Ok(())
#   }
# }
# mod bars {
#   use headless_lms_models::{ModelResult, PKeyPolicy};
#   use uuid::Uuid;
#   use sqlx::PgConnection;
#   pub async fn insert(conn: &mut PgConnection, pkey_policy: PKeyPolicy<Uuid>) -> ModelResult<()> {
#       Ok(())
#   }
# }

struct FooBar {
    foo: Uuid,
    bar: Uuid,
}

async fn multiple_inserts(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<FooBar>,
) -> ModelResult<()> {
    foos::insert(conn, pkey_policy.map_ref(|x| x.foo)).await?;
    bars::insert(conn, pkey_policy.map_ref(|x| x.bar)).await?;
    Ok(())
}

# async fn some_function(conn: &mut PgConnection) {
// Insert using generated ids.
assert!(multiple_inserts(conn, PKeyPolicy::Generate).await.is_ok());

// Insert using fixed ids.
let foobar = FooBar {
    foo: Uuid::parse_str("52760668-cc9d-4144-9226-d2aacb83bea9").unwrap(),
    bar: Uuid::parse_str("ce9bd0cd-0e66-4522-a1b4-52a9347a115c").unwrap(),
};
assert!(multiple_inserts(conn, PKeyPolicy::Fixed(foobar)).await.is_ok());
# }
```
*/
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

impl PKeyPolicy<Uuid> {
    /// Maps into the contained `Uuid` value or generates a new one.
    pub fn into_uuid(self) -> Uuid {
        match self {
            PKeyPolicy::Fixed(uuid) => uuid,
            PKeyPolicy::Generate => Uuid::new_v4(),
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

/// A "trait alias" so this `for<'a>` ... string doesn't need to be repeated everywhere
/// Arguments:
///   `Url`: The URL that the request is sent to (the exercise service's endpoint)
///   `&str`: Exercise type/service slug
///   `Option<Value>`: The Json for the request, for example the private spec in a public spec request
pub trait SpecFetcher:
    for<'a> Fn(
    Url,
    &'a str,
    Option<&'a serde_json::Value>,
) -> BoxFuture<'a, ModelResult<serde_json::Value>>
{
}

impl<
        T: for<'a> Fn(
            Url,
            &'a str,
            Option<&'a serde_json::Value>,
        ) -> BoxFuture<'a, ModelResult<serde_json::Value>>,
    > SpecFetcher for T
{
}
