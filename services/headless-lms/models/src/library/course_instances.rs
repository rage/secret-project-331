//! General functionality related to course instances

use crate::{
    course_background_question_answers::NewCourseBackgroundQuestionAnswer,
    course_instance_enrollments::{CourseInstanceEnrollment, NewCourseInstanceEnrollment},
    prelude::*,
};

/// Enrolls the user to the given course instance.
pub async fn enroll(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
    background_question_answers: &[NewCourseBackgroundQuestionAnswer],
) -> anyhow::Result<CourseInstanceEnrollment> {
    let mut tx = conn.begin().await?;

    let instance =
        crate::course_instances::get_course_instance(&mut tx, course_instance_id).await?;
    let enrollment = crate::course_instance_enrollments::insert_enrollment_and_set_as_current(
        &mut tx,
        NewCourseInstanceEnrollment {
            user_id,
            course_id: instance.course_id,
            course_instance_id,
        },
    )
    .await?;

    if !background_question_answers.is_empty() {
        crate::course_background_question_answers::upsert_backround_question_answers(
            &mut tx,
            user_id,
            background_question_answers,
        )
        .await?;
    }
    tx.commit().await?;
    Ok(enrollment)
}
