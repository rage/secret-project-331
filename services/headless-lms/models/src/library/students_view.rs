//! Contains helper functions needed for student view
use crate::chapters::DatabaseChapter;
use crate::prelude::*;
use crate::user_details::UserDetail;
use crate::user_exercise_states::UserExerciseState;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ProgressOverview {
    pub user_details: Vec<UserDetail>,
    pub chapters: Vec<DatabaseChapter>,
    pub user_exercise_states: Vec<UserExerciseState>, //todo: add exercises
}

pub async fn get_progress(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<ProgressOverview> {
    let user_details = crate::user_details::get_users_by_course_id(conn, course_id).await?;
    let chapters = crate::chapters::course_chapters(conn, course_id).await?;
    let user_exercise_states =
        crate::user_exercise_states::get_all_for_course(conn, course_id).await?;

    Ok(ProgressOverview {
        user_details,
        chapters,
        user_exercise_states,
    })
}
