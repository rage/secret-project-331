use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub enum EndQuestionType {
    FreeText,
    NumericRating,
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct CourseModuleEndingQuestionsAnswers {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub question_id: Uuid,
    pub user_id: Uuid,
    pub answer_text_value: Option<String>,
    pub answer_numeric_value: Option<i32>,
}
