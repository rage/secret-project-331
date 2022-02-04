use crate::{
    course_instances,
    exercise_slides::{self, CourseMaterialExerciseSlide},
    exercise_tasks,
    gradings::Grading,
    prelude::*,
    user_course_settings,
    user_exercise_states::get_user_exercise_state_if_exits,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
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
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct CourseMaterialExercise {
    pub exercise: Exercise,
    pub current_exercise_slide: CourseMaterialExerciseSlide,
    /// None for logged out users.
    pub exercise_status: Option<ExerciseStatus>,
    pub grading: Option<Grading>,
}

/**
Indicates what is the user's completion status for a exercise.

As close as possible to LTI's activity progress for compatibility: <https://www.imsglobal.org/spec/lti-ags/v2p0#activityprogress>.
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type, TS)]
#[sqlx(type_name = "activity_progress", rename_all = "snake_case")]
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

/**

Tells what's the status of the grading progress for a user and exercise.

As close as possible LTI's grading progress for compatibility: <https://www.imsglobal.org/spec/lti-ags/v2p0#gradingprogress>
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type, TS)]
#[sqlx(type_name = "grading_progress", rename_all = "kebab-case")]
pub enum GradingProgress {
    /// The grading process is completed; the score value, if any, represents the current Final Grade;
    FullyGraded,
    /// Final Grade is pending, but does not require manual intervention; if a Score value is present, it indicates the current value is partial and may be updated.
    Pending,
    /// Final Grade is pending, and it does require human intervention; if a Score value is present, it indicates the current value is partial and may be updated during the manual grading.
    PendingManual,
    /// The grading could not complete.
    Failed,
    /// There is no grading process occurring; for example, the student has not yet made any submission.
    NotReady,
}

impl GradingProgress {
    pub fn is_complete(self) -> bool {
        self == Self::FullyGraded || self == Self::Failed
    }
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct ExerciseStatus {
    // None when grading has not completed yet. Max score can be found from the associated exercise.
    pub score_given: Option<f32>,
    pub activity_progress: ActivityProgress,
    pub grading_progress: GradingProgress,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    name: &str,
    page_id: Uuid,
    chapter_id: Uuid,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercises (course_id, name, page_id, chapter_id, order_number)
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
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
    course_id: Uuid,
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
        course_id
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
  AND deleted_at IS NULL
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

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let course_id = sqlx::query!(
        r#"SELECT course_id AS "course_id!" FROM exercises WHERE id = $1 AND course_id IS NOT NULL"#,
        id
    )
    .fetch_one(conn)
    .await?
    .course_id;
    Ok(course_id)
}

pub async fn get_course_material_exercise(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    exercise_id: Uuid,
) -> ModelResult<CourseMaterialExercise> {
    let exercise = get_by_id(conn, exercise_id).await?;
    let (current_exercise_slide, instance_or_exam_id) =
        get_or_select_exercise_slide(&mut *conn, user_id, &exercise).await?;
    info!("{:#?}", current_exercise_slide);

    let _user_exercise_state = match (user_id, instance_or_exam_id) {
        (Some(user_id), Some(InstanceOrExamId::Instance(instance_id))) => {
            get_user_exercise_state_if_exits(conn, user_id, exercise.id, Some(instance_id), None)
                .await?
        }
        (Some(user_id), Some(InstanceOrExamId::Exam(exam_id))) => {
            get_user_exercise_state_if_exits(conn, user_id, exercise.id, None, Some(exam_id))
                .await?
        }
        _ => None,
    };

    // let mut score_given = None;
    // let mut activity_progress = ActivityProgress::Initialized;
    // let mut grading_progress = GradingProgress::NotReady;
    // if let Some(user_exercise_state) = user_exercise_state {
    //     score_given = user_exercise_state.score_given;
    //     activity_progress = user_exercise_state.activity_progress;
    //     grading_progress = user_exercise_state.grading_progress;
    // }

    // TODO: Figure out new grading stuff
    // let previous_submission = if let Some(user_id) = user_id {
    //     exercise_task_submissions::get_users_latest_exercise_task_submissions_for_exercise_slide(
    //         conn,
    //         &exercise_id,
    //         &user_id,
    //     )
    //     .await?
    //     .and_then(|mut submissions| submissions.pop())
    // } else {
    //     None
    // };
    // let grading = if let Some(grading_id) = previous_submission.as_ref().and_then(|s| s.grading_id)
    // {
    //     if let Some(user_id) = user_id {
    //         crate::gradings::get_for_student(conn, grading_id, user_id).await?
    //     } else {
    //         None
    //     }
    // } else {
    //     None
    // };
    // let exercise_status = if grading.is_some() {
    //     Some(ExerciseStatus {
    //         score_given,
    //         activity_progress,
    //         grading_progress,
    //     })
    // } else {
    //     None
    // };

    Ok(CourseMaterialExercise {
        exercise,
        current_exercise_slide,
        exercise_status: None,
        grading: None,
    })
}

enum InstanceOrExamId {
    Instance(Uuid),
    Exam(Uuid),
}

async fn get_or_select_exercise_slide(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    exercise: &Exercise,
) -> ModelResult<(CourseMaterialExerciseSlide, Option<InstanceOrExamId>)> {
    match (user_id, exercise.course_id, exercise.exam_id) {
        (None, ..) => {
            // No signed in user. Show random exercise without model solution.
            let random_slide =
                exercise_slides::get_random_exercise_slide_for_exercise(conn, exercise.id).await?;
            let random_slide_tasks = exercise_tasks::get_course_material_exercise_tasks(
                conn,
                &random_slide.id,
                None,
                false,
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
                            None,
                        )
                        .await?;
                    Ok((
                        tasks,
                        Some(InstanceOrExamId::Instance(
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
                            )
                            .await?;
                        if let Some(exercise_tasks) = exercise_tasks {
                            Ok((
                                exercise_tasks,
                                Some(InstanceOrExamId::Instance(instance.id)),
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
                                &random_slide.id,
                                Some(&user_id),
                                false,
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
                        // user is not enrolled on any instance related to the course
                        let random_slide = exercise_slides::get_random_exercise_slide_for_exercise(
                            conn,
                            exercise.id,
                        )
                        .await?;
                        let random_tasks = exercise_tasks::get_course_material_exercise_tasks(
                            conn,
                            &random_slide.id,
                            Some(&user_id),
                            false,
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
                    Err(ModelError::PreconditionFailed(
                        "User must be enrolled to the course".to_string(),
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
                )
                .await?;
            info!("selecting exam task {:#?}", tasks);
            Ok((tasks, Some(InstanceOrExamId::Exam(exam_id))))
        }
        (Some(_), ..) => Err(ModelError::Generic(
            "The selected exercise is not attached to any course or exam".to_string(),
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
    use headless_lms_utils::document_schema_processor::GutenbergBlock;
    use serde_json::{Map, Value};

    use super::*;
    use crate::{
        chapters,
        course_instance_enrollments::{self, NewCourseInstanceEnrollment},
        course_instances::{self, NewCourseInstance},
        course_language_groups, courses,
        exercise_service_info::{self, PathInfo},
        exercise_services::{self, ExerciseServiceNewOrUpdate},
        exercise_slides, exercise_tasks, organizations, pages,
        test_helper::Conn,
        user_exercise_states, users,
    };

    #[tokio::test]
    async fn selects_course_material_exercise_for_enrolled_student() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let user_id = users::insert_with_id(
            tx.as_mut(),
            "test@example.com",
            None,
            None,
            Uuid::parse_str("e656e0a1-3f55-4f52-b0ae-96855faee5e7").unwrap(),
        )
        .await
        .unwrap();
        let organization_id = organizations::insert(
            tx.as_mut(),
            "",
            "",
            "",
            Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669").unwrap(),
        )
        .await
        .unwrap();
        let course_language_group_id = course_language_groups::insert_with_id(
            tx.as_mut(),
            Uuid::parse_str("281384b3-bbc9-4da5-b93e-4c122784a724").unwrap(),
        )
        .await
        .unwrap();
        let course_id = courses::insert(
            tx.as_mut(),
            "",
            organization_id,
            course_language_group_id,
            "",
            "en-US",
            "",
        )
        .await
        .unwrap();
        let course_instance = course_instances::insert(
            tx.as_mut(),
            NewCourseInstance {
                id: Uuid::new_v4(),
                course_id,
                name: None,
                description: None,
                variant_status: None,
                teacher_in_charge_name: "teacher",
                teacher_in_charge_email: "teacher@example.com",
                support_email: None,
                opening_time: None,
                closing_time: None,
            },
        )
        .await
        .unwrap();
        let exercise_service = exercise_services::insert_exercise_service(
            tx.as_mut(),
            &ExerciseServiceNewOrUpdate {
                name: "text-exercise".to_string(),
                slug: "test-exercise".to_string(),
                public_url: "".to_string(),
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
                exercise_type_specific_user_interface_iframe: "".to_string(),
                grade_endpoint_path: "".to_string(),
                public_spec_endpoint_path: "".to_string(),
                model_solution_path: "test-only-empty-path".to_string(),
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
        let chapter_id = chapters::insert(tx.as_mut(), "", course_id, 0)
            .await
            .unwrap();
        let (page_id, _) = pages::insert(tx.as_mut(), course_id, "", "", 0, user_id)
            .await
            .unwrap();
        let exercise_id = super::insert(tx.as_mut(), course_id, "", page_id, chapter_id, 0)
            .await
            .unwrap();
        let exercise_slide_id = exercise_slides::insert(tx.as_mut(), exercise_id, 0)
            .await
            .unwrap();
        let exercise_task_id = exercise_tasks::insert(
            tx.as_mut(),
            exercise_slide_id,
            "test-exercise",
            vec![GutenbergBlock {
                attributes: Map::new(),
                client_id: Uuid::new_v4(),
                inner_blocks: vec![],
                is_valid: true,
                name: "".to_string(),
            }],
            Value::Null,
            Value::Null,
            Value::Null,
        )
        .await
        .unwrap();

        let user_exercise_state = user_exercise_states::get_user_exercise_state_if_exits(
            tx.as_mut(),
            user_id,
            exercise_id,
            Some(course_instance.id),
            None,
        )
        .await
        .unwrap();
        assert!(user_exercise_state.is_none());

        let exercise = get_course_material_exercise(tx.as_mut(), Some(user_id), exercise_id)
            .await
            .unwrap();
        assert_eq!(
            exercise
                .current_exercise_slide
                .exercise_tasks
                .iter()
                .next()
                .unwrap()
                .id,
            exercise_task_id
        );

        let user_exercise_state = user_exercise_states::get_user_exercise_state_if_exits(
            tx.as_mut(),
            user_id,
            exercise_id,
            Some(course_instance.id),
            None,
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
