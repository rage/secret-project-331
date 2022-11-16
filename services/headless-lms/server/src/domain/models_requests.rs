use std::time::Duration;

use futures::{future::BoxFuture, FutureExt};
use headless_lms_models::{
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_task_gradings::{ExerciseTaskGradingRequest, ExerciseTaskGradingResult},
    exercise_task_submissions::ExerciseTaskSubmission,
    exercise_tasks::ExerciseTask,
    ModelError, ModelErrorType, ModelResult,
};
use headless_lms_utils::error::backend_error::BackendError;
use url::Url;

fn reqwest_err(err: reqwest::Error) -> ModelError {
    ModelError::new(
        ModelErrorType::Generic,
        format!("Error during request: {err}"),
        None,
    )
}

pub fn spec_fetcher(
    url: Url,
    private_spec: Option<&serde_json::Value>,
) -> BoxFuture<'static, ModelResult<serde_json::Value>> {
    let client = reqwest::Client::new();
    let req = client
        .post(url)
        .timeout(Duration::from_secs(120))
        .json(&private_spec)
        .send();
    async move {
        let res = req.await.map_err(reqwest_err)?;
        if !res.status().is_success() {
            let error = res.text().await.unwrap_or_default();
            return Err(ModelError::new(
                ModelErrorType::Generic,
                format!("Failed to generate spec for exercise: {}.", error,),
                None,
            ));
        }
        let json = res.json().await.map_err(reqwest_err)?;
        Ok(json)
    }
    .boxed()
}

pub fn fetch_service_info(url: Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> {
    async {
        let client = reqwest::Client::new();
        let res = client
            .get(url) // e.g. http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info
            .timeout(Duration::from_secs(120))
            .send()
            .await
            .map_err(reqwest_err)?;
        let status = res.status();
        if !status.is_success() {
            let response_url = res.url().to_string();
            let body = res.text().await.map_err(reqwest_err)?;
            warn!(url=?response_url, status=?status, body=?body, "Could not fetch service info.");
            return Err(ModelError::new(
                ModelErrorType::Generic,
                "Could not fetch service info.".to_string(),
                None,
            ));
        }
        let res = res
            .json::<ExerciseServiceInfoApi>()
            .await
            .map_err(reqwest_err)?;
        Ok(res)
    }
    .boxed()
}

// does not use async fn because the arguments should only be borrowed
// for the part before any async stuff happens
pub fn send_grading_request(
    grade_url: Url,
    exercise_task: &ExerciseTask,
    submission: &ExerciseTaskSubmission,
) -> BoxFuture<'static, ModelResult<ExerciseTaskGradingResult>> {
    let client = reqwest::Client::new();
    let req = client
        .post(grade_url)
        .timeout(Duration::from_secs(120))
        .json(&ExerciseTaskGradingRequest {
            exercise_spec: &exercise_task.private_spec,
            submission_data: &submission.data_json,
        });
    async {
        let res = req.send().await.map_err(reqwest_err)?;
        let status = res.status();
        if !status.is_success() {
            let response_body = res.text().await;
            error!(
                ?response_body,
                "Grading request returned an unsuccesful status code"
            );
            return Err(ModelError::new(
                ModelErrorType::Generic,
                "Grading failed".to_string(),
                None,
            ));
        }
        let obj = res
            .json::<ExerciseTaskGradingResult>()
            .await
            .map_err(reqwest_err)?;
        info!("Received a grading result: {:#?}", &obj);
        Ok(obj)
    }
    .boxed()
}
