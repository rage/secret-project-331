use crate::{
    exercise_task_submissions::{AnswerFile, AnswerKind},
    exercises::Exercise,
    prelude::*,
    user_course_exercise_service_variables::UserCourseExerciseServiceVariable,
};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CustomViewExerciseTaskGrading {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub feedback_json: Option<serde_json::Value>,
    pub feedback_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CustomViewExerciseTaskSpec {
    pub id: Uuid,
    pub public_spec: Option<serde_json::Value>,
    pub order_number: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CustomViewExerciseTaskSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub exercise_slide_submission_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub exercise_task_grading_id: Option<Uuid>,
    pub answer_kind: AnswerKind,
    /// The plugin's own JSON: the whole answer for a `json` answer, the plugin's metadata about the
    /// files for a `file` one. A custom view is handed this row as its `user_answer`, so this is
    /// where a plugin reads the answer from.
    pub data_json: Option<serde_json::Value>,
    /// The files the answer consists of, in grading order. Omitted when it has none.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_files: Option<Vec<AnswerFile>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CustomViewExerciseSubmissions {
    pub exercise_tasks: CustomViewExerciseTasks,
    pub exercises: Vec<Exercise>,
    pub user_variables: Vec<UserCourseExerciseServiceVariable>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CustomViewExerciseTasks {
    pub exercise_tasks: Vec<CustomViewExerciseTaskSpec>,
    pub task_submissions: Vec<CustomViewExerciseTaskSubmission>,
    pub task_gradings: Vec<CustomViewExerciseTaskGrading>,
}
