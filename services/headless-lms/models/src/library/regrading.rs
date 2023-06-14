use std::{
    collections::{HashMap, HashSet},
    convert::TryFrom,
    future::Future,
    pin::Pin,
};

use futures::{
    future::{BoxFuture, FutureExt},
    stream::{FuturesUnordered, StreamExt},
};
use itertools::Itertools;
use sqlx::PgConnection;
use url::Url;

use crate::{
    self as models,
    exercise_service_info::ExerciseServiceInfo,
    exercise_services::{get_internal_grade_url, ExerciseService},
    exercise_task_gradings::{ExerciseTaskGrading, ExerciseTaskGradingResult},
    exercise_task_regrading_submissions::ExerciseTaskRegradingSubmission,
    exercise_task_submissions::ExerciseTaskSubmission,
    exercise_tasks::ExerciseTask,
    exercises::{Exercise, GradingProgress},
    prelude::*,
    ModelResult,
};

type GradingFutures =
    HashMap<String, Vec<Pin<Box<dyn Future<Output = GradingData> + Send + 'static>>>>;

pub async fn regrade(
    conn: &mut PgConnection,
    exercise_services_by_type: &HashMap<String, (ExerciseService, ExerciseServiceInfo)>,
    send_grading_request: impl Fn(
        Url,
        &ExerciseTask,
        &ExerciseTaskSubmission,
    ) -> BoxFuture<'static, ModelResult<ExerciseTaskGradingResult>>,
) -> ModelResult<()> {
    // stores all the futures which will resolve into new gradings
    let mut grading_futures = GradingFutures::new();
    // set of regradings that should not be marked as completed by the end
    let mut incomplete_regradings = HashSet::new();

    tracing::debug!("fetching uncompleted regradings");
    let regrading_ids =
        models::regradings::get_uncompleted_regradings_and_mark_as_started(&mut *conn).await?;
    for regrading_id in regrading_ids.iter().copied() {
        // set regrading progress to pending
        models::regradings::set_total_grading_progress(
            &mut *conn,
            regrading_id,
            GradingProgress::Pending,
        )
        .await?;
        match do_single_regrading(
            conn,
            exercise_services_by_type,
            regrading_id,
            &mut grading_futures,
            &send_grading_request,
        )
        .await
        {
            Ok(regrading_status) => {
                if !regrading_status.missing_exercise_services.is_empty() {
                    let msg = format!(
                        "Regrading {} failed: no exercise service found for exercise types [{}]",
                        regrading_id,
                        regrading_status.missing_exercise_services.iter().join(", ")
                    );
                    tracing::error!("{}", msg);
                    models::regradings::set_error_message(conn, regrading_id, &msg).await?;
                    models::regradings::set_total_grading_progress(
                        conn,
                        regrading_id,
                        GradingProgress::Failed,
                    )
                    .await?;
                    incomplete_regradings.insert(regrading_id);
                } else if regrading_status.exercise_services_full {
                    incomplete_regradings.insert(regrading_id);
                }
            }
            Err(err) => {
                tracing::error!("Regrading {} failed: {}", regrading_id, err);
                models::regradings::set_error_message(conn, regrading_id, &err.to_string()).await?;
                models::regradings::set_total_grading_progress(
                    conn,
                    regrading_id,
                    GradingProgress::Failed,
                )
                .await?;
                incomplete_regradings.insert(regrading_id);
            }
        }
    }

    // wait for all the submissions to be completed
    let mut grading_futures = grading_futures
        .into_iter()
        .flat_map(|v| v.1)
        .collect::<FuturesUnordered<_>>();
    while let Some(GradingData {
        exercise_service_name,
        regrading_submission,
        grading,
        exercise,
        exercise_service_result,
    }) = grading_futures.next().await
    {
        let grading_result = match exercise_service_result {
            Ok(grading_result) => grading_result,
            Err(err) => {
                tracing::error!(
                    "Failed to get grading from exercise service {}: {}",
                    exercise_service_name,
                    err
                );
                models::exercise_task_gradings::set_grading_progress(
                    &mut *conn,
                    grading.id,
                    GradingProgress::Failed,
                )
                .await?;
                continue;
            }
        };
        models::library::grading::update_grading_with_single_regrading_result(
            conn,
            &exercise,
            &regrading_submission,
            &grading,
            &grading_result,
        )
        .await?;
    }
    // update completed regradings
    for regrading_id in regrading_ids {
        if !incomplete_regradings.contains(&regrading_id) {
            models::regradings::complete_regrading(conn, regrading_id).await?;
        }
    }
    Ok(())
}

struct RegradingStatus {
    exercise_services_full: bool,
    missing_exercise_services: HashSet<String>,
}

async fn do_single_regrading(
    conn: &mut PgConnection,
    exercise_services_by_type: &HashMap<String, (ExerciseService, ExerciseServiceInfo)>,
    regrading_id: Uuid,
    grading_futures: &mut GradingFutures,
    send_grading_request: impl Fn(
        Url,
        &ExerciseTask,
        &ExerciseTaskSubmission,
    ) -> BoxFuture<'static, ModelResult<ExerciseTaskGradingResult>>,
) -> ModelResult<RegradingStatus> {
    let mut regrading_status = RegradingStatus {
        exercise_services_full: false,
        missing_exercise_services: HashSet::new(),
    };

    // for each regrading, process all related submissions
    let regrading_submissions =
        models::exercise_task_regrading_submissions::get_regrading_submissions(
            &mut *conn,
            regrading_id,
        )
        .await?;
    tracing::info!(
        "found {} submissions for regrading {}",
        regrading_submissions.len(),
        regrading_id
    );
    for regrading_submission in regrading_submissions {
        // for each submission, send to exercise service to be graded and store the future

        if let Some(grading_id) = regrading_submission.grading_after_regrading {
            // this submission has previously been at least partially regraded
            let grading = models::exercise_task_gradings::get_by_id(&mut *conn, grading_id).await?;
            if grading.grading_progress == GradingProgress::FullyGraded {
                // already fully graded, continue to the next one
                continue;
            }
            // otherwise, attempt grading again
        }

        // create new grading for the submission
        let submission = models::exercise_task_submissions::get_submission(
            &mut *conn,
            regrading_submission.exercise_task_submission_id,
        )
        .await?;
        let exercise_slide =
            models::exercise_slides::get_exercise_slide(&mut *conn, submission.exercise_slide_id)
                .await?;
        let exercise = models::exercises::get_by_id(&mut *conn, exercise_slide.exercise_id).await?;
        let not_ready_grading =
            models::exercise_task_gradings::new_grading(&mut *conn, &exercise, &submission).await?;
        models::exercise_task_regrading_submissions::set_grading_after_regrading(
            conn,
            regrading_submission.id,
            not_ready_grading.id,
        )
        .await?;
        // get the corresponding exercise service
        let exercise_task = models::exercise_tasks::get_exercise_task_by_id(
            &mut *conn,
            submission.exercise_task_id,
        )
        .await?;
        if let Some((exercise_service, exercise_service_info)) =
            exercise_services_by_type.get(&exercise_task.exercise_type)
        {
            // mark the grading as pending
            models::exercise_task_gradings::set_grading_progress(
                &mut *conn,
                not_ready_grading.id,
                GradingProgress::Pending,
            )
            .await?;

            let entry = grading_futures
                .entry(exercise_task.exercise_type.clone())
                .or_default();

            // make sure we aren't sending too many requests
            let limit = usize::try_from(exercise_service.max_reprocessing_submissions_at_once)
                .unwrap_or_else(|_e| {
                    tracing::error!(
                        "{}: invalid max_reprocessing_submissions_at_once {}",
                        exercise_service.name,
                        exercise_service.max_reprocessing_submissions_at_once
                    );
                    usize::MAX
                });
            if entry.len() < limit {
                let exercise =
                    models::exercises::get_by_id(&mut *conn, exercise_slide.exercise_id).await?;
                let grade_url =
                    get_internal_grade_url(exercise_service, exercise_service_info).await?;

                let exercise_service_name = exercise_service.name.clone();
                let grading_future = send_grading_request(grade_url, &exercise_task, &submission)
                    .map(move |exercise_service_result| GradingData {
                        exercise_service_name,
                        regrading_submission,
                        grading: not_ready_grading,
                        exercise,
                        exercise_service_result,
                    });
                entry.push(Box::pin(grading_future));
            } else {
                // we can't send this submission right now
                regrading_status.exercise_services_full = true;
            }
        } else {
            let msg = format!(
                "No exercise services found for type {}",
                exercise_task.exercise_type,
            );
            tracing::error!("{}", msg);
            models::exercise_task_gradings::set_grading_progress(
                &mut *conn,
                not_ready_grading.id,
                GradingProgress::Failed,
            )
            .await?;
            regrading_status
                .missing_exercise_services
                .insert(exercise_task.exercise_type);
        }
    }
    Ok(regrading_status)
}

struct GradingData {
    exercise_service_name: String,
    regrading_submission: ExerciseTaskRegradingSubmission,
    grading: ExerciseTaskGrading,
    exercise: Exercise,
    exercise_service_result: ModelResult<ExerciseTaskGradingResult>,
}

#[cfg(test)]
mod test {
    use headless_lms_utils::numbers::f32_approx_eq;
    use mockito::{Matcher, ServerGuard};
    use models::{
        exercise_services,
        exercise_task_gradings::{ExerciseTaskGradingResult, UserPointsUpdateStrategy},
        exercise_tasks::NewExerciseTask,
        exercises::{self, GradingProgress},
        library::grading::{
            GradingPolicy, StudentExerciseSlideSubmission, StudentExerciseSlideSubmissionResult,
            StudentExerciseTaskSubmission,
        },
        user_exercise_states::{self, ExerciseWithUserState},
    };
    use serde_json::Value;

    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn regrades_submission() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise, :slide);
        let exercise = exercises::get_by_id(tx.as_mut(), exercise).await.unwrap();
        let task = models::exercise_tasks::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: slide,
                exercise_type: "test-exercise".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
                model_solution_spec: Some(Value::Null),
                order_number: 0,
            },
        )
        .await
        .unwrap();
        let grading_result = ExerciseTaskGradingResult {
            grading_progress: models::exercises::GradingProgress::FullyGraded,
            score_given: 0.0,
            score_maximum: 100,
            feedback_text: None,
            feedback_json: None,
            set_user_variables: Some(HashMap::new()),
        };
        let original_grading = create_initial_submission(
            tx.as_mut(),
            user,
            &exercise,
            instance.id,
            slide,
            StudentExerciseSlideSubmission {
                exercise_slide_id: slide,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: task,
                    data_json: Value::Null,
                }],
            },
            HashMap::from([(task, grading_result.clone())]),
        )
        .await
        .unwrap();

        let regrading = models::regradings::insert(
            tx.as_mut(),
            UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
        )
        .await
        .unwrap();
        let exercise_task_submission_result = original_grading
            .exercise_task_submission_results
            .first()
            .unwrap();
        let regrading_submission_id = models::exercise_task_regrading_submissions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            regrading,
            exercise_task_submission_result.submission.id,
            exercise_task_submission_result.grading.as_ref().unwrap().id,
        )
        .await
        .unwrap();
        let mut server = mockito::Server::new();
        let _m = server
            .mock("POST", Matcher::Any)
            .with_body(serde_json::to_string(&grading_result).unwrap())
            .create();
        let service = create_mock_service(tx.as_mut(), "test-exercise".to_string(), 1, &server)
            .await
            .unwrap();
        let services = HashMap::from([("test-exercise".to_string(), service)]);

        let regrading_submission =
            models::exercise_task_regrading_submissions::get_regrading_submission(
                tx.as_mut(),
                regrading_submission_id,
            )
            .await
            .unwrap();
        assert!(regrading_submission.grading_after_regrading.is_none());

        regrade(tx.as_mut(), &services, |_, _, _| {
            async {
                Ok(ExerciseTaskGradingResult {
                    grading_progress: GradingProgress::FullyGraded,
                    score_given: 0.0,
                    score_maximum: 1,
                    feedback_text: None,
                    feedback_json: None,
                    set_user_variables: None,
                })
            }
            .boxed()
        })
        .await
        .unwrap();

        let regrading_submission =
            models::exercise_task_regrading_submissions::get_regrading_submission(
                tx.as_mut(),
                regrading_submission_id,
            )
            .await
            .unwrap();
        let new_grading = regrading_submission.grading_after_regrading.unwrap();
        let grading = models::exercise_task_gradings::get_by_id(tx.as_mut(), new_grading)
            .await
            .unwrap();
        assert_eq!(grading.score_given, Some(0.0))
    }

    #[tokio::test]
    async fn regrades_complete() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise, :slide);
        let exercise = exercises::get_by_id(tx.as_mut(), exercise).await.unwrap();
        let task = models::exercise_tasks::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: slide,
                exercise_type: "test-exercise".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
                model_solution_spec: Some(Value::Null),
                order_number: 0,
            },
        )
        .await
        .unwrap();
        let grading_result = ExerciseTaskGradingResult {
            grading_progress: models::exercises::GradingProgress::FullyGraded,
            score_given: 0.0,
            score_maximum: 100,
            feedback_text: None,
            feedback_json: None,
            set_user_variables: Some(HashMap::new()),
        };
        let original_grading = create_initial_submission(
            tx.as_mut(),
            user,
            &exercise,
            instance.id,
            slide,
            StudentExerciseSlideSubmission {
                exercise_slide_id: slide,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: task,
                    data_json: Value::Null,
                }],
            },
            HashMap::from([(task, grading_result.clone())]),
        )
        .await
        .unwrap();
        let mut server = mockito::Server::new();
        let _m = server
            .mock("POST", Matcher::Any)
            .with_body(serde_json::to_string(&grading_result).unwrap())
            .create();
        let service = create_mock_service(tx.as_mut(), "test-exercise".to_string(), 1, &server)
            .await
            .unwrap();
        let services = HashMap::from([("test-exercise".to_string(), service)]);

        let regrading = models::regradings::insert(
            tx.as_mut(),
            UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
        )
        .await
        .unwrap();
        let exercise_task_submission_result = original_grading
            .exercise_task_submission_results
            .first()
            .unwrap();
        let _regrading_submission_id = models::exercise_task_regrading_submissions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            regrading,
            exercise_task_submission_result.submission.id,
            exercise_task_submission_result.grading.as_ref().unwrap().id,
        )
        .await
        .unwrap();

        let regrading = models::regradings::get_by_id(tx.as_mut(), regrading)
            .await
            .unwrap();
        assert_eq!(regrading.total_grading_progress, GradingProgress::NotReady);
        assert!(regrading.regrading_started_at.is_none());
        assert!(regrading.regrading_completed_at.is_none());

        regrade(tx.as_mut(), &services, |_, _, _| {
            async {
                Ok(ExerciseTaskGradingResult {
                    grading_progress: GradingProgress::FullyGraded,
                    score_given: 1.0,
                    score_maximum: 1,
                    feedback_text: None,
                    feedback_json: None,
                    set_user_variables: None,
                })
            }
            .boxed()
        })
        .await
        .unwrap();

        let regrading_1 = models::regradings::get_by_id(tx.as_mut(), regrading.id)
            .await
            .unwrap();
        assert_eq!(
            regrading_1.total_grading_progress,
            GradingProgress::FullyGraded
        );
        assert!(regrading_1.regrading_started_at.is_some());
        assert!(regrading_1.regrading_completed_at.is_some());
    }

    #[tokio::test]
    async fn regrades_partial() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise, slide: slide_1);
        let exercise = exercises::get_by_id(tx.as_mut(), exercise).await.unwrap();
        let grading_result = ExerciseTaskGradingResult {
            grading_progress: models::exercises::GradingProgress::FullyGraded,
            score_given: 0.0,
            score_maximum: 100,
            feedback_text: None,
            feedback_json: None,
            set_user_variables: Some(HashMap::new()),
        };

        let task_1 = models::exercise_tasks::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: slide_1,
                exercise_type: "test-exercise-1".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
                model_solution_spec: Some(Value::Null),
                order_number: 0,
            },
        )
        .await
        .unwrap();
        let original_grading_1 = create_initial_submission(
            tx.as_mut(),
            user,
            &exercise,
            instance.id,
            slide_1,
            StudentExerciseSlideSubmission {
                exercise_slide_id: slide_1,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: task_1,
                    data_json: Value::Null,
                }],
            },
            HashMap::from([(task_1, grading_result.clone())]),
        )
        .await
        .unwrap();
        let task_submission_result_1 = original_grading_1
            .exercise_task_submission_results
            .first()
            .unwrap();

        let slide_2 =
            models::exercise_slides::insert(tx.as_mut(), PKeyPolicy::Generate, exercise.id, 1)
                .await
                .unwrap();
        let task_2 = models::exercise_tasks::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: slide_2,
                exercise_type: "test-exercise-2".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
                model_solution_spec: Some(Value::Null),
                order_number: 0,
            },
        )
        .await
        .unwrap();
        let original_grading_2 = create_initial_submission(
            tx.as_mut(),
            user,
            &exercise,
            instance.id,
            slide_2,
            StudentExerciseSlideSubmission {
                exercise_slide_id: slide_2,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: task_2,
                    data_json: Value::Null,
                }],
            },
            HashMap::from([(task_2, grading_result.clone())]),
        )
        .await
        .unwrap();
        user_exercise_states::upsert_selected_exercise_slide_id(
            tx.as_mut(),
            user,
            exercise.id,
            Some(instance.id),
            None,
            Some(slide_2),
        )
        .await
        .unwrap();
        let task_submission_result_2 = original_grading_2
            .exercise_task_submission_results
            .first()
            .unwrap();
        let mut server = mockito::Server::new();
        let _m = server
            .mock("POST", Matcher::Any)
            .with_body(serde_json::to_string(&grading_result).unwrap())
            .create();
        let service_1 = create_mock_service(tx.as_mut(), "test-exercise-1".to_string(), 1, &server)
            .await
            .unwrap();
        let service_2 = create_mock_service(tx.as_mut(), "test-exercise-2".to_string(), 0, &server)
            .await
            .unwrap();
        let services = HashMap::from([
            ("test-exercise-1".to_string(), service_1),
            ("test-exercise-2".to_string(), service_2),
        ]);

        let regrading = models::regradings::insert(
            tx.as_mut(),
            UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
        )
        .await
        .unwrap();
        let _regrading_submission_1 = models::exercise_task_regrading_submissions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            regrading,
            task_submission_result_1.submission.id,
            task_submission_result_1.grading.as_ref().unwrap().id,
        )
        .await
        .unwrap();
        let _regrading_submission_2 = models::exercise_task_regrading_submissions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            regrading,
            task_submission_result_2.submission.id,
            task_submission_result_2.grading.as_ref().unwrap().id,
        )
        .await
        .unwrap();

        let regrading_2 = models::regradings::get_by_id(tx.as_mut(), regrading)
            .await
            .unwrap();
        assert_eq!(
            regrading_2.total_grading_progress,
            GradingProgress::NotReady
        );
        assert!(regrading_2.regrading_started_at.is_none());

        regrade(tx.as_mut(), &services, |_, _, _| {
            async {
                Ok(ExerciseTaskGradingResult {
                    grading_progress: GradingProgress::Pending,
                    score_given: 0.0,
                    score_maximum: 1,
                    feedback_text: None,
                    feedback_json: None,
                    set_user_variables: None,
                })
            }
            .boxed()
        })
        .await
        .unwrap();

        let regrading_2 = models::regradings::get_by_id(tx.as_mut(), regrading)
            .await
            .unwrap();
        assert_eq!(regrading_2.total_grading_progress, GradingProgress::Pending);
        assert!(regrading_2.regrading_started_at.is_some());
        assert!(regrading_2.regrading_completed_at.is_none());
    }

    #[tokio::test]
    async fn updates_exercise_state() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise, :slide);
        let exercise = exercises::get_by_id(tx.as_mut(), exercise).await.unwrap();
        let task = models::exercise_tasks::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: slide,
                exercise_type: "test-exercise".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
                model_solution_spec: Some(Value::Null),
                order_number: 0,
            },
        )
        .await
        .unwrap();
        let original_grading = create_initial_submission(
            tx.as_mut(),
            user,
            &exercise,
            instance.id,
            slide,
            StudentExerciseSlideSubmission {
                exercise_slide_id: slide,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: task,
                    data_json: Value::Null,
                }],
            },
            HashMap::from([(
                task,
                ExerciseTaskGradingResult {
                    grading_progress: models::exercises::GradingProgress::FullyGraded,
                    score_given: 0.0,
                    score_maximum: 100,
                    feedback_text: None,
                    feedback_json: None,
                    set_user_variables: Some(HashMap::new()),
                },
            )]),
        )
        .await
        .unwrap();
        let mut server = mockito::Server::new();
        let _m = server
            .mock("POST", Matcher::Any)
            .with_body(
                serde_json::to_string(&ExerciseTaskGradingResult {
                    grading_progress: models::exercises::GradingProgress::FullyGraded,
                    score_given: 100.0,
                    score_maximum: 100,
                    feedback_text: None,
                    feedback_json: None,
                    set_user_variables: Some(HashMap::new()),
                })
                .unwrap(),
            )
            .create();
        let service = create_mock_service(tx.as_mut(), "test-exercise".to_string(), 1, &server)
            .await
            .unwrap();
        let services = HashMap::from([("test-exercise".to_string(), service)]);

        let regrading = models::regradings::insert(
            tx.as_mut(),
            UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
        )
        .await
        .unwrap();
        let exercise_task_submission_result = original_grading
            .exercise_task_submission_results
            .first()
            .unwrap();
        let _regrading_submission_id = models::exercise_task_regrading_submissions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            regrading,
            exercise_task_submission_result.submission.id,
            exercise_task_submission_result.grading.as_ref().unwrap().id,
        )
        .await
        .unwrap();

        let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
            tx.as_mut(),
            user,
            exercise.id,
            Some(instance.id),
            None,
        )
        .await
        .unwrap();
        assert!(
            f32_approx_eq(user_exercise_state.score_given.unwrap(), 0.0),
            "{} != {}",
            user_exercise_state.score_given.unwrap(),
            0.0
        );

        regrade(tx.as_mut(), &services, |_, _, _| {
            async {
                Ok(ExerciseTaskGradingResult {
                    grading_progress: GradingProgress::FullyGraded,
                    score_given: 1.0,
                    score_maximum: 1,
                    feedback_text: None,
                    feedback_json: None,
                    set_user_variables: None,
                })
            }
            .boxed()
        })
        .await
        .unwrap();

        let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
            tx.as_mut(),
            user,
            exercise.id,
            Some(instance.id),
            None,
        )
        .await
        .unwrap();
        assert!(
            f32_approx_eq(user_exercise_state.score_given.unwrap(), 1.0),
            "{} != {}",
            user_exercise_state.score_given.unwrap(),
            1.0
        );
    }

    #[tokio::test]
    async fn fail_on_missing_service() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise, :slide, :task);
        let exercise = exercises::get_by_id(tx.as_mut(), exercise).await.unwrap();
        let grading_result = ExerciseTaskGradingResult {
            grading_progress: models::exercises::GradingProgress::FullyGraded,
            score_given: 0.0,
            score_maximum: 100,
            feedback_text: None,
            feedback_json: None,
            set_user_variables: Some(HashMap::new()),
        };
        let original_grading = create_initial_submission(
            tx.as_mut(),
            user,
            &exercise,
            instance.id,
            slide,
            StudentExerciseSlideSubmission {
                exercise_slide_id: slide,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: task,
                    data_json: Value::Null,
                }],
            },
            HashMap::from([(task, grading_result.clone())]),
        )
        .await
        .unwrap();
        let exercise_task_submission_result = original_grading
            .exercise_task_submission_results
            .first()
            .unwrap();

        let regrading = models::regradings::insert(
            tx.as_mut(),
            UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
        )
        .await
        .unwrap();
        let _regrading_submission_id = models::exercise_task_regrading_submissions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            regrading,
            exercise_task_submission_result.submission.id,
            exercise_task_submission_result.grading.as_ref().unwrap().id,
        )
        .await
        .unwrap();

        let services = HashMap::new();
        regrade(tx.as_mut(), &services, |_, _, _| unimplemented!())
            .await
            .unwrap();

        let regrading = models::regradings::get_by_id(tx.as_mut(), regrading)
            .await
            .unwrap();
        assert_eq!(regrading.total_grading_progress, GradingProgress::Failed);
    }

    async fn create_initial_submission(
        conn: &mut PgConnection,
        user_id: Uuid,
        exercise: &Exercise,
        instance_id: Uuid,
        exercise_slide_id: Uuid,
        submission: StudentExerciseSlideSubmission,
        mock_results: HashMap<Uuid, ExerciseTaskGradingResult>,
    ) -> ModelResult<StudentExerciseSlideSubmissionResult> {
        user_exercise_states::upsert_selected_exercise_slide_id(
            conn,
            user_id,
            exercise.id,
            Some(instance_id),
            None,
            Some(exercise_slide_id),
        )
        .await?;
        let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
            conn,
            user_id,
            exercise.id,
            Some(instance_id),
            None,
        )
        .await?;
        let mut exercise_with_user_state =
            ExerciseWithUserState::new(exercise.clone(), user_exercise_state).unwrap();
        let grading = crate::library::grading::grade_user_submission(
            conn,
            &mut exercise_with_user_state,
            submission,
            GradingPolicy::Fixed(mock_results),
            |_| unimplemented!(),
            |_, _, _| unimplemented!(),
        )
        .await
        .unwrap();
        Ok(grading)
    }

    async fn create_mock_service(
        conn: &mut PgConnection,
        service_slug: String,
        max_reprocessing_submissions_at_once: i32,
        server: &ServerGuard,
    ) -> ModelResult<(ExerciseService, ExerciseServiceInfo)> {
        let exercise_service = models::exercise_services::insert_exercise_service(
            conn,
            &exercise_services::ExerciseServiceNewOrUpdate {
                name: "".to_string(),
                slug: service_slug,
                public_url: "".to_string(),
                internal_url: Some(server.url()),
                max_reprocessing_submissions_at_once,
            },
        )
        .await?;
        let info = models::exercise_service_info::insert(
            conn,
            &models::exercise_service_info::PathInfo {
                exercise_service_id: exercise_service.id,
                user_interface_iframe_path: "/iframe".to_string(),
                grade_endpoint_path: "/grade".to_string(),
                public_spec_endpoint_path: "/public-spec".to_string(),
                model_solution_spec_endpoint_path: "/model-solution".to_string(),
            },
        )
        .await?;

        Ok((exercise_service, info))
    }
}
