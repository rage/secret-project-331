use futures::Stream;
use serde_json::Value;

use crate::{
    exercise_slide_submissions,
    exercise_tasks::{CourseMaterialExerciseTask, ExerciseTask},
    peer_review_question_submissions::PeerReviewQuestionSubmission,
    peer_review_questions::{PeerReviewQuestion, PeerReviewQuestionType},
    prelude::*,
    CourseOrExamId,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseTaskSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_slide_submission_id: Uuid,
    pub exercise_task_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub data_json: Option<serde_json::Value>,
    pub exercise_task_grading_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewsRecievedII {
    pub id: Uuid,
    pub question: String,
    pub question_type: PeerReviewQuestionType,
    pub text_data: Option<String>,
    pub number_data: Option<f32>,
}

pub struct PeerReviewsRecieved {
    pub peer_review_questions: Vec<PeerReviewQuestion>,
    pub peer_review_question_submissions: Vec<PeerReviewQuestionSubmission>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SubmissionData {
    pub exercise_id: Uuid,
    pub course_id: Uuid,
    pub exercise_slide_submission_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub user_id: Uuid,
    pub course_instance_id: Uuid,
    pub data_json: Value,
    pub id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExportedSubmission {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub score_given: Option<f32>,
    pub data_json: Option<serde_json::Value>,
}

pub async fn get_submission(
    conn: &mut PgConnection,
    submission_id: Uuid,
) -> ModelResult<ExerciseTaskSubmission> {
    let res = sqlx::query_as!(
        ExerciseTaskSubmission,
        "
SELECT *
FROM exercise_task_submissions
WHERE id = $1
",
        submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert_with_id(
    conn: &mut PgConnection,
    submission_data: &SubmissionData,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_task_submissions (
    id,
    exercise_slide_submission_id,
    exercise_slide_id,
    exercise_task_id,
    data_json
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
        ",
        submission_data.id,
        submission_data.exercise_slide_submission_id,
        submission_data.exercise_slide_id,
        submission_data.exercise_task_id,
        submission_data.data_json,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    exercise_slide_id: Uuid,
    exercise_task_id: Uuid,
    data_json: Value,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_task_submissions (
    exercise_slide_submission_id,
    exercise_slide_id,
    exercise_task_id,
    data_json
  )
  VALUES ($1, $2, $3, $4)
  RETURNING id
",
        exercise_slide_submission_id,
        exercise_slide_id,
        exercise_task_id,
        data_json,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExerciseTaskSubmission> {
    let submission = sqlx::query_as!(
        ExerciseTaskSubmission,
        "
SELECT *
FROM exercise_task_submissions
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(submission)
}

pub async fn get_by_exercise_slide_submission_id(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<ExerciseTaskSubmission>> {
    let submissions = sqlx::query_as!(
        ExerciseTaskSubmission,
        "
SELECT *
FROM exercise_task_submissions
WHERE exercise_slide_submission_id = $1
  AND deleted_at IS NULL
        ",
        exercise_slide_submission_id
    )
    .fetch_all(conn)
    .await?;
    Ok(submissions)
}

pub async fn get_users_latest_exercise_task_submissions_for_exercise_slide(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<Vec<ExerciseTaskSubmission>>> {
    let exercise_slide_submission =
        exercise_slide_submissions::try_to_get_users_latest_exercise_slide_submission(
            conn,
            exercise_slide_id,
            user_id,
        )
        .await?;
    if let Some(exercise_slide_submission) = exercise_slide_submission {
        let task_submissions = sqlx::query_as!(
            ExerciseTaskSubmission,
            "
SELECT *
FROM exercise_task_submissions
WHERE exercise_slide_submission_id = $1
  AND deleted_at IS NULL
            ",
            exercise_slide_submission.id
        )
        .fetch_all(conn)
        .await?;
        Ok(Some(task_submissions))
    } else {
        Ok(None)
    }
}

pub async fn get_course_and_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseOrExamId> {
    let res = sqlx::query!(
        "
SELECT ess.course_id,
  ess.exam_id
FROM exercise_task_submissions ets
  JOIN exercise_slide_submissions ess ON ets.exercise_slide_submission_id = ess.id
WHERE ets.id = $1
  AND ets.deleted_at IS NULL
  AND ess.deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    CourseOrExamId::from(res.course_id, res.exam_id)
}

pub async fn get_peer_review_recieved(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<PeerReviewsRecieved> {
    let peer_review = crate::peer_reviews::get_by_exercise_id(&mut *conn, exercise_id).await?;
    let peer_review_questions =
        crate::peer_review_questions::get_by_peer_review_id(&mut *conn, peer_review.id).await?;

    let peer_review_question_submissions =
        crate::peer_review_question_submissions::get_by_peer_review_question_id(
            &mut *conn,
            &peer_review_questions
                .iter()
                .map(|x| (x.id))
                .collect::<Vec<Uuid>>(),
        )
        .await?
        .into_iter()
        .map(|x| x.into())
        .collect();

    /* let mut peer_review_question_submissions: Vec<PeerReviewQuestion> = peer_review_questions
    .into_iter()
    .map(|p| {
        (PeerReviewsRecieved {
            id: p.id,
            question: p.question,
            question_type: p.question_type,
            text_data: p.text_data,
            number_data: p.number_data,
        },)
    })
    .collect(); */

    Ok(PeerReviewsRecieved {
        peer_review_questions,
        peer_review_question_submissions,
    })
}

pub async fn set_grading_id(
    conn: &mut PgConnection,
    grading_id: Uuid,
    submission_id: Uuid,
) -> ModelResult<ExerciseTaskSubmission> {
    let res = sqlx::query_as!(
        ExerciseTaskSubmission,
        "
UPDATE exercise_task_submissions
SET exercise_task_grading_id = $1
WHERE id = $2
RETURNING *
",
        grading_id,
        submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub fn stream_exam_submissions(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> impl Stream<Item = sqlx::Result<ExportedSubmission>> + '_ {
    sqlx::query_as!(
        ExportedSubmission,
        "
SELECT exercise_task_submissions.id,
  user_id,
  exercise_task_submissions.created_at,
  exercise_slide_submissions.exercise_id,
  exercise_task_submissions.exercise_task_id,
  exercise_task_gradings.score_given,
  exercise_task_submissions.data_json
FROM exercise_task_submissions
  JOIN exercise_slide_submissions ON exercise_task_submissions.exercise_slide_submission_id = exercise_slide_submissions.id
  JOIN exercise_task_gradings on exercise_task_submissions.exercise_task_grading_id = exercise_task_gradings.id
  JOIN exercises on exercise_slide_submissions.exercise_id = exercises.id
WHERE exercise_slide_submissions.exam_id = $1
  AND exercise_task_submissions.deleted_at IS NULL
  AND exercise_task_gradings.deleted_at IS NULL
  AND exercises.deleted_at IS NULL;
        ",
        exam_id
    )
    .fetch(conn)
}

/// Used to get the necessary info for rendering a submission either when we're viewing a submission, or we're conducting a peer review.
pub async fn get_exercise_task_submission_info_by_exercise_slide_submission_id(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<CourseMaterialExerciseTask>> {
    let task_submisssions = crate::exercise_task_submissions::get_by_exercise_slide_submission_id(
        &mut *conn,
        exercise_slide_submission_id,
    )
    .await?;
    let exercise_task_gradings =
        crate::exercise_task_gradings::get_all_gradings_by_exercise_slide_submission_id(
            &mut *conn,
            exercise_slide_submission_id,
        )
        .await?;

    let exercise_tasks = crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_id::<
        Vec<ExerciseTask>,
    >(&mut *conn, &task_submisssions[0].exercise_slide_id)
    .await?;
    let mut res = Vec::with_capacity(task_submisssions.len());
    for ts in task_submisssions {
        let grading = exercise_task_gradings
            .iter()
            .find(|g| Some(g.id) == ts.exercise_task_grading_id)
            .ok_or_else(|| ModelError::NotFound("Grading not found".to_string()))?;
        let task = exercise_tasks
            .iter()
            .find(|t| t.id == ts.exercise_task_id)
            .ok_or_else(|| ModelError::NotFound("Exercise task not found".to_string()))?;
        let exercise_iframe_url = crate::exercise_service_info::get_service_info_by_exercise_type(
            &mut *conn,
            &task.exercise_type,
        )
        .await?
        .user_interface_iframe_path;
        let course_material_exercise_task = CourseMaterialExerciseTask {
            id: task.id,
            exercise_slide_id: task.exercise_slide_id,
            exercise_iframe_url: Some(exercise_iframe_url),
            assignment: task.assignment.clone(),
            public_spec: task.public_spec.clone(),
            model_solution_spec: task.model_solution_spec.clone(),
            previous_submission: Some(ts),
            previous_submission_grading: Some(grading.clone()),
            order_number: task.order_number,
        };
        res.push(course_material_exercise_task);
    }
    Ok(res)
}
