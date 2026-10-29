//! Exercise task and review instructions (own or course default's) as block documents, edited
//! by the engines like pages under an id of their own.

use std::sync::{Arc, LazyLock};

use headless_lms_models::library::agent_changesets::course_state::{
    CourseState, ExerciseRecord, ExerciseReviewConfig, review_instructions_for_storage,
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use headless_lms_utils::strings::decode_html_entities;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::engine::{Document, DocumentKey, EditError, EditErrorCode, PageDocument, PageType};
use crate::validator::ExerciseContext;
use headless_lms_utils::strings::escape_html_text;

/// One list of instruction blocks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum InstructionsList {
    Task {
        exercise_id: Uuid,
        task_id: Uuid,
    },
    /// The exercise's own review instructions.
    Review {
        exercise_id: Uuid,
    },
    /// The course default review config's instructions, shared by every exercise using it.
    CourseDefaultReview {
        config_id: Uuid,
    },
}

impl InstructionsList {
    /// The id the list's document goes by in the engines: the task's, the exercise's or the
    /// default config's, which no page shares.
    pub fn document_id(self) -> Uuid {
        match self {
            InstructionsList::Task { task_id, .. } => task_id,
            InstructionsList::Review { exercise_id } => exercise_id,
            InstructionsList::CourseDefaultReview { config_id } => config_id,
        }
    }

    /// The path `patch_exercise` and `get_exercise` address the list's top level with.
    pub fn path_prefix(self) -> String {
        match self {
            InstructionsList::Task { task_id, .. } => format!("/tasks/{task_id}"),
            InstructionsList::Review { .. } | InstructionsList::CourseDefaultReview { .. } => {
                "/review_instructions".to_string()
            }
        }
    }

    /// The exercise the list belongs to; `None` for the course default's.
    pub fn exercise_id(self) -> Option<Uuid> {
        match self {
            InstructionsList::Task { exercise_id, .. }
            | InstructionsList::Review { exercise_id } => Some(exercise_id),
            InstructionsList::CourseDefaultReview { .. } => None,
        }
    }

    /// Where the list is, for results.
    pub fn location(self) -> InstructionsLocation {
        InstructionsLocation {
            exercise: self.exercise_id(),
            instructions: self.path_prefix(),
            course_default_review_config: matches!(
                self,
                InstructionsList::CourseDefaultReview { .. }
            ),
        }
    }

    /// The page holding the list's exercise in `state`; `None` for the course default's.
    pub fn page(self, state: &CourseState) -> Option<Uuid> {
        state.exercise_page_id(self.exercise_id()?)
    }

    /// What the list's blocks are validated as the children of.
    pub fn validation_context(self) -> ExerciseContext {
        match self {
            InstructionsList::Task { .. } => ExerciseContext::TaskInstructions,
            InstructionsList::Review { .. } | InstructionsList::CourseDefaultReview { .. } => {
                ExerciseContext::ReviewInstructions
            }
        }
    }

    /// The stored blocks of the list in `state`; `None` if the state doesn't have it.
    fn stored_blocks(self, state: &CourseState) -> Option<Option<&Value>> {
        match self {
            InstructionsList::Task {
                exercise_id,
                task_id,
            } => state
                .exercise(exercise_id)?
                .tasks
                .iter()
                .find(|task| task.id == task_id)
                .map(|task| Some(task.assignment.as_ref())),
            InstructionsList::Review { exercise_id } => {
                match &state.exercise(exercise_id)?.review_config {
                    ExerciseReviewConfig::Own {
                        review_instructions,
                        ..
                    } => Some(review_instructions.as_deref()),
                    _ => None,
                }
            }
            InstructionsList::CourseDefaultReview { config_id } => state
                .course_default_review_config
                .as_ref()
                .filter(|config| config.id == config_id)
                .map(|config| config.review_instructions.as_ref()),
        }
    }

    /// The list in `state` as a document; `None` if the state doesn't have it.
    pub fn document(self, state: &CourseState) -> Option<Result<PageDocument, EditError>> {
        let stored = self.stored_blocks(state)?;
        Some(parse_blocks(stored).map(|blocks| PageDocument {
            page_id: self.document_id(),
            page_type: PageType::CoursePage,
            blocks,
        }))
    }

    /// Sets the list's blocks in `state`. Review instructions without content are stored as `null`,
    /// as the editors store them.
    pub fn set_blocks(self, state: &mut CourseState, blocks: &[GutenbergBlock]) {
        let value = serde_json::to_value(blocks).unwrap_or(Value::Array(Vec::new()));
        match self {
            InstructionsList::Task {
                exercise_id,
                task_id,
            } => {
                if let Some(task) = state
                    .exercise_mut(exercise_id)
                    .and_then(|exercise| exercise.tasks.iter_mut().find(|task| task.id == task_id))
                {
                    task.assignment = Arc::new(value);
                }
            }
            InstructionsList::Review { exercise_id } => {
                if let Some(ExerciseReviewConfig::Own {
                    review_instructions,
                    ..
                }) = state
                    .exercise_mut(exercise_id)
                    .map(|exercise| &mut exercise.review_config)
                {
                    *review_instructions = review_instructions_for_storage(value).map(Arc::new);
                }
            }
            InstructionsList::CourseDefaultReview { config_id } => {
                if let Some(config) = state
                    .course_default_review_config
                    .as_mut()
                    .filter(|config| config.id == config_id)
                {
                    config.review_instructions = review_instructions_for_storage(value);
                }
            }
        }
    }
}

static MARKUP: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<[a-zA-Z/!]").expect("a constant pattern the unit tests compile")
});

/// The name as stored: trimmed, non-empty plain text on one line.
pub fn checked_name(name: &str) -> Result<String, EditError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.contains(['\n', '\r']) || MARKUP.is_match(trimmed) {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            "an exercise name is non-empty plain text on one line, without markup",
        ));
    }
    Ok(trimmed.to_string())
}

/// The blocks of stored instructions; `null` is no blocks. Errors if they aren't blocks.
pub fn parse_blocks(stored: Option<&Value>) -> Result<Vec<GutenbergBlock>, EditError> {
    match stored {
        None | Some(Value::Null) => Ok(Vec::new()),
        Some(value) => Vec::<GutenbergBlock>::deserialize(value).map_err(|e| {
            EditError::new(
                EditErrorCode::InvalidValue,
                format!("the stored instructions aren't blocks the server can edit: {e}"),
            )
            .with_fix("ask the teacher to edit these instructions in the editor")
        }),
    }
}

/// The review instructions an exercise shows: its own, or the course default's. `None` when it
/// has no peer or self reviews.
pub fn review_list(state: &CourseState, exercise: &ExerciseRecord) -> Option<InstructionsList> {
    if !exercise.has_reviews() {
        return None;
    }
    match &exercise.review_config {
        ExerciseReviewConfig::Own { .. } => Some(InstructionsList::Review {
            exercise_id: exercise.id,
        }),
        ExerciseReviewConfig::CourseDefault => {
            state.course_default_review_config.as_ref().map(|config| {
                InstructionsList::CourseDefaultReview {
                    config_id: config.id,
                }
            })
        }
        ExerciseReviewConfig::Unset => None,
    }
}

/// The instruction lists that differ from `before`, by exercise id and then the course default's.
/// Lists `before` lacks count as changed whole.
pub fn changed_lists(before: &CourseState, after: &CourseState) -> Vec<InstructionsList> {
    let mut lists = Vec::new();
    for exercise_id in after.exercises_changed_since(before) {
        let (Some(exercise), Some(before_exercise)) =
            (after.exercise(exercise_id), before.exercise(exercise_id))
        else {
            continue;
        };
        for task in &exercise.tasks {
            let before_task = before_exercise.tasks.iter().find(|t| t.id == task.id);
            if before_task.is_none_or(|before_task| before_task.assignment != task.assignment) {
                lists.push(InstructionsList::Task {
                    exercise_id,
                    task_id: task.id,
                });
            }
        }
        if let ExerciseReviewConfig::Own {
            review_instructions,
            ..
        } = &exercise.review_config
        {
            let before_instructions = match &before_exercise.review_config {
                ExerciseReviewConfig::Own {
                    review_instructions,
                    ..
                } => Some(review_instructions),
                _ => None,
            };
            if before_instructions != Some(review_instructions) {
                lists.push(InstructionsList::Review { exercise_id });
            }
        }
    }
    if let Some(config) = &after.course_default_review_config
        && before.course_default_review_config.as_ref() != Some(config)
    {
        lists.push(InstructionsList::CourseDefaultReview {
            config_id: config.id,
        });
    }
    lists
}

/// The instruction lists of the exercises on `page_ids`, in page and block order, and the course
/// default's when `with_course_default` or when one of those exercises uses it. Review
/// instructions count only for exercises with reviews.
pub fn lists_of_pages(
    state: &CourseState,
    page_ids: &[Uuid],
    with_course_default: bool,
) -> Vec<InstructionsList> {
    let mut lists = Vec::new();
    let mut uses_course_default = false;
    for page_id in page_ids {
        let Some(page) = state.page(*page_id) else {
            continue;
        };
        for exercise_id in page.content.iter().filter_map(|b| b.exercise_id()) {
            let Some(exercise) = state.exercise(exercise_id) else {
                continue;
            };
            lists.extend(exercise.tasks.iter().map(|task| InstructionsList::Task {
                exercise_id,
                task_id: task.id,
            }));
            match review_list(state, exercise) {
                Some(InstructionsList::CourseDefaultReview { .. }) => uses_course_default = true,
                Some(list) => lists.push(list),
                None => {}
            }
        }
    }
    if (with_course_default || uses_course_default)
        && let Some(config) = &state.course_default_review_config
    {
        lists.push(InstructionsList::CourseDefaultReview {
            config_id: config.id,
        });
    }
    lists
}

/// Where an instruction list is, for results: its exercise and the path `patch_exercise` takes.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct InstructionsLocation {
    /// `None` for the course default review instructions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exercise: Option<Uuid>,
    /// The list's top level, e.g. `/tasks/<task id>`.
    pub instructions: String,
    /// Whether the list is the course default review config's, which every exercise without its
    /// own review settings shows.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub course_default_review_config: bool,
}

/// Which exercise text [`text_documents`] includes.
#[derive(Debug, Clone, Copy)]
pub struct ExerciseTextParts {
    pub instructions: bool,
    /// The course default review instructions even when no exercise in scope uses them; only
    /// with `instructions`.
    pub course_default: bool,
    pub names: bool,
}

/// Exercise text on `page_ids` for the course-wide engines: instruction lists (the course
/// default's too when an exercise uses it; unparseable lists skipped) and names, as `parts`
/// picks. Names are one paragraph each, escaped like rich text so entities read as on pages.
pub fn text_documents(
    state: &CourseState,
    page_ids: &[Uuid],
    parts: ExerciseTextParts,
) -> Vec<Document> {
    let mut documents = Vec::new();
    if parts.instructions {
        let exercise_pages = state.exercise_page_ids();
        for list in lists_of_pages(state, page_ids, parts.course_default) {
            if let Some(Ok(document)) = list.document(state) {
                let page_id = list
                    .exercise_id()
                    .and_then(|exercise_id| exercise_pages.get(&exercise_id).copied());
                documents.push(Document {
                    key: DocumentKey::Instructions { list, page_id },
                    page_type: document.page_type,
                    blocks: document.blocks,
                });
            }
        }
    }
    if parts.names {
        for page_id in page_ids {
            let Some(page) = state.page(*page_id) else {
                continue;
            };
            for exercise_id in page.content.iter().filter_map(|b| b.exercise_id()) {
                if let Some(exercise) = state.exercise(exercise_id) {
                    documents.push(Document {
                        key: DocumentKey::ExerciseName {
                            exercise_id,
                            page_id: *page_id,
                        },
                        page_type: PageType::CoursePage,
                        blocks: vec![
                            GutenbergBlock::paragraph(&escape_html_text(&exercise.name))
                                .with_id(exercise_id),
                        ],
                    });
                }
            }
        }
    }
    documents
}

/// Writes documents a course-wide engine changed into `after`: page blocks, instruction lists and
/// exercise names. Errors if a name would no longer be a valid one.
pub fn apply_documents(after: &mut CourseState, changed: Vec<Document>) -> Result<(), EditError> {
    for document in changed {
        match document.key {
            DocumentKey::Page(page_id) => {
                if let Some(page) = after.page_mut(page_id) {
                    page.content = Arc::new(document.blocks);
                }
            }
            DocumentKey::Instructions { list, .. } => list.set_blocks(after, &document.blocks),
            DocumentKey::ExerciseName { exercise_id, .. } => {
                let name = document
                    .blocks
                    .first()
                    .and_then(|block| block.attributes.get("content"))
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let name =
                    checked_name(&decode_html_entities(name)).map_err(|error| EditError {
                        message: format!("exercise {exercise_id}: {}", error.message),
                        ..error
                    })?;
                if let Some(exercise) = after.exercise_mut(exercise_id) {
                    exercise.name = name;
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "instruction_lists_tests.rs"]
mod tests;
