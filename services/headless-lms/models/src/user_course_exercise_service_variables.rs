use std::collections::HashMap;

use crate::{exercise_tasks::ExerciseTask, prelude::*, user_exercise_states::UserExerciseState};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCourseExerciseServiceVariable {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_service_slug: String,
    pub user_id: Uuid,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub variable_key: String,
    pub variable_value: serde_json::Value,
}

pub(crate) async fn get_all_variables_for_user_and_course_or_exam(
    conn: &mut PgConnection,
    user_id: Uuid,
    instance_or_exam_id: CourseOrExamId,
) -> ModelResult<Vec<UserCourseExerciseServiceVariable>> {
    let (course_id, exam_id) = instance_or_exam_id.to_course_and_exam_ids();
    let res = sqlx::query_as!(
        UserCourseExerciseServiceVariable,
        r#"
SELECT *
FROM user_course_exercise_service_variables
WHERE deleted_at IS NULL
  AND user_id = $1
  AND (course_id = $2 OR course_id IS NULL)
  AND (exam_id = $3 OR exam_id IS NULL);
    "#,
        user_id,
        course_id,
        exam_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_user_variables_for_user_and_course_and_exercise_type(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    exercise_type: &str,
) -> ModelResult<Vec<UserCourseExerciseServiceVariable>> {
    let res = sqlx::query_as!(
        UserCourseExerciseServiceVariable,
        r#"
SELECT *
FROM user_course_exercise_service_variables
WHERE deleted_at IS NULL
  AND user_id = $1
  AND course_id = $2
  AND exercise_service_slug = $3;
    "#,
        user_id,
        course_id,
        exercise_type
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub(crate) async fn insert_after_exercise_task_graded(
    conn: &mut PgConnection,
    set_user_variables: &Option<HashMap<String, serde_json::Value>>,
    exercise_task: &ExerciseTask,
    user_exercise_state: &UserExerciseState,
) -> ModelResult<()> {
    if let Some(set_user_variables) = set_user_variables {
        for (k, v) in set_user_variables {
            sqlx::query!(
                r#"
INSERT INTO user_course_exercise_service_variables (
    exercise_service_slug,
    user_id,
    course_id,
    exam_id,
    variable_key,
    variable_value
  )
VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (
    variable_key,
    user_id,
    course_id,
    exercise_service_slug,
    exam_id,
    deleted_at
  ) DO
UPDATE
SET variable_value = $6;
    "#,
                exercise_task.exercise_type,
                user_exercise_state.user_id,
                user_exercise_state.course_id,
                user_exercise_state.exam_id,
                k,
                v
            )
            .execute(&mut *conn)
            .await?;
        }
        Ok(())
    } else {
        Ok(())
    }
}
