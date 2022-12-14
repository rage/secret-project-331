use futures::future::BoxFuture;
use url::Url;

use crate::{
    course_instances, exams,
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_slide_submissions::{
        get_exercise_slide_submission_counts_for_exercise_user, ExerciseSlideSubmission,
    },
    exercise_slides::{self, CourseMaterialExerciseSlide},
    exercise_tasks,
    peer_review_configs::CourseMaterialPeerReviewConfig,
    prelude::*,
    teacher_grading_decisions::TeacherDecisionType,
    user_course_settings,
    user_exercise_states::{self, CourseInstanceOrExamId, ReviewingStage, UserExerciseState},
    CourseOrExamId,
};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Exercise {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub page_id: Uuid,
    pub chapter_id: Option<Uuid>,
    pub deadline: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_maximum: i32,
    pub order_number: i32,
    pub copied_from: Option<Uuid>,
    pub max_tries_per_slide: Option<i32>,
    pub limit_number_of_tries: bool,
    pub needs_peer_review: bool,
    pub use_course_default_peer_review_config: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseStatusForSubmission {
    pub name: String,
    pub id: Uuid,
    pub score_maximum: i32,
    pub score_given: Option<f32>,
    pub teacher_decision: Option<TeacherDecisionType>,
    pub submission_id: Uuid,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewDataForUser {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub text_data: Option<String>,
    pub number_data: Option<f32>,
    pub pr_submission_id: Uuid,
    pub received_enough_peer_reviews: bool,
    pub peer_review_priority: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseStatusForUser {
    pub exercise_points: Exercise,
    pub given_peer_review_data: Vec<PeerReviewDataForUser>,
    pub received_peer_review_data: Vec<PeerReviewDataForUser>,
    pub submission_ids: Vec<ExerciseStatusForSubmission>,
}

impl Exercise {
    pub fn get_course_id(&self) -> ModelResult<Uuid> {
        self.course_id.ok_or_else(|| {
            ModelError::new(
                ModelErrorType::Generic,
                "Exercise is not related to a course.".to_string(),
                None,
            )
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialExercise {
    pub exercise: Exercise,
    pub can_post_submission: bool,
    pub current_exercise_slide: CourseMaterialExerciseSlide,
    /// None for logged out users.
    pub exercise_status: Option<ExerciseStatus>,
    #[cfg_attr(feature = "ts_rs", ts(type = "Record<string, number>"))]
    pub exercise_slide_submission_counts: HashMap<Uuid, i64>,
    pub peer_review_config: Option<CourseMaterialPeerReviewConfig>,
    pub previous_exercise_slide_submission: Option<ExerciseSlideSubmission>,
}

impl CourseMaterialExercise {
    pub fn clear_grading_information(&mut self) {
        self.exercise_status = None;
        self.current_exercise_slide
            .exercise_tasks
            .iter_mut()
            .for_each(|task| {
                task.model_solution_spec = None;
                task.previous_submission_grading = None;
            });
    }

    pub fn clear_model_solution_specs(&mut self) {
        self.current_exercise_slide
            .exercise_tasks
            .iter_mut()
            .for_each(|task| {
                task.model_solution_spec = None;
            });
    }
}

/**
Indicates what is the user's completion status for a exercise.

As close as possible to LTI's activity progress for compatibility: <https://www.imsglobal.org/spec/lti-ags/v2p0#activityprogress>.
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "activity_progress", rename_all = "kebab-case")]
pub enum ActivityProgress {
    /// The user has not started the activity, or the activity has been reset for that student.
    Initialized,
    /// The activity associated with the exercise has been started by the user to which the result relates.
    Started,
    /// The activity is being drafted and is available for comment.
    InProgress,
    /// The activity has been submitted at least once by the user but the user is still able make further submissions.
    Submitted,
    /// The user has completed the activity associated with the exercise.
    Completed,
}

impl Default for ActivityProgress {
    fn default() -> Self {
        ActivityProgress::Initialized
    }
}

/**

Tells what's the status of the grading progress for a user and exercise.

As close as possible LTI's grading progress for compatibility: <https://www.imsglobal.org/spec/lti-ags/v2p0#gradingprogress>
*/
#[derive(
    Clone, Copy, Debug, Deserialize, Eq, Serialize, Ord, PartialEq, PartialOrd, sqlx::Type,
)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "grading_progress", rename_all = "kebab-case")]
pub enum GradingProgress {
    /// The grading could not complete.
    Failed,
    /// There is no grading process occurring; for example, the student has not yet made any submission.
    NotReady,
    /// Final Grade is pending, and it does require human intervention; if a Score value is present, it indicates the current value is partial and may be updated during the manual grading.
    PendingManual,
    /// Final Grade is pending, but does not require manual intervention; if a Score value is present, it indicates the current value is partial and may be updated.
    Pending,
    /// The grading process is completed; the score value, if any, represents the current Final Grade;
    FullyGraded,
}

impl GradingProgress {
    pub fn is_complete(self) -> bool {
        self == Self::FullyGraded || self == Self::Failed
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseStatus {
    // None when grading has not completed yet. Max score can be found from the associated exercise.
    pub score_given: Option<f32>,
    pub activity_progress: ActivityProgress,
    pub grading_progress: GradingProgress,
    pub reviewing_stage: ReviewingStage,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    course_id: Uuid,
    name: &str,
    page_id: Uuid,
    chapter_id: Uuid,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercises (
    id,
    course_id,
    name,
    page_id,
    chapter_id,
    order_number
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        course_id,
        name,
        page_id,
        chapter_id,
        order_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Exercise> {
    let exercise = sqlx::query_as!(
        Exercise,
        "
SELECT *
FROM exercises
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise)
}

pub async fn get_exercise_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Exercise> {
    let exercise = sqlx::query_as!(Exercise, "SELECT * FROM exercises WHERE id = $1;", id)
        .fetch_one(conn)
        .await?;
    Ok(exercise)
}

pub async fn get_exercises_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Exercise>> {
    let exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
FROM exercises
WHERE course_id = $1
  AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(exercises)
}

pub async fn get_exercises_by_course_instance_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Vec<Exercise>> {
    let exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
FROM exercises
WHERE course_id = (
    SELECT course_id
    FROM course_instances
    WHERE id = $1
  )
  AND deleted_at IS NULL
ORDER BY order_number ASC
"#,
        course_instance_id
    )
    .fetch_all(conn)
    .await?;
    Ok(exercises)
}

pub async fn get_exercise_submissions_and_status_by_course_instance_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<ExerciseStatusForSubmission>> {
    let exercises = sqlx::query_as!(
        ExerciseStatusForSubmission,
        r#"
        SELECT
        e.id,
        e.name,
        e.score_maximum,
        ues.score_given,
        tgd.teacher_decision as "teacher_decision: _",
        ess.id as submission_id,
        ess.updated_at
        FROM exercises e
        LEFT JOIN user_exercise_states ues on e.id = ues.exercise_id
        LEFT JOIN teacher_grading_decisions tgd on tgd.user_exercise_state_id = ues.id
        LEFT JOIN exercise_slide_submissions ess on e.id = ess.exercise_id
        WHERE e.course_id = (
            SELECT course_id
            FROM course_instances
            WHERE id = $1
          )
          AND e.deleted_at IS NULL
          AND ess.user_id = $2
          AND ues.user_id = $2
        ORDER BY e.order_number ASC;
"#,
        course_instance_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(exercises)
}

/** Given peer reviews */
pub async fn get_given_peer_review_data_for_exercise_by_course_instance_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<PeerReviewDataForUser>> {
    let peer_review_data = sqlx::query_as!(
        PeerReviewDataForUser,
        r#"
        SELECT
        e.id,
        e.created_at,
        e.updated_at,
        e.name,
        prqs.id AS pr_submission_id,
        prqs.text_data,
        prqs.number_data,
        prqe.received_enough_peer_reviews,
        prqe.peer_review_priority
        FROM exercises e
        RIGHT JOIN peer_review_queue_entries prqe on e.id = prqe.exercise_id
        LEFT JOIN peer_review_submissions prs on e.id = prs.exercise_id
        LEFT JOIN peer_review_question_submissions prqs on prs.id = prqs.peer_review_submission_id
        WHERE e.course_id = (
            SELECT course_id
            FROM course_instances
            WHERE id = $1
          )
          AND e.deleted_at IS NULL
          AND prs.user_id = $2
        ORDER BY e.order_number ASC;
"#,
        course_instance_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(peer_review_data)
}

/** Received peer reviews */
pub async fn get_received_peer_review_data_for_exercise_by_course_instance_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<PeerReviewDataForUser>> {
    let peer_review_data = sqlx::query_as!(
        PeerReviewDataForUser,
        r#"
        SELECT
        e.id,
        e.created_at,
        e.updated_at,
        e.name,
        prqs.id AS pr_submission_id,
        prqs.text_data,
        prqs.number_data,
        prqe.received_enough_peer_reviews,
        prqe.peer_review_priority
        FROM exercises e
        RIGHT JOIN peer_review_queue_entries prqe on e.id = prqe.exercise_id
        LEFT JOIN peer_review_submissions prs on e.id = prs.exercise_id
        LEFT JOIN peer_review_question_submissions prqs on prs.id = prqs.peer_review_submission_id
        LEFT JOIN exercise_slide_submissions ess on e.id = ess.exercise_id
        WHERE e.course_id = (
            SELECT course_id
            FROM course_instances
            WHERE id = $1
          )
          AND e.deleted_at IS NULL
          AND prqs.peer_review_submission_id = prs.id
          AND ess.id = prs.exercise_slide_submission_id
            AND ess.user_id = $2
        ORDER BY e.order_number ASC;
"#,
        course_instance_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(peer_review_data)
}

pub async fn get_exercises_by_chapter_id(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<Vec<Exercise>> {
    let exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
FROM exercises
WHERE chapter_id = $1
  AND deleted_at IS NULL
"#,
        chapter_id
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(exercises)
}

pub async fn get_exercises_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Vec<Exercise>> {
    let exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
  FROM exercises
WHERE page_id = $1
  AND deleted_at IS NULL;
"#,
        page_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(exercises)
}

pub async fn get_exercises_by_exam_id(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> ModelResult<Vec<Exercise>> {
    let exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
FROM exercises
WHERE exam_id = $1
  AND deleted_at IS NULL
"#,
        exam_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(exercises)
}

pub async fn get_course_or_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseOrExamId> {
    let res = sqlx::query!(
        "
SELECT course_id,
  exam_id
FROM exercises
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    CourseOrExamId::from(res.course_id, res.exam_id)
}

pub async fn get_course_material_exercise(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    exercise_id: Uuid,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<CourseMaterialExercise> {
    let exercise = get_by_id(conn, exercise_id).await?;
    let (current_exercise_slide, instance_or_exam_id) =
        get_or_select_exercise_slide(&mut *conn, user_id, &exercise, fetch_service_info).await?;
    info!(
        "Current exercise slide id: {:#?}",
        current_exercise_slide.id
    );

    let user_exercise_state = match (user_id, instance_or_exam_id) {
        (Some(user_id), Some(course_instance_or_exam_id)) => {
            user_exercise_states::get_user_exercise_state_if_exists(
                conn,
                user_id,
                exercise.id,
                course_instance_or_exam_id,
            )
            .await?
        }
        _ => None,
    };

    let can_post_submission =
        determine_can_post_submission(&mut *conn, user_id, &exercise, &user_exercise_state).await?;

    let previous_exercise_slide_submission = match user_id {
        Some(user_id) => {
            crate::exercise_slide_submissions::try_to_get_users_latest_exercise_slide_submission(
                conn,
                current_exercise_slide.id,
                user_id,
            )
            .await?
        }
        _ => None,
    };

    let exercise_status = user_exercise_state.map(|user_exercise_state| ExerciseStatus {
        score_given: user_exercise_state.score_given,
        activity_progress: user_exercise_state.activity_progress,
        grading_progress: user_exercise_state.grading_progress,
        reviewing_stage: user_exercise_state.reviewing_stage,
    });

    let exercise_slide_submission_counts = if let Some(user_id) = user_id {
        if let Some(cioreid) = instance_or_exam_id {
            get_exercise_slide_submission_counts_for_exercise_user(
                conn,
                exercise_id,
                cioreid,
                user_id,
            )
            .await?
        } else {
            HashMap::new()
        }
    } else {
        HashMap::new()
    };

    let peer_review_config = match (exercise.needs_peer_review, exercise.course_id) {
        (true, Some(course_id)) => {
            let prc = crate::peer_review_configs::get_by_exercise_or_course_id(
                conn, &exercise, course_id,
            )
            .await
            .optional()?;
            prc.map(|prc| CourseMaterialPeerReviewConfig {
                id: prc.id,
                course_id: prc.course_id,
                exercise_id: prc.exercise_id,
                peer_reviews_to_give: prc.peer_reviews_to_give,
                peer_reviews_to_receive: prc.peer_reviews_to_receive,
            })
        }
        _ => None,
    };

    Ok(CourseMaterialExercise {
        exercise,
        can_post_submission,
        current_exercise_slide,
        exercise_status,
        exercise_slide_submission_counts,
        peer_review_config,
        previous_exercise_slide_submission,
    })
}

async fn determine_can_post_submission(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    exercise: &Exercise,
    user_exercise_state: &Option<UserExerciseState>,
) -> Result<bool, ModelError> {
    if let Some(user_exercise_state) = user_exercise_state {
        // Once the user has started peer review or self review, they cannot no longer answer the exercise because they have already seen a model solution in the review instructions and they have seen submissions from other users.
        if user_exercise_state.reviewing_stage != ReviewingStage::NotStarted {
            return Ok(false);
        }
    }

    let can_post_submission = if let Some(user_id) = user_id {
        if let Some(exam_id) = exercise.exam_id {
            exams::verify_exam_submission_can_be_made(conn, exam_id, user_id).await?
        } else {
            true
        }
    } else {
        false
    };
    Ok(can_post_submission)
}

pub async fn get_or_select_exercise_slide(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    exercise: &Exercise,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<(CourseMaterialExerciseSlide, Option<CourseInstanceOrExamId>)> {
    match (user_id, exercise.course_id, exercise.exam_id) {
        (None, ..) => {
            // No signed in user. Show random exercise without model solution.
            let random_slide =
                exercise_slides::get_random_exercise_slide_for_exercise(conn, exercise.id).await?;
            let random_slide_tasks = exercise_tasks::get_course_material_exercise_tasks(
                conn,
                random_slide.id,
                None,
                fetch_service_info,
            )
            .await?;
            Ok((
                CourseMaterialExerciseSlide {
                    id: random_slide.id,
                    exercise_tasks: random_slide_tasks,
                },
                None,
            ))
        }
        (Some(user_id), Some(course_id), None) => {
            // signed in, course exercise
            let user_course_settings = user_course_settings::get_user_course_settings_by_course_id(
                conn, user_id, course_id,
            )
            .await?;
            match user_course_settings {
                Some(settings) if settings.current_course_id == course_id => {
                    // User is enrolled on an instance of the given course.
                    let tasks =
                        exercise_tasks::get_or_select_user_exercise_tasks_for_course_instance_or_exam(
                            conn,
                            user_id,
                            exercise.id,
                            Some(settings.current_course_instance_id),
                            None,fetch_service_info
                        )
                        .await?;
                    Ok((
                        tasks,
                        Some(CourseInstanceOrExamId::Instance(
                            settings.current_course_instance_id,
                        )),
                    ))
                }
                Some(_) => {
                    // User is enrolled on a different language version of the course. Show exercise
                    // slide based on their latest enrollment or a random one.
                    let latest_instance =
                        course_instances::course_instance_by_users_latest_enrollment(
                            conn, user_id, course_id,
                        )
                        .await?;
                    if let Some(instance) = latest_instance {
                        let exercise_tasks =
                            exercise_tasks::get_existing_users_exercise_slide_for_course_instance(
                                conn,
                                user_id,
                                exercise.id,
                                instance.id,
                                &fetch_service_info,
                            )
                            .await?;
                        if let Some(exercise_tasks) = exercise_tasks {
                            Ok((
                                exercise_tasks,
                                Some(CourseInstanceOrExamId::Instance(instance.id)),
                            ))
                        } else {
                            // no exercise task has been chosen for the user
                            let random_slide =
                                exercise_slides::get_random_exercise_slide_for_exercise(
                                    conn,
                                    exercise.id,
                                )
                                .await?;
                            let random_tasks = exercise_tasks::get_course_material_exercise_tasks(
                                conn,
                                random_slide.id,
                                Some(user_id),
                                &fetch_service_info,
                            )
                            .await?;

                            Ok((
                                CourseMaterialExerciseSlide {
                                    id: random_slide.id,
                                    exercise_tasks: random_tasks,
                                },
                                None,
                            ))
                        }
                    } else {
                        // user has enrolled on a different course language version and haven't enrolled
                        // on this one. The idea is that they can look around the material but not submit
                        // without changing the language version, so show a random exercise.
                        let random_slide = exercise_slides::get_random_exercise_slide_for_exercise(
                            conn,
                            exercise.id,
                        )
                        .await?;
                        let random_tasks = exercise_tasks::get_course_material_exercise_tasks(
                            conn,
                            random_slide.id,
                            Some(user_id),
                            fetch_service_info,
                        )
                        .await?;

                        Ok((
                            CourseMaterialExerciseSlide {
                                id: random_slide.id,
                                exercise_tasks: random_tasks,
                            },
                            None,
                        ))
                    }
                }
                None => {
                    // User is not enrolled on any course version. This is not a valid scenario because
                    // tasks are based on a specific instance.
                    Err(ModelError::new(
                        ModelErrorType::PreconditionFailed,
                        "User must be enrolled to the course".to_string(),
                        None,
                    ))
                }
            }
        }
        (Some(user_id), _, Some(exam_id)) => {
            info!("selecting exam task");
            // signed in, exam exercise
            let tasks =
                exercise_tasks::get_or_select_user_exercise_tasks_for_course_instance_or_exam(
                    conn,
                    user_id,
                    exercise.id,
                    None,
                    Some(exam_id),
                    fetch_service_info,
                )
                .await?;
            info!("selecting exam task {:#?}", tasks);
            Ok((tasks, Some(CourseInstanceOrExamId::Exam(exam_id))))
        }
        (Some(_), ..) => Err(ModelError::new(
            ModelErrorType::Generic,
            "The selected exercise is not attached to any course or exam".to_string(),
            None,
        )),
    }
}

pub async fn delete_exercises_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let deleted_ids = sqlx::query!(
        "
UPDATE exercises
SET deleted_at = now()
WHERE page_id = $1
RETURNING id;
        ",
        page_id
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|x| x.id)
    .collect();
    Ok(deleted_ids)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        course_instance_enrollments::{self, NewCourseInstanceEnrollment},
        exercise_service_info::{self, PathInfo},
        exercise_services::{self, ExerciseServiceNewOrUpdate},
        test_helper::Conn,
        test_helper::*,
        user_exercise_states,
    };

    #[tokio::test]
    async fn selects_course_material_exercise_for_enrolled_student() {
        insert_data!(
            :tx,
            user: user_id,
            org: organization_id,
            course: course_id,
            instance: course_instance,
            :course_module,
            chapter: chapter_id,
            page: page_id,
            exercise: exercise_id,
            slide: exercise_slide_id,
            task: exercise_task_id
        );
        let exercise_service = exercise_services::insert_exercise_service(
            tx.as_mut(),
            &ExerciseServiceNewOrUpdate {
                name: "text-exercise".to_string(),
                slug: TEST_HELPER_EXERCISE_SERVICE_NAME.to_string(),
                public_url: "https://example.com".to_string(),
                internal_url: None,
                max_reprocessing_submissions_at_once: 1,
            },
        )
        .await
        .unwrap();
        let _exercise_service_info = exercise_service_info::insert(
            tx.as_mut(),
            &PathInfo {
                exercise_service_id: exercise_service.id,
                user_interface_iframe_path: "/iframe".to_string(),
                grade_endpoint_path: "/grade".to_string(),
                public_spec_endpoint_path: "/public-spec".to_string(),
                model_solution_spec_endpoint_path: "test-only-empty-path".to_string(),
            },
        )
        .await
        .unwrap();
        course_instance_enrollments::insert_enrollment_and_set_as_current(
            tx.as_mut(),
            NewCourseInstanceEnrollment {
                course_id,
                course_instance_id: course_instance.id,
                user_id,
            },
        )
        .await
        .unwrap();

        let user_exercise_state = user_exercise_states::get_user_exercise_state_if_exists(
            tx.as_mut(),
            user_id,
            exercise_id,
            CourseInstanceOrExamId::Instance(course_instance.id),
        )
        .await
        .unwrap();
        assert!(user_exercise_state.is_none());

        let exercise = get_course_material_exercise(
            tx.as_mut(),
            Some(user_id),
            exercise_id,
            |_| unimplemented!(),
        )
        .await
        .unwrap();
        assert_eq!(
            exercise
                .current_exercise_slide
                .exercise_tasks
                .get(0)
                .unwrap()
                .id,
            exercise_task_id
        );

        let user_exercise_state = user_exercise_states::get_user_exercise_state_if_exists(
            tx.as_mut(),
            user_id,
            exercise_id,
            CourseInstanceOrExamId::Instance(course_instance.id),
        )
        .await
        .unwrap();
        assert_eq!(
            user_exercise_state
                .unwrap()
                .selected_exercise_slide_id
                .unwrap(),
            exercise_slide_id
        );
    }
}
