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
    pub answer_select_value: Option<String>,
    pub answer_multi_select_value: Option<Vec<String>>,
}

#[derive(Clone, PartialEq, Deserialize, Debug, Serialize, ToSchema)]
pub struct NewCourseModuleEndingQuestionsAnswer {
    pub question_id: Uuid,
    pub answer_text_value: Option<String>,
    pub answer_select_value: Option<String>,
    pub answer_multi_select_value: Option<Vec<String>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: &Uuid,
    input: &NewCourseModuleEndingQuestionsAnswer,
) -> ModelResult<CourseModuleEndingQuestionsAnswer> {
    // todo validate!!!!!

    let res = sqlx::query_as!(
        CourseModuleEndingQuestionsAnswer,
        r#"
INSERT INTO course_module_ending_questions_answers (
    question_id,
    user_id,
    answer_text_value,
    answer_select_value,
    answer_multi_select_value
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
        "#,
        input.question_id,
        user_id,
        input.answer_text_value,
        input.answer_select_value,
        input.answer_multi_select_value.as_deref()
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn insert_many(
    conn: &mut PgConnection,
    user_id: &Uuid,
    input: Vec<NewCourseModuleEndingQuestionsAnswer>,
) -> ModelResult<CourseModuleEndingQuestionsAnswer> {
    let question_ids = input.iter().map(|x| x.question_id).collect();
    let answer_text_values = input.iter().map(|x| x.answer_text_value).collect();
    let answer_select_values = input.iter().map(|x| x.answer_select_value).collect();
    let answer_multi_select_values = input.iter().map(|x| x.answer_multi_select_value).collect();
    // todo validate!!!!!

    let res = sqlx::query_as!(
        CourseModuleEndingQuestionsAnswer,
        r#"
INSERT INTO course_module_ending_questions_answers (
    user_id,
    question_id,
    answer_text_value,
    answer_select_value,
    answer_multi_select_value
  )
SELECT $1,
  input.question_id,
  input.answer_text_value,
  input.answer_select_value,
  input.answer_multi_select_value
FROM (
    SELECT UNNEST($2::UUID []) question_id,
      UNNEST($3::TEXT []) answer_text_value,
      UNNEST($4::TEXT []) answer_select_value,
      UNNEST($5::TEXT [] []) answer_multi_select_value,
  ) AS input
RETURNING *
        "#,
        user_id,
        question_ids,
        answer_text_values,
        answert_select_values,
        answer_multi_select_values,
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
