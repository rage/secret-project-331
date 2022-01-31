use std::{
    collections::{HashMap, HashSet},
    convert::TryFrom,
    future::Future,
    pin::Pin,
};

use anyhow::Result;
use futures::{
    future::FutureExt,
    stream::{FuturesUnordered, StreamExt},
};
use itertools::Itertools;
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_models::{
    self as models,
    exercise_service_info::ExerciseServiceInfo,
    exercise_services::{get_internal_grade_url, ExerciseService},
    exercise_task_submissions::GradingResult,
    exercises::{Exercise, GradingProgress},
    gradings::Grading,
    regrading_submissions::RegradingSubmission,
    ModelResult,
};

type GradingFutures =
    HashMap<String, Vec<Pin<Box<dyn Future<Output = GradingData> + Send + 'static>>>>;

pub async fn regrade(
    conn: &mut PgConnection,
    exercise_services_by_type: &HashMap<String, (ExerciseService, ExerciseServiceInfo)>,
) -> Result<()> {
    // stores all the futures which will resolve into new gradings
    let mut grading_futures = GradingFutures::new();
    // set of regradings that should not be marked as completed by the end
    let mut incomplete_regradings = HashSet::new();

    tracing::info!("fetching uncompleted regradings");
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
        .map(|v| v.1)
        .flatten()
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
                models::gradings::set_grading_progress(
                    &mut *conn,
                    grading.id,
                    GradingProgress::Failed,
                )
                .await?;
                continue;
            }
        };
        models::gradings::update_grading(&mut *conn, &grading, &grading_result, &exercise).await?;
        models::exercise_task_submissions::set_grading_id(
            &mut *conn,
            grading.id,
            regrading_submission.id,
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
) -> Result<RegradingStatus> {
    let mut regrading_status = RegradingStatus {
        exercise_services_full: false,
        missing_exercise_services: HashSet::new(),
    };

    // for each regrading, process all related submissions
    let regrading_submissions =
        models::regrading_submissions::get_regrading_submissions(&mut *conn, regrading_id).await?;
    tracing::info!(
        "found {} submissions for regrading {}",
        regrading_submissions.len(),
        regrading_id
    );
    for regrading_submission in regrading_submissions {
        // for each submission, send to exercise service to be graded and store the future

        if let Some(grading_id) = regrading_submission.grading_after_regrading {
            // this submission has previously been at least partially regraded
            let grading = models::gradings::get_by_id(&mut *conn, grading_id).await?;
            if grading.grading_progress == GradingProgress::FullyGraded {
                // already fully graded, continue to the next one
                continue;
            }
            // otherwise, attempt grading again
        }

        // create new grading for the submission
        let submission = models::exercise_task_submissions::get_submission(
            &mut *conn,
            regrading_submission.submission_id,
        )
        .await?;
        // Need to rethink this but just please compile for now
        let exercise_task = models::exercise_tasks::get_exercise_task_by_id(
            &mut *conn,
            submission.exercise_task_id,
        )
        .await?;
        let exercise_slide = models::exercise_slides::get_exercise_slide(
            &mut *conn,
            exercise_task.exercise_slide_id,
        )
        .await?
        .unwrap();
        let exercise = models::exercises::get_by_id(&mut *conn, exercise_slide.exercise_id).await?;
        let not_ready_grading =
            models::gradings::new_grading(&mut *conn, &exercise, &submission).await?;
        models::regrading_submissions::set_grading_after_regrading(
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
            models::gradings::set_grading_progress(
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
                let grading_future =
                    models::gradings::send_grading_request(grade_url, &exercise_task, &submission)
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
            models::gradings::set_grading_progress(
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
    regrading_submission: RegradingSubmission,
    grading: Grading,
    exercise: Exercise,
    exercise_service_result: ModelResult<GradingResult>,
}

#[cfg(test)]
mod test {
    use mockito::Matcher;
    use models::{
        exercise_services, exercise_slide_submissions::NewExerciseSlideSubmission,
        exercises::GradingProgress,
    };
    use serde_json::Value;

    use super::*;
    use crate::test_helper::{self, Data};

    #[tokio::test]
    async fn regrades_submission() {
        let mut conn = test_helper::Conn::init().await;
        let mut tx = conn.begin().await;

        let grading_result = GradingResult {
            grading_progress: models::exercises::GradingProgress::FullyGraded,
            score_given: 0.0,
            score_maximum: 100,
            feedback_text: None,
            feedback_json: None,
        };
        let _m = mockito::mock("POST", Matcher::Any)
            .with_body(serde_json::to_string(&grading_result).unwrap())
            .create();

        let Data {
            user,
            course,
            instance,
            exercise,
            exercise_slide,
            task,
            ..
        } = test_helper::insert_data(tx.as_mut(), "test-exercise")
            .await
            .unwrap();
        let slide_submission =
            models::exercise_slide_submissions::insert_exercise_slide_submission(
                tx.as_mut(),
                NewExerciseSlideSubmission {
                    course_id: Some(course),
                    course_instance_id: Some(instance),
                    exam_id: None,
                    exercise_id: exercise,
                    user_id: user,
                    exercise_slide_id: exercise_slide,
                },
            )
            .await
            .unwrap();
        let task_submission = models::exercise_task_submissions::insert(
            tx.as_mut(),
            slide_submission.id,
            exercise_slide,
            task,
            Value::Null,
        )
        .await
        .unwrap();
        let grading =
            models::gradings::insert(tx.as_mut(), task_submission, course, exercise, task)
                .await
                .unwrap();
        let regrading = models::regradings::insert(tx.as_mut()).await.unwrap();
        let regrading_submission_id =
            models::regrading_submissions::insert(tx.as_mut(), regrading, task_submission, grading)
                .await
                .unwrap();

        let exercise_service = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            &exercise_services::ExerciseServiceNewOrUpdate {
                name: "".to_string(),
                slug: "test-exercise".to_string(),
                public_url: "".to_string(),
                internal_url: Some(mockito::server_url()),
                max_reprocessing_submissions_at_once: 1,
            },
        )
        .await
        .unwrap();
        let info = models::exercise_service_info::insert(
            tx.as_mut(),
            &models::exercise_service_info::PathInfo {
                exercise_service_id: exercise_service.id,
                exercise_type_specific_user_interface_iframe: "/iframe".to_string(),
                grade_endpoint_path: "/grade".to_string(),
                public_spec_endpoint_path: "/public-spec".to_string(),
                model_solution_path: "/model-solution".to_string(),
            },
        )
        .await
        .unwrap();
        let mut services = HashMap::new();
        services.insert("test-exercise".to_string(), (exercise_service, info));

        let regrading_submission = models::regrading_submissions::get_regrading_submission(
            tx.as_mut(),
            regrading_submission_id,
        )
        .await
        .unwrap();
        assert!(regrading_submission.grading_after_regrading.is_none());

        regrade(tx.as_mut(), &services).await.unwrap();

        let regrading_submission = models::regrading_submissions::get_regrading_submission(
            tx.as_mut(),
            regrading_submission_id,
        )
        .await
        .unwrap();
        let new_grading = regrading_submission.grading_after_regrading.unwrap();
        let grading = models::gradings::get_by_id(tx.as_mut(), new_grading)
            .await
            .unwrap();
        assert_eq!(grading.score_given, Some(0.0))
    }

    #[tokio::test]
    async fn regrades_complete() {
        let mut conn = test_helper::Conn::init().await;
        let mut tx = conn.begin().await;

        let grading_result = GradingResult {
            grading_progress: models::exercises::GradingProgress::FullyGraded,
            score_given: 0.0,
            score_maximum: 100,
            feedback_text: None,
            feedback_json: None,
        };
        let _m = mockito::mock("POST", Matcher::Any)
            .with_body(serde_json::to_string(&grading_result).unwrap())
            .create();

        let Data {
            user,
            course,
            instance,
            exercise,
            exercise_slide,
            task,
            ..
        } = test_helper::insert_data(tx.as_mut(), "test-exercise-1")
            .await
            .unwrap();
        let slide_submission =
            models::exercise_slide_submissions::insert_exercise_slide_submission(
                tx.as_mut(),
                NewExerciseSlideSubmission {
                    exercise_slide_id: exercise_slide,
                    course_id: Some(course),
                    course_instance_id: Some(instance),
                    exam_id: None,
                    exercise_id: exercise,
                    user_id: user,
                },
            )
            .await
            .unwrap();
        let task_submission = models::exercise_task_submissions::insert(
            tx.as_mut(),
            slide_submission.id,
            exercise_slide,
            task,
            Value::Null,
        )
        .await
        .unwrap();
        let grading =
            models::gradings::insert(tx.as_mut(), task_submission, course, exercise, task)
                .await
                .unwrap();
        let regrading = models::regradings::insert(tx.as_mut()).await.unwrap();
        let _regrading_submission_id =
            models::regrading_submissions::insert(tx.as_mut(), regrading, task_submission, grading)
                .await
                .unwrap();

        let exercise_service = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            &exercise_services::ExerciseServiceNewOrUpdate {
                name: "".to_string(),
                slug: "test-exercise-3".to_string(),
                public_url: "".to_string(),
                internal_url: Some(mockito::server_url()),
                max_reprocessing_submissions_at_once: 1,
            },
        )
        .await
        .unwrap();
        let info = models::exercise_service_info::insert(
            tx.as_mut(),
            &models::exercise_service_info::PathInfo {
                exercise_service_id: exercise_service.id,
                exercise_type_specific_user_interface_iframe: "/iframe".to_string(),
                grade_endpoint_path: "/grade".to_string(),
                public_spec_endpoint_path: "/public-spec".to_string(),
                model_solution_path: "/model-solution".to_string(),
            },
        )
        .await
        .unwrap();
        let mut services = HashMap::new();
        services.insert("test-exercise-1".to_string(), (exercise_service, info));

        let regrading = models::regradings::get_by_id(tx.as_mut(), regrading)
            .await
            .unwrap();
        assert_eq!(regrading.total_grading_progress, GradingProgress::NotReady);
        assert!(regrading.regrading_started_at.is_none());
        assert!(regrading.regrading_completed_at.is_none());

        regrade(tx.as_mut(), &services).await.unwrap();

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
        let mut conn = test_helper::Conn::init().await;
        let mut tx = conn.begin().await;

        let grading_result = GradingResult {
            grading_progress: models::exercises::GradingProgress::FullyGraded,
            score_given: 0.0,
            score_maximum: 100,
            feedback_text: None,
            feedback_json: None,
        };
        let _m = mockito::mock("POST", Matcher::Any)
            .with_body(serde_json::to_string(&grading_result).unwrap())
            .create();

        let Data {
            user,
            course,
            instance,
            exercise,
            exercise_slide,
            task: task_1,
            ..
        } = test_helper::insert_data(tx.as_mut(), "test-exercise-1")
            .await
            .unwrap();
        let slide_2 = models::exercise_slides::insert(tx.as_mut(), exercise, 1)
            .await
            .unwrap();
        let task_2 = models::exercise_tasks::insert(
            tx.as_mut(),
            slide_2,
            "test-exercise-2",
            vec![],
            Value::Null,
            Value::Null,
            Value::Null,
        )
        .await
        .unwrap();
        let slide_submission_1 =
            models::exercise_slide_submissions::insert_exercise_slide_submission(
                tx.as_mut(),
                NewExerciseSlideSubmission {
                    exercise_slide_id: exercise_slide,
                    course_id: Some(course),
                    course_instance_id: Some(instance),
                    exam_id: None,
                    exercise_id: exercise,
                    user_id: user,
                },
            )
            .await
            .unwrap();
        let task_submission_1 = models::exercise_task_submissions::insert(
            tx.as_mut(),
            slide_submission_1.id,
            exercise_slide,
            task_1,
            Value::Null,
        )
        .await
        .unwrap();
        let slide_submission_2 =
            models::exercise_slide_submissions::insert_exercise_slide_submission(
                tx.as_mut(),
                NewExerciseSlideSubmission {
                    exercise_slide_id: slide_2,
                    course_id: Some(course),
                    course_instance_id: Some(instance),
                    exam_id: None,
                    exercise_id: exercise,
                    user_id: user,
                },
            )
            .await
            .unwrap();
        let task_submission_2 = models::exercise_task_submissions::insert(
            tx.as_mut(),
            slide_submission_2.id,
            slide_2,
            task_2,
            Value::Null,
        )
        .await
        .unwrap();
        let grading =
            models::gradings::insert(tx.as_mut(), task_submission_1, course, exercise, task_1)
                .await
                .unwrap();
        let regrading = models::regradings::insert(tx.as_mut()).await.unwrap();
        let _regrading_submission_1 = models::regrading_submissions::insert(
            tx.as_mut(),
            regrading,
            task_submission_1,
            grading,
        )
        .await
        .unwrap();
        let _regrading_submission_2 = models::regrading_submissions::insert(
            tx.as_mut(),
            regrading,
            task_submission_2,
            grading,
        )
        .await
        .unwrap();

        let exercise_service_1 = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            &exercise_services::ExerciseServiceNewOrUpdate {
                name: "".to_string(),
                slug: "test-exercise-1".to_string(),
                public_url: "".to_string(),
                internal_url: Some(mockito::server_url()),
                max_reprocessing_submissions_at_once: 1,
            },
        )
        .await
        .unwrap();
        let info_1 = models::exercise_service_info::insert(
            tx.as_mut(),
            &models::exercise_service_info::PathInfo {
                exercise_service_id: exercise_service_1.id,
                exercise_type_specific_user_interface_iframe: "/iframe".to_string(),
                grade_endpoint_path: "/grade".to_string(),
                public_spec_endpoint_path: "/public-spec".to_string(),
                model_solution_path: "/model-solution".to_string(),
            },
        )
        .await
        .unwrap();
        let exercise_service_2 = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            &exercise_services::ExerciseServiceNewOrUpdate {
                name: "".to_string(),
                slug: "test-exercise-2".to_string(),
                public_url: "".to_string(),
                internal_url: Some(mockito::server_url()),
                max_reprocessing_submissions_at_once: 0,
            },
        )
        .await
        .unwrap();
        let info_2 = models::exercise_service_info::insert(
            tx.as_mut(),
            &models::exercise_service_info::PathInfo {
                exercise_service_id: exercise_service_2.id,
                exercise_type_specific_user_interface_iframe: "/iframe".to_string(),
                grade_endpoint_path: "/grade".to_string(),
                public_spec_endpoint_path: "/public-spec".to_string(),
                model_solution_path: "/model-solution".to_string(),
            },
        )
        .await
        .unwrap();
        let mut services = HashMap::new();
        services.insert("test-exercise-1".to_string(), (exercise_service_1, info_1));
        services.insert("test-exercise-2".to_string(), (exercise_service_2, info_2));

        let regrading_2 = models::regradings::get_by_id(tx.as_mut(), regrading)
            .await
            .unwrap();
        assert_eq!(
            regrading_2.total_grading_progress,
            GradingProgress::NotReady
        );
        assert!(regrading_2.regrading_started_at.is_none());

        regrade(tx.as_mut(), &services).await.unwrap();

        let regrading_2 = models::regradings::get_by_id(tx.as_mut(), regrading)
            .await
            .unwrap();
        assert_eq!(regrading_2.total_grading_progress, GradingProgress::Pending);
        assert!(regrading_2.regrading_started_at.is_some());
        assert!(regrading_2.regrading_completed_at.is_none());
    }

    #[tokio::test]
    async fn fail_on_missing_service() {
        let mut conn = test_helper::Conn::init().await;
        let mut tx = conn.begin().await;

        let Data {
            user,
            course,
            instance,
            exercise,
            exercise_slide,
            task,
            ..
        } = test_helper::insert_data(tx.as_mut(), "test-exercise-1")
            .await
            .unwrap();
        let slide_submission =
            models::exercise_slide_submissions::insert_exercise_slide_submission(
                tx.as_mut(),
                NewExerciseSlideSubmission {
                    exercise_slide_id: exercise_slide,
                    course_id: Some(course),
                    course_instance_id: Some(instance),
                    exam_id: None,
                    exercise_id: exercise,
                    user_id: user,
                },
            )
            .await
            .unwrap();
        let task_submission = models::exercise_task_submissions::insert(
            tx.as_mut(),
            slide_submission.id,
            exercise_slide,
            task,
            Value::Null,
        )
        .await
        .unwrap();
        let grading =
            models::gradings::insert(tx.as_mut(), task_submission, course, exercise, task)
                .await
                .unwrap();
        let regrading = models::regradings::insert(tx.as_mut()).await.unwrap();
        let _regrading_submission =
            models::regrading_submissions::insert(tx.as_mut(), regrading, task_submission, grading)
                .await
                .unwrap();

        let services = HashMap::new();
        regrade(tx.as_mut(), &services).await.unwrap();

        let regrading = models::regradings::get_by_id(tx.as_mut(), regrading)
            .await
            .unwrap();
        assert_eq!(regrading.total_grading_progress, GradingProgress::Failed);
    }
}
