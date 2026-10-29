//! A course's editable content held in memory: as published, or as the user sees it with their
//! open changeset laid over it.

mod blockers;
mod records;
mod state;
mod view;

pub use blockers::PublishBlocker;
pub(crate) use records::copy_course_default_review_config;
pub use records::{
    ExerciseDeadline, ExerciseEditError, ExerciseRecord, ExerciseReviewConfig, ExerciseTaskRecord,
    PageRecord, ReviewConfigKind, review_instructions_for_storage,
};
pub use state::{CourseParts, CourseState, StagedEntity, StateChanges, load_live_course};
pub use view::{CourseView, load_view};
