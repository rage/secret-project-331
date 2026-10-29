//! The exercise tools: `get_exercise` and `patch_exercise` read and edit an exercise's name, own
//! deadline, task instructions and review instructions, and `list_exercises` lists a course's
//! exercises. Everything else of an exercise is read-only for agents.

mod get;
mod list;
mod patch;
mod paths;
mod review_config;
mod specs;

use chrono::{DateTime, Utc};
use headless_lms_models::library::agent_changesets::course_state::{CourseState, CourseView};
use serde::Serialize;
use uuid::Uuid;

use crate::access::{connection, open_course};
use crate::state::McpState;
use crate::tools::{RequestContext, ToolError};

pub use get::GetExercise;
pub use list::ListExercises;
pub use patch::PatchExercise;

const REVIEW_INSTRUCTIONS: &str = "review_instructions";

/// The course with the records of the exercises on the pages holding `exercise_id` loaded.
async fn open_course_with_exercise(
    state: &McpState,
    ctx: &RequestContext,
    course_id: Uuid,
    exercise_id: Uuid,
) -> Result<CourseView, ToolError> {
    let mut view = open_course(state, ctx, course_id).await?;
    let page_ids: Vec<Uuid> = [
        view.staged.exercise_page_id(exercise_id),
        view.live.exercise_page_id(exercise_id),
    ]
    .into_iter()
    .flatten()
    .collect();
    view.load_exercises_on_pages(&mut *connection(state).await?, &page_ids)
        .await?;
    Ok(view)
}

fn missing_exercise(view: &CourseView, exercise_id: Uuid) -> ToolError {
    ToolError::NotFound {
        message: format!(
            "course {} has no exercise {exercise_id} on its pages; exercise blocks in get_page_content show exercise ids, and exam exercises can't be edited here",
            view.course.id
        ),
    }
}

/// An exercise's own deadline and the one that applies to it, its chapter's without an own one.
#[derive(Serialize)]
struct ExerciseDeadline {
    own: Option<DateTime<Utc>>,
    effective: Option<DateTime<Utc>>,
}

impl ExerciseDeadline {
    fn of(state: &CourseState, exercise_id: Uuid) -> Self {
        Self {
            own: state.exercise(exercise_id).and_then(|e| e.deadline),
            effective: state.effective_exercise_deadline(exercise_id),
        }
    }
}
