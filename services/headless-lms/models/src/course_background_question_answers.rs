use crate::{course_background_questions::CourseBackgroundQuestion, prelude::*};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseBackgroundQuestionAnswer {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_background_question_id: Uuid,
    pub answer_value: Option<String>,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewCourseBackgroundQuestionAnswer {
    pub answer_value: Option<String>,
    pub course_background_question_id: Uuid,
}

pub async fn get_background_question_answers_for_background_questions(
    conn: &mut PgConnection,
    user_id: Uuid,
    background_questions: &[CourseBackgroundQuestion],
) -> ModelResult<Vec<CourseBackgroundQuestionAnswer>> {
    let ids = background_questions
        .iter()
        .map(|o| o.id)
        .collect::<Vec<_>>();
    let res: Vec<CourseBackgroundQuestionAnswer> = sqlx::query_as!(
        CourseBackgroundQuestionAnswer,
        r#"
SELECT *
FROM course_background_question_answers
WHERE deleted_at IS NULL
AND user_id = $1
AND course_background_question_id IN (
    SELECT UNNEST($2::uuid [])
  )
  "#,
        user_id,
        &ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn upsert_backround_question_answers(
    conn: &mut PgConnection,
    user_id: Uuid,
    background_question_answers: &[NewCourseBackgroundQuestionAnswer],
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    for answer in background_question_answers {
        sqlx::query!(
            r#"
INSERT INTO course_background_question_answers (
    course_background_question_id,
    user_id,
    answer_value
  )
VALUES ($1, $2, $3) ON CONFLICT (
    course_background_question_id,
    user_id,
    deleted_at
  ) DO
UPDATE
SET answer_value = $3
        "#,
            answer.course_background_question_id,
            user_id,
            answer.answer_value
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(())
}
