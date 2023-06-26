mod error;

pub use error::ErrorResponse;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct Login {
    pub email: String,
    pub password: String,
}

impl Debug for Login {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Login")
            .field("email", &self.email)
            .field("password", &"[redacted]")
            .finish()
    }
}

pub type Token =
    oauth2::StandardTokenResponse<oauth2::EmptyExtraTokenFields, oauth2::basic::BasicTokenType>;

#[derive(Debug, Serialize, Deserialize)]
pub struct Organization {
    pub name: String,
    pub description: String,
    pub slug: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Course {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseInstance {
    pub id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseInstanceEnrollmentBackgroundQuestion {
    pub id: Uuid,
    pub course_instance_id: Uuid,
    pub course_id: Uuid,
    pub question_text: String,
    pub question_type: CourseBackgroundQuestionType,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum CourseBackgroundQuestionType {
    Checkbox,
    Text,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseInstanceEnrollment {
    pub course_instance_id: Uuid,
    pub background_question_answers: Vec<CourseInstanceEnrollmentBackgroundQuestionAnswer>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseInstanceEnrollmentBackgroundQuestionAnswer {
    pub question_id: Uuid,
    pub answer: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Exercise {
    pub id: Uuid,
}
