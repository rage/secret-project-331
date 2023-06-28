mod error;

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
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Exercise {
    pub id: Uuid,
    pub name: String,
    pub deadline: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseSlide {
    pub id: Uuid,
    pub exercise_id: Uuid,
    pub deadline: Option<DateTime<Utc>>,
    pub tasks: Vec<ExerciseTask>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseTask {
    pub id: Uuid,
}
