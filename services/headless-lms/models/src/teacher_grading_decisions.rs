use std::collections::HashMap;

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
    pub justification: Option<String>,
    pub hidden: Option<bool>,
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
    pub justification: Option<String>,
    pub hidden: bool,
}

pub async fn add_teacher_grading_decision(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    action: TeacherDecisionType,
    score_given: f32,
    decision_maker_user_id: Option<Uuid>,
    justification: Option<String>,
    hidden: bool,
) -> ModelResult<TeacherGradingDecision> {
    let res = sqlx::query_as!(
        TeacherGradingDecision,
        r#"
INSERT INTO teacher_grading_decisions (
    user_exercise_state_id,
    teacher_decision,
    score_given,
    user_id,
    justification,
    hidden
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id,
  user_exercise_state_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  teacher_decision AS "teacher_decision: _",
  justification,
  hidden;
      "#,
        user_exercise_state_id,
        action as TeacherDecisionType,
        score_given,
        decision_maker_user_id,
        justification,
        hidden
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
  teacher_decision AS "teacher_decision: _",
  justification,
  hidden
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

pub async fn try_to_get_latest_grading_decision_by_user_exercise_state_id_for_users(
    conn: &mut PgConnection,
    user_exercise_state_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, TeacherGradingDecision>> {
    let decisions = sqlx::query_as!(
        TeacherGradingDecision,
        r#"
SELECT id,
  user_exercise_state_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  teacher_decision AS "teacher_decision: _",
  justification,
  hidden
FROM teacher_grading_decisions
WHERE user_exercise_state_id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND deleted_at IS NULL
      "#,
        user_exercise_state_ids,
    )
    .fetch_all(conn)
    .await?;

    let mut res: HashMap<Uuid, TeacherGradingDecision> = HashMap::new();
    for item in decisions.into_iter() {
        res.insert(item.user_exercise_state_id, item);
    }

    Ok(res)
}

pub async fn get_all_latest_grading_decisions_by_user_id_and_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
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
  teacher_decision AS "teacher_decision: _",
  justification,
  hidden
FROM teacher_grading_decisions
WHERE user_exercise_state_id IN (
    SELECT user_exercise_states.id
    FROM user_exercise_states
    WHERE user_exercise_states.user_id = $1
      AND user_exercise_states.course_id = $2
      AND user_exercise_states.deleted_at IS NULL
  )
  AND deleted_at IS NULL
  ORDER BY user_exercise_state_id, created_at DESC
      "#,
        user_id,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_latest_grading_decisions_by_user_id_and_exam_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    exam_id: Uuid,
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
  teacher_decision AS "teacher_decision: _",
  justification,
  hidden
FROM teacher_grading_decisions
WHERE user_exercise_state_id IN (
    SELECT user_exercise_states.id
    FROM user_exercise_states
    WHERE user_exercise_states.user_id = $1
      AND user_exercise_states.exam_id = $2
      AND user_exercise_states.deleted_at IS NULL
  )
  AND deleted_at IS NULL
  ORDER BY user_exercise_state_id, created_at DESC
      "#,
        user_id,
        exam_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn update_teacher_grading_decision_hidden_field(
    conn: &mut PgConnection,
    teacher_grading_decision_id: Uuid,
    hidden: bool,
) -> ModelResult<TeacherGradingDecision> {
    let res = sqlx::query_as!(
        TeacherGradingDecision,
        r#"
        UPDATE teacher_grading_decisions
        SET hidden = $1
        WHERE id = $2
        RETURNING id,
          user_exercise_state_id,
          created_at,
          updated_at,
          deleted_at,
          score_given,
          teacher_decision AS "teacher_decision: _",
          justification,
          hidden;
              "#,
        hidden,
        teacher_grading_decision_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
