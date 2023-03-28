use rand::Rng;

use crate::{exercise_slide_submissions::ExerciseSlideSubmission, prelude::*};

/// Returns an exercise slide submission id that has been given to be reviewed by the student within the hour.
/// Does not return submissions that no longer need peer review.
pub async fn try_to_restore_previously_given_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    let res = sqlx::query!(
        "
SELECT exercise_slide_submission_id
FROM offered_answers_to_peer_review_temporary
WHERE exercise_id = $1
  AND user_id = $2
  AND course_instance_id = $3
  AND created_at > now() - '1 hour'::interval
  ",
        exercise_id,
        user_id,
        course_instance_id,
    )
    .fetch_optional(&mut *conn)
    .await?;
    if rand::thread_rng().gen_range(0..10) == 0 {
        // Sometimes clean up the table
        delete_expired_records(&mut *conn).await?;
    }
    if let Some(res) = res {
        // In order to return the saved submission, it needs to have a peer review queue entry and the entry must not have received enough peer reviews.
        if let Some(peer_review_queue_entry) = crate::peer_review_queue_entries::try_to_get_by_receiving_submission_and_course_instance_ids(&mut *conn, res.exercise_slide_submission_id, course_instance_id).await? {
          if peer_review_queue_entry.received_enough_peer_reviews {
            return Ok(None);
          }
        } else {
          return Ok(None)
        }

        let ess = crate::exercise_slide_submissions::get_by_id(
            &mut *conn,
            res.exercise_slide_submission_id,
        )
        .await?;
        return Ok(Some(ess));
    }
    Ok(None)
}

/// Returns an exercise slide submission id that has been given to be reviewed by the student within the hour.
pub async fn save_given_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    exercise_id: Uuid,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<()> {
    let _res = sqlx::query!(
        "
INSERT INTO offered_answers_to_peer_review_temporary (
    exercise_slide_submission_id,
    user_id,
    course_instance_id,
    exercise_id
  )
VALUES ($1, $2, $3, $4) ON CONFLICT ON CONSTRAINT offered_answers_to_peer_review_temporary_pkey DO
UPDATE
SET exercise_slide_submission_id = $1,
  user_id = $2,
  course_instance_id = $3,
  exercise_id = $4,
  created_at = now()
",
        exercise_slide_submission_id,
        user_id,
        course_instance_id,
        exercise_id,
    )
    .execute(&mut *conn)
    .await?;

    Ok(())
}

/// For clearing the table after the user has given a peer review so that they can receive a new submission to be reviewed
pub async fn delete_saved_submissions_for_user(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<()> {
    info!("Deleting expired records from offered_answers_to_peer_review_temporary");
    let _res = sqlx::query!(
        "
DELETE FROM offered_answers_to_peer_review_temporary
WHERE exercise_id = $1 AND user_id = $2 AND course_instance_id = $3
",
        exercise_id,
        user_id,
        course_instance_id
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Deletes entries older than 1 hour -- for keeping the table small and fast
async fn delete_expired_records(conn: &mut PgConnection) -> ModelResult<()> {
    info!("Deleting expired records from offered_answers_to_peer_review_temporary");
    let _res = sqlx::query!(
        "
DELETE FROM offered_answers_to_peer_review_temporary
WHERE created_at < now() - '1 hour'::interval
"
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}
