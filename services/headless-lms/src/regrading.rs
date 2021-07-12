use crate::models::{
    self, exercise_service_info::ExerciseServiceInfo, exercise_services::ExerciseService,
    exercises::GradingProgress, submissions::GradingResult,
};
use anyhow::Result;
use futures::{
    future::FutureExt,
    stream::{FuturesUnordered, StreamExt},
};
use sqlx::PgConnection;
use std::{
    collections::{HashMap, HashSet},
    convert::TryFrom,
    future::Future,
    pin::Pin,
};

pub async fn regrade(
    mut conn: &mut PgConnection,
    exercise_services_by_type: &HashMap<String, (ExerciseService, ExerciseServiceInfo)>,
) -> Result<()> {
    // stores all the futures which will resolve into new gradings
    let mut grading_futures =
        HashMap::<String, Vec<Pin<Box<dyn Future<Output = _> + Send + 'static>>>>::new();

    tracing::info!("fetching uncompleted regradings");
    let regrading_ids =
        models::regradings::get_uncompleted_regradings_and_mark_as_started(&mut *conn).await?;
    let mut incomplete_regradings = HashSet::new();
    for regrading_id in regrading_ids.iter().copied() {
        let mut sent_submission = false;
        // for each regrading, process all related submissions
        let regrading_submissions =
            models::regrading_submissions::get_regrading_submissions(&mut *conn, regrading_id)
                .await?;
        tracing::info!(
            "found {} submissions for regrading {}",
            regrading_submissions.len(),
            regrading_id
        );
        for regrading_submission in regrading_submissions {
            if regrading_submission.requires_manual_review.is_some() {
                continue;
            }

            // for each submission, send to exercise service to be graded and store the future
            let submission =
                models::submissions::get_submission(&mut *conn, regrading_submission.submission_id)
                    .await?;
            let exercise =
                models::exercises::get_exercise(&mut *conn, submission.exercise_id).await?;
            let exercise_task = models::exercise_tasks::get_exercise_task_by_id(
                &mut *conn,
                submission.exercise_task_id,
            )
            .await?;
            // get the corresponding exercise service
            if let Some((exercise_service, info)) =
                exercise_services_by_type.get(&exercise_task.exercise_type)
            {
                let not_ready_grading =
                    models::gradings::new_grading(&mut *conn, &submission).await?;
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
                    let grading_future = models::gradings::send_grading_request(
                        info,
                        exercise_task,
                        submission.clone(),
                    )
                    .map(|r| (regrading_submission, not_ready_grading, exercise, r));
                    entry.push(Box::pin(grading_future));
                    if !sent_submission {
                        sent_submission = true;
                        models::regradings::set_grading_progress(
                            &mut *conn,
                            regrading_id,
                            GradingProgress::Pending,
                        )
                        .await?;
                    }
                } else {
                    // we can't send this submission right now, so mark the related regrading as incomplete
                    incomplete_regradings.insert(regrading_id);
                }
            } else {
                let msg = format!(
                    "No exercise service found for type {}",
                    exercise_task.exercise_type
                );
                tracing::warn!("{}", msg);
                models::regrading_submissions::set_requires_manual_review(
                    &mut *conn,
                    regrading_submission.id,
                    &msg,
                )
                .await?;
            }
        }
    }

    // wait for all the submissions to be completed
    let mut grading_futures = grading_futures
        .into_iter()
        .map(|v| v.1)
        .flatten()
        .collect::<FuturesUnordered<_>>();
    while let Some((regrading_submission, new_grading, exercise, grading_result)) =
        grading_futures.next().await
    {
        if new_grading.grading_progress == GradingProgress::FullyGraded
            && regrading_submission.grading_after_regrading.is_none()
        {
            // update regrading submission grading
            models::regrading_submissions::set_grading_after_regrading(
                &mut conn,
                regrading_submission.id,
                new_grading.id,
            )
            .await?;
        }
        let grading_result: GradingResult = grading_result?;
        models::gradings::update_grading(&mut *conn, &new_grading, grading_result, exercise)
            .await?;
        models::submissions::set_grading_id(&mut *conn, new_grading.id, regrading_submission.id)
            .await?;
    }
    // update completed regradings
    for regrading_id in regrading_ids {
        if !incomplete_regradings.contains(&regrading_id) {
            models::regradings::complete_regrading(&mut conn, regrading_id).await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod test {
    use mockito::Matcher;
    use serde_json::Value;

    use super::*;
    use crate::{models::exercises::GradingProgress, test_helper};

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

        let (user, _org, course, instance, exercise, task) =
            test_helper::insert_user_organization_course_instance_exercise_task(
                tx.as_mut(),
                "test-exercise",
            )
            .await
            .unwrap();
        let submission =
            models::submissions::insert(tx.as_mut(), exercise, course, task, user, instance)
                .await
                .unwrap();
        let grading = models::gradings::insert(tx.as_mut(), submission, course, exercise, task)
            .await
            .unwrap();
        let regrading = models::regradings::insert(tx.as_mut()).await.unwrap();
        let regrading_submission_id =
            models::regrading_submissions::insert(tx.as_mut(), regrading, submission, grading)
                .await
                .unwrap();

        let exercise_service = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            "",
            "test-exercise",
            "",
            "",
            1,
        )
        .await
        .unwrap();
        let info = models::exercise_service_info::insert(
            tx.as_mut(),
            exercise_service.id,
            "",
            "",
            &mockito::server_url(),
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

        let (user, _org, course, instance, exercise, task) =
            test_helper::insert_user_organization_course_instance_exercise_task(
                tx.as_mut(),
                "test-exercise-1",
            )
            .await
            .unwrap();
        let submission =
            models::submissions::insert(tx.as_mut(), exercise, course, task, user, instance)
                .await
                .unwrap();
        let grading = models::gradings::insert(tx.as_mut(), submission, course, exercise, task)
            .await
            .unwrap();
        let regrading = models::regradings::insert(tx.as_mut()).await.unwrap();
        let _regrading_submission_id =
            models::regrading_submissions::insert(tx.as_mut(), regrading, submission, grading)
                .await
                .unwrap();

        let exercise_service = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            "",
            "test-exercise-1",
            "",
            "",
            1,
        )
        .await
        .unwrap();
        let info = models::exercise_service_info::insert(
            tx.as_mut(),
            exercise_service.id,
            "",
            "",
            &mockito::server_url(),
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

        let (user, _org, course, instance, exercise, task_1) =
            test_helper::insert_user_organization_course_instance_exercise_task(
                tx.as_mut(),
                "test-exercise-1",
            )
            .await
            .unwrap();
        let task_2 = models::exercise_tasks::insert(
            tx.as_mut(),
            exercise,
            "test-exercise-2",
            vec![],
            Value::Null,
            Value::Null,
        )
        .await
        .unwrap();
        let submission_1 =
            models::submissions::insert(tx.as_mut(), exercise, course, task_1, user, instance)
                .await
                .unwrap();
        let submission_2 =
            models::submissions::insert(tx.as_mut(), exercise, course, task_2, user, instance)
                .await
                .unwrap();
        let grading = models::gradings::insert(tx.as_mut(), submission_1, course, exercise, task_1)
            .await
            .unwrap();
        let regrading = models::regradings::insert(tx.as_mut()).await.unwrap();
        let _regrading_submission_1 =
            models::regrading_submissions::insert(tx.as_mut(), regrading, submission_1, grading)
                .await
                .unwrap();
        let _regrading_submission_2 =
            models::regrading_submissions::insert(tx.as_mut(), regrading, submission_2, grading)
                .await
                .unwrap();

        let exercise_service_1 = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            "",
            "test-exercise-1",
            "",
            "",
            1,
        )
        .await
        .unwrap();
        let info_1 = models::exercise_service_info::insert(
            tx.as_mut(),
            exercise_service_1.id,
            "",
            "",
            &mockito::server_url(),
        )
        .await
        .unwrap();
        let exercise_service_2 = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            "",
            "test-exercise-2",
            "",
            "",
            0,
        )
        .await
        .unwrap();
        let info_2 = models::exercise_service_info::insert(
            tx.as_mut(),
            exercise_service_2.id,
            "",
            "",
            &mockito::server_url(),
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
}
