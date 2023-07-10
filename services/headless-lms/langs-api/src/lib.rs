mod error;
pub mod exercise_services;

use chrono::{DateTime, Utc};
pub use error::ErrorResponse;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use uuid::Uuid;

pub type Token =
    oauth2::StandardTokenResponse<oauth2::EmptyExtraTokenFields, oauth2::basic::BasicTokenType>;

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseInstance {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_slug: String,
    pub course_name: String,
    pub course_description: Option<String>,
    pub instance_name: Option<String>,
    pub instance_description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseSlide {
    pub slide_id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_name: String,
    pub exercise_order_number: i32,
    pub deadline: Option<DateTime<Utc>>,
    pub tasks: Vec<ExerciseTask>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseTask {
    pub task_id: Uuid,
    pub order_number: i32,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub model_solution_spec: Option<serde_json::Value>,
    pub exercise_service_slug: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub exercise_task_submissions: Vec<ExerciseTaskSubmission>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseTaskSubmission {
    pub exercise_task_id: Uuid,
    pub data_json: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseSlideSubmissionResult {}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadMetadata {
    pub slide_id: Uuid,
    pub task_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResult {
    pub download_url: String,
}
