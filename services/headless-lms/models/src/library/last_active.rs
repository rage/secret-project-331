use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct LastActiveInformation {
    last_time_visited_course_materials: Option<DateTime<Utc>>,
    last_time_submitted_exercise: Option<DateTime<Utc>>,
    last_time_gave_peer_review: Option<DateTime<Utc>>,
}

pub async fn get_last_active_information_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<LastActiveInformation> {
    let last_time_visited_course_materials =
        crate::last_time_visited_course_materials::get_last_time_visited_course_materials(
            &mut *conn, course_id, user_id,
        )
        .await?;
    let last_time_submitted_exercise = sqlx::query!(
        r#"
SELECT MAX(created_at) as last_time_submitted_exercise
FROM exercise_slide_submissions
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
    "#,
        user_id,
        course_id,
    )
    .map(|r| r.last_time_submitted_exercise)
    .fetch_one(&mut *conn)
    .await?;

    let last_time_gave_peer_review = sqlx::query!(
        r#"
SELECT MAX(created_at) as last_time_gave_peer_review
FROM peer_review_submissions
WHERE user_id = $1
  AND course_instance_id IN (
    SELECT id
    FROM course_instances
    WHERE course_id = $2
  )
  AND deleted_at IS NULL
    "#,
        user_id,
        course_id,
    )
    .map(|r| r.last_time_gave_peer_review)
    .fetch_one(&mut *conn)
    .await?;

    Ok(LastActiveInformation {
        last_time_visited_course_materials,
        last_time_submitted_exercise,
        last_time_gave_peer_review,
    })
}
