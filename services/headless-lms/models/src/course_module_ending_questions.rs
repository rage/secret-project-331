use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub enum EndQuestionType {
    FreeText,
    NumericRating,
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct CourseModuleEndingQuestions {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub question_text: String,
    pub question_type: EndQuestionType,
    pub rating_options_n: Option<i32>,
    pub rating_labels: Option<Vec<String>>,
}
