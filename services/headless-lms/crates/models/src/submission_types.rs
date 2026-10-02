//! Submission values and validation shared by table writes and grading workflows.

use crate::exercise_task_submissions::AnswerKind;
use crate::prelude::*;
use utoipa::ToSchema;

/// Contains data sent by the student when they make a submission for an exercise slide.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct StudentExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub exercise_task_submissions: Vec<StudentExerciseTaskSubmission>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct StudentExerciseTaskSubmission {
    pub exercise_task_id: Uuid,
    /// Absent means `json`, so a client that only ever answers with JSON never sends it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer_kind: Option<AnswerKind>,
    /// The plugin's own JSON: the whole answer for a `json` answer, the plugin's metadata about the
    /// files for a `file` one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_json: Option<serde_json::Value>,
    /// The uploads that are the answer, in the order they are to be graded and displayed. Every id
    /// must be an upload this user made for this exercise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_files: Option<Vec<Uuid>>,
}

impl StudentExerciseTaskSubmission {
    /// A JSON answer, the shape a submit takes when no files are involved.
    pub fn json(exercise_task_id: Uuid, data: serde_json::Value) -> Self {
        Self {
            exercise_task_id,
            answer_kind: Some(AnswerKind::Json),
            data_json: Some(data),
            data_files: None,
        }
    }

    /// A file answer naming host-stored uploads, in the order they are to be graded and displayed.
    pub fn files(
        exercise_task_id: Uuid,
        data_files: Vec<Uuid>,
        data_json: Option<serde_json::Value>,
    ) -> Self {
        Self {
            exercise_task_id,
            answer_kind: Some(AnswerKind::File),
            data_json,
            data_files: Some(data_files),
        }
    }

    /// The uploads this answer names, empty unless it is a file answer.
    pub fn named_file_ids(&self) -> &[Uuid] {
        match self.answer_kind {
            Some(AnswerKind::File) => self.data_files.as_deref().unwrap_or_default(),
            _ => &[],
        }
    }

    /// The internal form of the answer, rejecting the one combination the flat fields allow but the
    /// answer model does not: a JSON answer that also names files, which would silently drop them.
    pub fn to_submitted_answer(&self) -> ModelResult<SubmittedAnswer> {
        match self.answer_kind.unwrap_or(AnswerKind::Json) {
            AnswerKind::Json => {
                if self.data_files.as_ref().is_some_and(|ids| !ids.is_empty()) {
                    return Err(model_err!(
                        InvalidRequest,
                        "A json answer cannot name uploaded files. Send answer_kind 'file' to submit files.".to_string()
                    ));
                }
                Ok(SubmittedAnswer::Json {
                    data: self.data_json.clone().unwrap_or(serde_json::Value::Null),
                })
            }
            AnswerKind::File => Ok(SubmittedAnswer::File {
                file_upload_ids: self.data_files.clone().unwrap_or_default(),
                metadata: self.data_json.clone(),
            }),
        }
    }
}

/// The answer a student submits for one exercise task, as either JSON or a set of host-stored
/// files.
///
/// Internal: [`StudentExerciseTaskSubmission`] is what a client sends, and converting it here is
/// what validates the combination of its flat fields.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SubmittedAnswer {
    Json {
        data: serde_json::Value,
    },
    File {
        /// Ordered; the order is part of the answer (exercise-file-submission grades by position).
        /// Every id must be an upload this user made for this exercise.
        file_upload_ids: Vec<Uuid>,
        /// The plugin's own JSON about the files. `None` for a plugin whose answer is the files.
        metadata: Option<serde_json::Value>,
    },
}
