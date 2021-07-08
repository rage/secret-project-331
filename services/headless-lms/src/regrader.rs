use crate::models::{
    self, exercise_service_info::ExerciseServiceInfo, exercise_services::ExerciseService,
    regrading_submissions::RegradingSubmission, submissions::GradingResult,
};
use anyhow::Result;
use futures::{
    future::FutureExt,
    stream::{FuturesUnordered, StreamExt},
};
use sqlx::PgPool;
use std::{
    collections::{HashMap, HashSet},
    convert::TryFrom,
    future::Future,
    pin::Pin,
    time::Duration,
};
use tokio::task::JoinHandle;

/**
Starts a thread that will periodically send regrading submissions to the corresponding exercise services for regrading.
*/
pub async fn start_regrading_thread(pool: PgPool) -> Result<JoinHandle<()>> {
    // fetch exercise services
    let mut conn = pool.acquire().await?;
    let mut exercise_services_by_type = HashMap::new();
    for exercise_service in models::exercise_services::get_exercise_services(&mut conn).await? {
        let info =
            models::exercise_service_info::get_service_info(&mut conn, exercise_service.id).await?;
        exercise_services_by_type.insert(exercise_service.slug.clone(), (exercise_service, info));
    }
    drop(conn);

    let handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            // do not stop the thread on error, report it and try again next tick
            if let Err(err) = regrader_inner(&pool, &exercise_services_by_type).await {
                tracing::error!("Error in regrader: {}", err);
            }
        }
    });
    Ok(handle)
}

async fn regrader_inner(
    pool: &PgPool,
    exercise_services_by_type: &HashMap<String, (ExerciseService, ExerciseServiceInfo)>,
) -> Result<()> {
    // stores all the futures which will resolve into new gradings
    let mut grading_futures =
        HashMap::<String, Vec<Pin<Box<dyn Future<Output = _> + Send + 'static>>>>::new();

    // get regradings
    let mut conn = pool.acquire().await?;
    let regrading_ids = models::regradings::get_uncompleted_regradings(&mut conn).await?;
    let mut incomplete_regradings = HashSet::new();
    for regrading_id in regrading_ids.iter().copied() {
        // for each regrading, process all related submissions
        let regrading_submissions =
            models::regrading_submissions::get_regrading_submissions(&mut conn, regrading_id)
                .await?;
        for regrading_submission in regrading_submissions {
            // for each submission, send to exercise service to be graded and store the future
            let submission =
                models::submissions::get_submission(&mut conn, regrading_submission.submission_id)
                    .await?;
            let exercise =
                models::exercises::get_exercise(&mut conn, submission.exercise_id).await?;
            let exercise_task = models::exercise_tasks::get_exercise_task_by_id(
                &mut conn,
                submission.exercise_task_id,
            )
            .await?;
            // get the corresponding exercise service
            if let Some((exercise_service, info)) =
                exercise_services_by_type.get(&exercise_task.exercise_type)
            {
                let not_ready_grading =
                    models::gradings::new_grading(&mut conn, &submission).await?;
                models::submissions::set_grading_id(&mut conn, not_ready_grading.id, submission.id)
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
                    let exercise_type = exercise_task.exercise_type.clone();
                    let grading_future = models::gradings::send_grading_request(
                        info,
                        exercise_task,
                        submission.clone(),
                    )
                    .map(|r| (regrading_submission, not_ready_grading, exercise, r));
                    let entry = grading_futures.entry(exercise_type).or_default();
                    entry.push(Box::pin(grading_future));
                } else {
                    // we can't send this submission right now, so mark the related regrading as incomplete
                    incomplete_regradings.insert(regrading_id);
                }
            } else {
                tracing::warn!(
                    "No exercise service found for type {}",
                    exercise_task.exercise_type
                );
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
        // update regrading submission grading
        let regrading_submission: RegradingSubmission = regrading_submission;
        models::regrading_submissions::set_grading_after_regrading(
            &mut conn,
            regrading_submission.id,
            new_grading.id,
        )
        .await?;
        let grading_result: GradingResult = grading_result?;
        models::gradings::update_grading(&mut conn, new_grading, grading_result, exercise).await?;
    }
    // update completed regradings
    for regrading_id in regrading_ids {
        if !incomplete_regradings.contains(&regrading_id) {
            models::regradings::set_regrading_completed_at(&mut conn, regrading_id).await?;
        }
    }
    Ok(())
}
