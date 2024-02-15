use crate::{
    course_background_question_answers::CourseBackgroundQuestionAnswer,
    course_instances::CourseInstance, prelude::*,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Type)]
#[sqlx(
    type_name = "course_background_question_type",
    rename_all = "snake_case"
)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum CourseBackgroundQuestionType {
    Checkbox,
    Text,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseBackgroundQuestion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_instance_id: Option<Uuid>,
    pub course_id: Uuid,
    pub question_text: String,
    pub question_type: CourseBackgroundQuestionType,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseBackgroundQuestionsAndAnswers {
    pub background_questions: Vec<CourseBackgroundQuestion>,
    pub answers: Vec<CourseBackgroundQuestionAnswer>,
}

/// Return all background questions that will need to be asked when the user enrolls on a course instance. Includes both instance specific questions and course specific questions.
pub async fn get_background_questions_for_course_instance(
    conn: &mut PgConnection,
    course_instance: &CourseInstance,
) -> ModelResult<Vec<CourseBackgroundQuestion>> {
    let res: Vec<CourseBackgroundQuestion> = sqlx::query_as!(
        CourseBackgroundQuestion,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_instance_id,
  course_id,
  question_text,
  question_type as "question_type: CourseBackgroundQuestionType"
FROM course_background_questions
WHERE deleted_at IS NULL
  AND (
    (
      course_instance_id IS NULL
      AND course_id = $1
    )
    OR (
      course_instance_id = $2
      AND course_id = $1
    )
  )
  "#,
        course_instance.course_id,
        course_instance.id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Return all background questions (and existing answers) that will need to be asked when the user enrolls on a course instance. Includes both instance specific questions and course specific questions.
pub async fn get_background_questions_and_answers(
    conn: &mut PgConnection,
    course_instance: &CourseInstance,
    user_id: Uuid,
) -> ModelResult<CourseBackgroundQuestionsAndAnswers> {
    let background_questions =
        get_background_questions_for_course_instance(&mut *conn, course_instance).await?;
    let answers = crate::course_background_question_answers::get_background_question_answers_for_background_questions(&mut *conn, user_id, &background_questions).await?;
    Ok(CourseBackgroundQuestionsAndAnswers {
        background_questions,
        answers,
    })
}
