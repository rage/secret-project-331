use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct TeacherGradingDecision {
    pub id: Uuid,
    pub user_exercise_state_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_given: f32,
    pub teacher_decision: TeacherDecisionType,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "teacher_decision_type", rename_all = "kebab-case")]
pub enum TeacherDecisionType {
    FullPoints,
    ZeroPoints,
    CustomPoints,
    SuspectedPlagiarism,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewTeacherGradingDecision {
    pub user_exercise_state_id: Uuid,
    pub exercise_id: Uuid,
    pub action: TeacherDecisionType,
    pub manual_points: Option<f32>,
}

pub async fn add_teacher_grading_decision(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    action: TeacherDecisionType,
    score_given: f32,
    decision_maker_user_id: Option<Uuid>,
) -> ModelResult<TeacherGradingDecision> {
    let res = sqlx::query_as!(
        TeacherGradingDecision,
        r#"
INSERT INTO teacher_grading_decisions (
    user_exercise_state_id,
    teacher_decision,
    score_given,
    user_id
  )
VALUES ($1, $2, $3, $4)
RETURNING id,
  user_exercise_state_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  teacher_decision AS "teacher_decision: _";
      "#,
        user_exercise_state_id,
        action as TeacherDecisionType,
        score_given,
        decision_maker_user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn try_to_get_latest_grading_decision_by_user_exercise_state_id(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
) -> ModelResult<Option<TeacherGradingDecision>> {
    let res = sqlx::query_as!(
        TeacherGradingDecision,
        r#"
SELECT id,
  user_exercise_state_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  teacher_decision AS "teacher_decision: _"
FROM teacher_grading_decisions
WHERE user_exercise_state_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
      "#,
        user_exercise_state_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_latest_grading_decisions_by_user_id_and_course_instance_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Vec<TeacherGradingDecision>> {
    let res = sqlx::query_as!(
        TeacherGradingDecision,
        r#"
SELECT DISTINCT ON (user_exercise_state_id)
  id,
  user_exercise_state_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  teacher_decision AS "teacher_decision: _"
FROM teacher_grading_decisions
WHERE user_exercise_state_id IN (
    SELECT user_exercise_states.id
    FROM user_exercise_states
    WHERE user_exercise_states.user_id = $1
      AND user_exercise_states.course_instance_id = $2
      AND user_exercise_states.deleted_at IS NULL
  )
  AND deleted_at IS NULL
  ORDER BY user_exercise_state_id, created_at DESC
      "#,
        user_id,
        course_instance_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
