use futures::future::BoxFuture;
use itertools::Itertools;
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
    peer_review_question_submissions::PeerReviewQuestionSubmission,
    peer_review_questions::PeerReviewQuestion,
    peer_review_queue_entries::PeerReviewQueueEntry,
    peer_review_submissions::PeerReviewSubmission,
    prelude::*,
    teacher_grading_decisions::{TeacherDecisionType, TeacherGradingDecision},
    user_course_instance_exercise_service_variables::UserCourseInstanceExerciseServiceVariable,
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
    pub exercise_language_group_id: Option<Uuid>,
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseGradingStatus {
    pub exercise_id: Uuid,
    pub exercise_name: String,
    pub score_maximum: i32,
    pub score_given: Option<f32>,
    pub teacher_decision: Option<TeacherDecisionType>,
    pub submission_id: Uuid,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseStatusSummaryForUser {
    pub exercise: Exercise,
    pub user_exercise_state: Option<UserExerciseState>,
    pub exercise_slide_submissions: Vec<ExerciseSlideSubmission>,
    pub given_peer_review_submissions: Vec<PeerReviewSubmission>,
    pub given_peer_review_question_submissions: Vec<PeerReviewQuestionSubmission>,
    pub received_peer_review_submissions: Vec<PeerReviewSubmission>,
    pub received_peer_review_question_submissions: Vec<PeerReviewQuestionSubmission>,
    pub peer_review_queue_entry: Option<PeerReviewQueueEntry>,
    pub teacher_grading_decision: Option<TeacherGradingDecision>,
    pub peer_review_questions: Vec<PeerReviewQuestion>,
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
    pub user_course_instance_exercise_service_variables:
        Vec<UserCourseInstanceExerciseServiceVariable>,
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

#[allow(clippy::too_many_arguments)]
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    course_id: Uuid,
    name: &str,
    page_id: Uuid,
    chapter_id: Uuid,
    order_number: i32,
) -> ModelResult<Uuid> {
    let course = crate::courses::get_course(conn, course_id).await?;
    let exercise_language_group_id = crate::exercise_language_groups::insert(
        conn,
        PKeyPolicy::Generate,
        course.course_language_group_id,
    )
    .await?;

    let res = sqlx::query!(
        "
INSERT INTO exercises (
    id,
    course_id,
    name,
    page_id,
    chapter_id,
    order_number,
    exercise_language_group_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        course_id,
        name,
        page_id,
        chapter_id,
        order_number,
        exercise_language_group_id,
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
) -> ModelResult<Vec<ExerciseGradingStatus>> {
    let exercises = sqlx::query_as!(
        ExerciseGradingStatus,
        r#"
        SELECT
        e.id as exercise_id,
        e.name as exercise_name,
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

    let user_course_instance_exercise_service_variables = match (user_id, instance_or_exam_id) {
        (Some(user_id), Some(course_instance_or_exam_id)) => {
            Some(crate::user_course_instance_exercise_service_variables::get_all_variables_for_user_and_course_instance_or_exam(conn, user_id, course_instance_or_exam_id).await?)
        }
        _ => None,
    }.unwrap_or_default();

    Ok(CourseMaterialExercise {
        exercise,
        can_post_submission,
        current_exercise_slide,
        exercise_status,
        exercise_slide_submission_counts,
        peer_review_config,
        user_course_instance_exercise_service_variables,
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

pub async fn set_exercise_to_use_exercise_specific_peer_review_config(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    needs_peer_review: bool,
    use_course_default_peer_review_config: bool,
) -> ModelResult<Uuid> {
    let id = sqlx::query!(
        "
UPDATE exercises
SET use_course_default_peer_review_config = $1,
  needs_peer_review = $2
WHERE id = $3
RETURNING id;
        ",
        use_course_default_peer_review_config,
        needs_peer_review,
        exercise_id
    )
    .fetch_one(conn)
    .await?;

    Ok(id.id)
}

pub async fn get_all_exercise_statuses_by_user_id_and_course_instance_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<ExerciseStatusSummaryForUser>> {
    let course_instance_or_exam_id =
        CourseInstanceOrExamId::from_instance_and_exam_ids(Some(course_instance_id), None)?;
    // Load all the data for this user from all the exercises to memory, and group most of them to HashMaps by exercise id
    let exercises =
        crate::exercises::get_exercises_by_course_instance_id(&mut *conn, course_instance_id)
            .await?;
    let mut user_exercise_states =
        crate::user_exercise_states::get_all_for_user_and_course_instance_or_exam(
            &mut *conn,
            user_id,
            course_instance_or_exam_id,
        )
        .await?
        .into_iter()
        .map(|ues| (ues.exercise_id, ues))
        .collect::<HashMap<_, _>>();
    let mut exercise_slide_submissions =
        crate::exercise_slide_submissions::get_users_all_submissions_for_course_instance_or_exam(
            &mut *conn,
            user_id,
            course_instance_or_exam_id,
        )
        .await?
        .into_iter()
        .into_group_map_by(|o| o.exercise_id);
    let mut given_peer_review_submissions = crate::peer_review_submissions::get_all_given_peer_review_submissions_for_user_and_course_instance(&mut *conn, user_id, course_instance_id).await?.into_iter()
        .into_group_map_by(|o| o.exercise_id);
    let mut received_peer_review_submissions = crate::peer_review_submissions::get_all_received_peer_review_submissions_for_user_and_course_instance(&mut *conn, user_id, course_instance_id).await?.into_iter()
        .into_group_map_by(|o| o.exercise_id);
    let given_peer_review_submission_ids = given_peer_review_submissions
        .values()
        .flatten()
        .map(|x| x.id)
        .collect::<Vec<_>>();
    let mut given_peer_review_question_submissions = crate::peer_review_question_submissions::get_question_submissions_from_from_peer_review_submission_ids(&mut *conn, &given_peer_review_submission_ids).await?
        .into_iter()
        .into_group_map_by(|o| {
            let peer_review_submission = given_peer_review_submissions.clone().into_iter()
                .find(|(_exercise_id, prs)| prs.iter().any(|p| p.id == o.peer_review_submission_id))
                .unwrap_or_else(|| (Uuid::nil(), vec![]));
            peer_review_submission.0
    });
    let received_peer_review_submission_ids = received_peer_review_submissions
        .values()
        .flatten()
        .map(|x| x.id)
        .collect::<Vec<_>>();
    let mut received_peer_review_question_submissions = crate::peer_review_question_submissions::get_question_submissions_from_from_peer_review_submission_ids(&mut *conn, &received_peer_review_submission_ids).await?.into_iter()
    .into_group_map_by(|o| {
        let peer_review_submission = received_peer_review_submissions.clone().into_iter()
            .find(|(_exercise_id, prs)| prs.iter().any(|p| p.id == o.peer_review_submission_id))
            .unwrap_or_else(|| (Uuid::nil(), vec![]));
        peer_review_submission.0
    });
    let mut peer_review_queue_entries =
        crate::peer_review_queue_entries::get_all_by_user_and_course_instance_ids(
            &mut *conn,
            course_instance_id,
            user_id,
        )
        .await?
        .into_iter()
        .map(|x| (x.exercise_id, x))
        .collect::<HashMap<_, _>>();
    let mut teacher_grading_decisions = crate::teacher_grading_decisions::get_all_latest_grading_decisions_by_user_id_and_course_instance_id(&mut *conn, user_id, course_instance_id).await?.into_iter()
    .filter_map(|tgd| {
        let user_exercise_state = user_exercise_states.clone().into_iter()
            .find(|(_exercise_id, ues)|  ues.id == tgd.user_exercise_state_id)?;
        Some((user_exercise_state.0, tgd))
    }).collect::<HashMap<_, _>>();
    let all_peer_review_question_ids = given_peer_review_question_submissions
        .iter()
        .chain(received_peer_review_question_submissions.iter())
        .flat_map(|(_exercise_id, prqs)| prqs.iter().map(|p| p.peer_review_question_id))
        .collect::<Vec<_>>();
    let all_peer_review_questions =
        crate::peer_review_questions::get_by_ids(&mut *conn, &all_peer_review_question_ids).await?;

    // Map all the data for all the exercises to be summaries of the data for each exercise.
    //
    // Since all data is in hashmaps grouped by exercise id, and we iterate though every
    // exercise id exactly once, we can just remove the data for the exercise from the
    // hashmaps and avoid extra copying.
    let res = exercises
        .into_iter()
        .map(|exercise| {
            let user_exercise_state = user_exercise_states.remove(&exercise.id);
            let exercise_slide_submissions = exercise_slide_submissions
                .remove(&exercise.id)
                .unwrap_or_default();
            let given_peer_review_submissions = given_peer_review_submissions
                .remove(&exercise.id)
                .unwrap_or_default();
            let received_peer_review_submissions = received_peer_review_submissions
                .remove(&exercise.id)
                .unwrap_or_default();
            let given_peer_review_question_submissions = given_peer_review_question_submissions
                .remove(&exercise.id)
                .unwrap_or_default();
            let received_peer_review_question_submissions =
                received_peer_review_question_submissions
                    .remove(&exercise.id)
                    .unwrap_or_default();
            let peer_review_queue_entry = peer_review_queue_entries.remove(&exercise.id);
            let teacher_grading_decision = teacher_grading_decisions.remove(&exercise.id);
            let peer_review_question_ids = given_peer_review_question_submissions
                .iter()
                .chain(received_peer_review_question_submissions.iter())
                .map(|prqs| prqs.peer_review_question_id)
                .collect::<Vec<_>>();
            let peer_review_questions = all_peer_review_questions
                .iter()
                .filter(|prq| peer_review_question_ids.contains(&prq.id))
                .cloned()
                .collect::<Vec<_>>();
            ExerciseStatusSummaryForUser {
                exercise,
                user_exercise_state,
                exercise_slide_submissions,
                given_peer_review_submissions,
                received_peer_review_submissions,
                given_peer_review_question_submissions,
                received_peer_review_question_submissions,
                peer_review_queue_entry,
                teacher_grading_decision,
                peer_review_questions,
            }
        })
        .collect::<Vec<_>>();
    Ok(res)
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
