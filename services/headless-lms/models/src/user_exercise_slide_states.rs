use crate::{exercises::GradingProgress, prelude::*};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserExerciseSlideState {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_slide_id: Uuid,
    pub user_exercise_state_id: Uuid,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
}

pub struct UserExerciseSlideStateGradingSummary {
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    user_exercise_state_id: Uuid,
    exercise_slide_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO user_exercise_slide_states (
    id,
    exercise_slide_id,
    user_exercise_state_id,
    grading_progress
  )
VALUES ($1, $2, $3, $4)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        exercise_slide_id,
        user_exercise_state_id,
        GradingProgress::NotReady as GradingProgress,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<UserExerciseSlideState> {
    let res = sqlx::query_as!(
        UserExerciseSlideState,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  user_exercise_state_id,
  score_given,
  grading_progress AS "grading_progress: _"
FROM user_exercise_slide_states
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_unique_index(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    exercise_slide_id: Uuid,
) -> ModelResult<Option<UserExerciseSlideState>> {
    let res = sqlx::query_as!(
        UserExerciseSlideState,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  user_exercise_state_id,
  score_given,
  grading_progress AS "grading_progress: _"
FROM user_exercise_slide_states
WHERE user_exercise_state_id = $1
  AND exercise_slide_id = $2
  AND deleted_at IS NULL
        "#,
        user_exercise_state_id,
        exercise_slide_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_by_user_exercise_state_id(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
) -> ModelResult<Vec<UserExerciseSlideState>> {
    let res = sqlx::query_as!(
        UserExerciseSlideState,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  user_exercise_state_id,
  score_given,
  grading_progress AS "grading_progress: _"
FROM user_exercise_slide_states
WHERE user_exercise_state_id = $1
  AND deleted_at IS NULL
        "#,
        user_exercise_state_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_or_insert_by_unique_index(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    exercise_slide_id: Uuid,
) -> ModelResult<UserExerciseSlideState> {
    let user_exercise_slide_state =
        get_by_unique_index(conn, user_exercise_state_id, exercise_slide_id).await?;
    if let Some(user_exercise_slide_state) = user_exercise_slide_state {
        Ok(user_exercise_slide_state)
    } else {
        let id = insert(
            conn,
            PKeyPolicy::Generate,
            user_exercise_state_id,
            exercise_slide_id,
        )
        .await?;
        get_by_id(conn, id).await
    }
}

pub async fn get_grading_summary_by_user_exercise_state_id(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
) -> ModelResult<UserExerciseSlideStateGradingSummary> {
    let res = sqlx::query!(
        r#"
SELECT score_given,
  grading_progress AS "grading_progress: GradingProgress"
FROM user_exercise_slide_states
WHERE user_exercise_state_id = $1
  AND deleted_at IS NULL
        "#,
        user_exercise_state_id,
    )
    .fetch_all(conn)
    .await?;
    let total_score_given = res
        .iter()
        .filter_map(|x| x.score_given)
        .reduce(|acc, next| acc + next);
    let least_significant_grading_progress = res
        .iter()
        .map(|x| x.grading_progress)
        .min()
        .unwrap_or(GradingProgress::NotReady);
    Ok(UserExerciseSlideStateGradingSummary {
        score_given: total_score_given,
        grading_progress: least_significant_grading_progress,
    })
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    score_given: Option<f32>,
    grading_progress: GradingProgress,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        "
UPDATE user_exercise_slide_states
SET score_given = $1,
  grading_progress = $2
WHERE id = $3
  AND deleted_at IS NULL
        ",
        score_given,
        grading_progress as GradingProgress,
        id,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
UPDATE user_exercise_slide_states
SET deleted_at = now()
WHERE id = $1
RETURNING id
    ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    mod get_grading_summary_by_user_exercise_state_id {
        use headless_lms_utils::numbers::f32_approx_eq;

        use crate::{
            chapters, chapters::NewChapter, courses, exercise_language_groups, exercise_slides,
            exercises, page_language_groups, pages, pages::NewCoursePage, user_exercise_states,
        };

        use super::*;

        #[tokio::test]
        async fn initial_values() {
            insert_data!(:tx);
            let (user_exercise_state_id, slide_1, slide_2, slide_3) =
                create_test_data(&mut tx).await.unwrap();
            insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_1,
            )
            .await
            .unwrap();
            insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_2,
            )
            .await
            .unwrap();
            insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_3,
            )
            .await
            .unwrap();

            let UserExerciseSlideStateGradingSummary {
                score_given,
                grading_progress,
            } = get_grading_summary_by_user_exercise_state_id(tx.as_mut(), user_exercise_state_id)
                .await
                .unwrap();
            assert_eq!(score_given, None);
            assert_eq!(grading_progress, GradingProgress::NotReady);
        }

        #[tokio::test]
        async fn single_task() {
            insert_data!(:tx);
            let (user_exercise_state_id, slide_1, slide_2, slide_3) =
                create_test_data(&mut tx).await.unwrap();
            insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_1,
            )
            .await
            .unwrap();
            insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_2,
            )
            .await
            .unwrap();
            let id_3 = insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_3,
            )
            .await
            .unwrap();
            update(tx.as_mut(), id_3, Some(1.0), GradingProgress::FullyGraded)
                .await
                .unwrap();

            let UserExerciseSlideStateGradingSummary {
                score_given,
                grading_progress,
            } = get_grading_summary_by_user_exercise_state_id(tx.as_mut(), user_exercise_state_id)
                .await
                .unwrap();
            assert!(f32_approx_eq(score_given.unwrap(), 1.0));
            assert_eq!(grading_progress, GradingProgress::NotReady);
        }

        #[tokio::test]
        async fn all_tasks() {
            insert_data!(:tx);
            let (user_exercise_state_id, slide_1, slide_2, slide_3) =
                create_test_data(&mut tx).await.unwrap();
            let id_1 = insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_1,
            )
            .await
            .unwrap();
            update(tx.as_mut(), id_1, Some(1.0), GradingProgress::FullyGraded)
                .await
                .unwrap();
            let id_2 = insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_2,
            )
            .await
            .unwrap();
            update(tx.as_mut(), id_2, Some(1.0), GradingProgress::FullyGraded)
                .await
                .unwrap();
            let id_3 = insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                user_exercise_state_id,
                slide_3,
            )
            .await
            .unwrap();
            update(tx.as_mut(), id_3, Some(1.0), GradingProgress::FullyGraded)
                .await
                .unwrap();

            let UserExerciseSlideStateGradingSummary {
                score_given,
                grading_progress,
            } = get_grading_summary_by_user_exercise_state_id(tx.as_mut(), user_exercise_state_id)
                .await
                .unwrap();
            assert!(f32_approx_eq(score_given.unwrap(), 3.0));
            assert_eq!(grading_progress, GradingProgress::FullyGraded);
        }

        async fn create_test_data(tx: &mut Tx<'_>) -> ModelResult<(Uuid, Uuid, Uuid, Uuid)> {
            insert_data!(tx: tx; :user, :org, :course, :instance, :course_module);
            let chapter_id = chapters::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                &NewChapter {
                    name: "chapter".to_string(),
                    color: Some("#065853".to_string()),
                    course_id: course,
                    chapter_number: 1,
                    front_page_id: None,
                    opens_at: None,
                    deadline: None,
                    course_module_id: Some(course_module.id),
                },
            )
            .await?;

            let course_info = courses::get_course(tx.as_mut(), course).await?;

            let page_language_group_id = page_language_groups::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                course_info.course_language_group_id,
            )
            .await?;

            let exercise_language_group_id = exercise_language_groups::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                course_info.course_language_group_id,
            )
            .await?;

            let (page_id, _history) = pages::insert_course_page(
                tx.as_mut(),
                &NewCoursePage::new(course, 1, "/test", "test", page_language_group_id),
                user,
            )
            .await?;
            let exercise_id = exercises::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                course,
                "course",
                page_id,
                chapter_id,
                1,
                exercise_language_group_id,
            )
            .await?;
            let slide_1 =
                exercise_slides::insert(tx.as_mut(), PKeyPolicy::Generate, exercise_id, 1).await?;
            let slide_2 =
                exercise_slides::insert(tx.as_mut(), PKeyPolicy::Generate, exercise_id, 2).await?;
            let slide_3 =
                exercise_slides::insert(tx.as_mut(), PKeyPolicy::Generate, exercise_id, 3).await?;
            let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
                tx.as_mut(),
                user,
                exercise_id,
                Some(instance.id),
                None,
            )
            .await?;
            Ok((user_exercise_state.id, slide_1, slide_2, slide_3))
        }
    }
}
