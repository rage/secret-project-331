use crate::{exercises::Exercise, prelude::*};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CustomViewExerciseTaskGrading {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub feedback_json: Option<serde_json::Value>,
    pub feedback_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CustomViewExerciseTaskSpec {
    pub id: Uuid,
    pub public_spec: Option<serde_json::Value>,
    pub order_number: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CustomViewExerciseTaskSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub exercise_slide_submission_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub exercise_task_grading_id: Option<Uuid>,
    pub data_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CustomViewExerciseSubmissions {
    pub exercise_tasks: CustomViewExerciseTasks,
    pub exercises: Vec<Exercise>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CustomViewExerciseTasks {
    pub exercise_tasks: Vec<CustomViewExerciseTaskSpec>,
    pub task_submissions: Vec<CustomViewExerciseTaskSubmission>,
    pub task_gradings: Vec<CustomViewExerciseTaskGrading>,
}
