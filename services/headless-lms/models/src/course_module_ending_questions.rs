use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Clone, PartialEq, Deserialize, Serialize, Type, ToSchema)]
#[sqlx(type_name = "end_question_type", rename_all = "kebab-case")]
pub enum EndQuestionType {
    FreeText,
    NumericRating,
}

#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct CourseModuleEndingQuestion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Option<Uuid>,
    pub course_module_id: Option<Uuid>,
    pub question_serial_number: i32,
    pub question_text: String,
    pub question_free_text_instruction: Option<String>,
    pub select_labels: Option<Vec<String>>,
    pub multi_select_labels: Option<Vec<String>>,
}

pub async fn get_by_course_module_id(
    conn: &mut PgConnection,
    course_module_id: &Uuid,
) -> ModelResult<Vec<CourseModuleEndingQuestion>> {
    let res: Vec<CourseModuleEndingQuestion> = sqlx::query_as!(
        CourseModuleEndingQuestion,
        r#"
SELECT *
FROM course_module_ending_questions
WHERE course_module_id = $1 OR course_id IS NULL
    AND deleted_at IS NULL
        "#,
        course_module_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
