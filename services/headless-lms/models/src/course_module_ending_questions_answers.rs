use std::collections::HashMap;
use utoipa::ToSchema;

use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct CourseModuleEndingQuestionsAnswer {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub question_id: Uuid,
    pub user_id: Uuid,
    pub answer_text_value: Option<String>,
    pub answer_numeric_value: Option<i32>,
}

#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct NewCourseModuleEndingQuestionsAnswer {
    pub question_id: Uuid,
    pub user_id: Uuid,
    pub answer_text_value: Option<String>,
    pub answer_numeric_value: Option<i32>,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: &NewCourseModuleEndingQuestionsAnswer,
) -> ModelResult<CourseModuleEndingQuestionsAnswer> {
    let res = sqlx::query_as!(
        CourseModuleEndingQuestionsAnswer,
        r#"
INSERT INTO course_module_ending_questions_answers (
    question_id,
    user_id,
    answer_text_value,
    answer_numeric_value
  )
VALUES ($1, $2, $3, $4)
RETURNING *
        "#,
        input.question_id,
        input.user_id,
        input.answer_text_value,
        input.answer_numeric_value
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

/* pub async fn user_has_answered_all_questions_for_module_id(
    conn: &mut PgConnection,
    module_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<bool> {
}
 */

pub async fn user_has_answered_all_questions_for_course_indexed_by_module_id(
    conn: &mut PgConnection,
    course_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<HashMap<Uuid, bool>> {
    // todo placeholder
    let res = sqlx::query!(
        r#"
SELECT eq.id, eq.course_module_id FROM course_module_ending_questions AS eq
JOIN course_module_ending_questions_answers AS eqa ON eqa.question_id = eq.id
WHERE eq.course_id = $1 AND eq.deleted_at IS NULL AND eqa.deleted_at IS NULL AND eqa.user_id = $2
GROUP BY eq.course_module_id, eq.id
;

        "#,
        course_id,
        user_id
    )
    .fetch_all(&mut *conn)
    .await?
    .iter()
    .map(|x| (x.id, false))
    .collect::<HashMap<Uuid, bool>>();
    Ok(res)
}
