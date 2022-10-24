use crate::{
    exercise_task_gradings::{self, ExerciseTaskGrading, UserPointsUpdateStrategy},
    exercise_task_regrading_submissions, exercise_task_submissions,
    exercises::GradingProgress,
    prelude::*,
};

#[derive(Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Regrading {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub regrading_started_at: Option<DateTime<Utc>>,
    pub regrading_completed_at: Option<DateTime<Utc>>,
    pub total_grading_progress: GradingProgress,
    pub user_points_update_strategy: UserPointsUpdateStrategy,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewRegrading {
    user_points_update_strategy: UserPointsUpdateStrategy,
    exercise_task_submission_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct RegradingInfo {
    pub regrading: Regrading,
    pub submission_infos: Vec<RegradingSubmissionInfo>,
}

#[derive(Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct RegradingSubmissionInfo {
    pub exercise_task_submission_id: Uuid,
    pub grading_before_regrading: ExerciseTaskGrading,
    pub grading_after_regrading: Option<ExerciseTaskGrading>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO regradings (user_points_update_strategy)
VALUES ($1)
RETURNING id
        ",
        user_points_update_strategy as UserPointsUpdateStrategy
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Creates a new regrading for the exercise task submission ids supplied as arguments.
pub async fn insert_and_create_exercise_task_regradings(
    conn: &mut PgConnection,
    new_regrading: NewRegrading,
    user_id: Uuid,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    info!("Creating a new regrading.");
    let res = sqlx::query!(
        "
INSERT INTO regradings (user_points_update_strategy, user_id)
VALUES ($1, $2)
RETURNING id
        ",
        new_regrading.user_points_update_strategy as UserPointsUpdateStrategy,
        user_id
    )
    .fetch_one(&mut tx)
    .await?;
    info!(
        "Adding {:?} exercise task submissions to the regrading.",
        new_regrading.exercise_task_submission_ids.len()
    );
    for id in new_regrading.exercise_task_submission_ids {
        let exercise_task_submission = exercise_task_submissions::get_by_id(&mut tx, id).await?;
        let grading_before_regrading_id = exercise_task_submission
            .exercise_task_grading_id
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "One of the submissions to be regraded has not been graded yet.".to_string(),
                    None,
                )
            })?;
        let _etrs = exercise_task_regrading_submissions::insert(
            &mut tx,
            PKeyPolicy::Generate,
            res.id,
            id,
            grading_before_regrading_id,
        )
        .await?;
    }
    tx.commit().await?;
    Ok(res.id)
}

pub async fn get_regrading_info_by_id(
    conn: &mut PgConnection,
    regrading_id: Uuid,
) -> ModelResult<RegradingInfo> {
    let regrading = get_by_id(&mut *conn, regrading_id).await?;
    let etrs =
        exercise_task_regrading_submissions::get_regrading_submissions(&mut *conn, regrading_id)
            .await?;
    let mut grading_id_to_grading =
        exercise_task_gradings::get_new_and_old_exercise_task_gradings_by_regrading_id(
            &mut *conn,
            regrading_id,
        )
        .await?;
    let submission_infos = etrs
        .iter()
        .map(|e| -> ModelResult<_> {
            Ok(RegradingSubmissionInfo {
                exercise_task_submission_id: e.exercise_task_submission_id,
                grading_before_regrading: grading_id_to_grading
                    .remove(&e.grading_before_regrading)
                    .ok_or_else(|| {
                        ModelError::new(
                            ModelErrorType::Generic,
                            "Grading before regrading not found".to_string(),
                            None,
                        )
                    })?,
                grading_after_regrading: e
                    .grading_after_regrading
                    .and_then(|gar| grading_id_to_grading.remove(&gar)),
            })
        })
        .collect::<ModelResult<Vec<_>>>()?;
    Ok(RegradingInfo {
        regrading,
        submission_infos,
    })
}

pub async fn get_all_paginated(
    conn: &mut PgConnection,
    pagination: Pagination,
) -> ModelResult<Vec<Regrading>> {
    let res = sqlx::query_as!(
        Regrading,
        r#"
SELECT id,
  created_at,
  updated_at,
  regrading_started_at,
  regrading_completed_at,
  total_grading_progress AS "total_grading_progress: _",
  user_points_update_strategy AS "user_points_update_strategy: _",
  user_id
FROM regradings
WHERE deleted_at IS NULL
ORDER BY regradings.created_at
LIMIT $1 OFFSET $2;
"#,
        pagination.limit(),
        pagination.offset()
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_count(conn: &mut PgConnection) -> ModelResult<i64> {
    let res = sqlx::query!(
        "
SELECT COUNT(*) as count
from regradings
WHERE deleted_at IS NULL;
"
    )
    .fetch_one(conn)
    .await?;
    Ok(res.count.unwrap_or(0))
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Regrading> {
    let res = sqlx::query_as!(
        Regrading,
        r#"
SELECT id,
  regrading_started_at,
  regrading_completed_at,
  created_at,
  updated_at,
  total_grading_progress AS "total_grading_progress: _",
  user_points_update_strategy AS "user_points_update_strategy: _",
  user_id
FROM regradings
WHERE id = $1
"#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_uncompleted_regradings_and_mark_as_started(
    conn: &mut PgConnection,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        r#"
UPDATE regradings
SET regrading_started_at = CASE
    WHEN regrading_started_at IS NULL THEN now()
    ELSE regrading_started_at
  END
WHERE regrading_completed_at IS NULL
  AND deleted_at IS NULL
RETURNING id
"#
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|r| r.id)
    .collect();

    Ok(res)
}

pub async fn set_total_grading_progress(
    conn: &mut PgConnection,
    regrading_id: Uuid,
    progress: GradingProgress,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE regradings
SET total_grading_progress = $1
WHERE id = $2
",
        progress as GradingProgress,
        regrading_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn complete_regrading(conn: &mut PgConnection, regrading_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE regradings
SET regrading_completed_at = now(),
  total_grading_progress = 'fully-graded'
WHERE id = $1
",
        regrading_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_error_message(
    conn: &mut PgConnection,
    regrading_id: Uuid,
    error_message: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE regradings
SET error_message = $1
WHERE id = $2
",
        error_message,
        regrading_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
