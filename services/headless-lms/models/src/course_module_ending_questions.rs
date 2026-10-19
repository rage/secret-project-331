use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize, Type)]
#[sqlx(type_name = "end_question_type", rename_all = "kebab-case")]
pub enum EndQuestionType {
    FreeText,
    NumericRating,
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct CourseModuleEndingQuestion {
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

pub async fn get_by_course_module_id(
    conn: &mut PgConnection,
    course_module_id: &Uuid,
) -> ModelResult<Vec<CourseModuleEndingQuestion>> {
    let res: Vec<CourseModuleEndingQuestion> = sqlx::query_as!(
        CourseModuleEndingQuestion,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    course_id,
    course_module_id,
    question_text,
    question_type as "question_type: EndQuestionType",
    rating_options_n,
    rating_labels
FROM course_module_ending_questions
WHERE course_module_id = $1
    AND deleted_at IS NULL
        "#,
        course_module_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
