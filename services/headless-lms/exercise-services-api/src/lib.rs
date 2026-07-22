use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use uuid::Uuid;

pub type Token =
    oauth2::StandardTokenResponse<oauth2::EmptyExtraTokenFields, oauth2::basic::BasicTokenType>;

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Course {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub organization_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseSlide {
    pub slide_id: Uuid,
    pub exercise_id: Uuid,
    /// The course the exercise belongs to, so a client need not resolve it separately.
    pub course_id: Uuid,
    pub exercise_name: String,
    pub exercise_order_number: i32,
    pub deadline: Option<DateTime<Utc>>,
    pub tasks: Vec<ExerciseTask>,
}

// `public_spec` / `model_solution_spec` are plugin-owned blobs: the exercise service
// that produces them is the only component that interprets their shape, so the host
// forwards them verbatim and they stay opaque `serde_json::Value` here.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseTask {
    pub task_id: Uuid,
    pub order_number: i32,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub model_solution_spec: Option<serde_json::Value>,
    pub exercise_service_slug: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseTaskSubmissionResult {
    pub submission_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub enum ExerciseTaskSubmissionStatus {
    NoGradingYet,
    Grading {
        grading_progress: GradingProgress,
        score_given: Option<f32>,
        grading_started_at: Option<DateTime<Utc>>,
        grading_completed_at: Option<DateTime<Utc>>,
        feedback_json: Option<serde_json::Value>,
        feedback_text: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
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

/// A past submission of the current user to an exercise. `id` is the
/// exercise-slide-submission id, which is what `submissions/{id}/download` takes.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseSlideSubmissionListItem {
    pub id: Uuid,
    pub exercise_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub score_given: Option<f32>,
    pub grading_progress: Option<GradingProgress>,
}

/// The file-store URL of a submitted archive, which the client downloads directly.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SubmissionArchiveDownloadUrl {
    pub archive_download_url: String,
}

/// A shareable URL for a submission.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PasteResult {
    pub paste_url: String,
}

#[cfg(test)]
mod test {
    #![allow(clippy::unwrap_used)]
    use super::*;
    use serde_json::json;

    // Guards against utoipa/serde drift: the externally-tagged enum must stay the bare
    // string `"NoGradingYet"` and `{"Grading": {...}}`, which the OpenAPI spec documents
    // as a `oneOf` of exactly those two shapes.
    #[test]
    fn submission_status_serializes_externally_tagged() {
        assert_eq!(
            serde_json::to_value(ExerciseTaskSubmissionStatus::NoGradingYet).unwrap(),
            json!("NoGradingYet"),
        );

        let graded = ExerciseTaskSubmissionStatus::Grading {
            grading_progress: GradingProgress::FullyGraded,
            score_given: Some(1.0),
            grading_started_at: None,
            grading_completed_at: None,
            feedback_json: None,
            feedback_text: Some("ok".to_string()),
        };
        assert_eq!(
            serde_json::to_value(&graded).unwrap(),
            json!({
                "Grading": {
                    "grading_progress": "FullyGraded",
                    "score_given": 1.0,
                    "grading_started_at": null,
                    "grading_completed_at": null,
                    "feedback_json": null,
                    "feedback_text": "ok",
                }
            }),
        );
    }

    #[test]
    fn grading_progress_serializes_as_plain_strings() {
        assert_eq!(
            serde_json::to_value(GradingProgress::FullyGraded).unwrap(),
            json!("FullyGraded"),
        );
        assert_eq!(
            serde_json::to_value(GradingProgress::PendingManual).unwrap(),
            json!("PendingManual"),
        );
    }

    #[test]
    fn exercise_slide_submission_has_no_data_json() {
        // The submit `submission` part is just the two ids; the server derives
        // `data_json` itself.
        let value = serde_json::to_value(ExerciseSlideSubmission {
            exercise_slide_id: Uuid::nil(),
            exercise_task_id: Uuid::nil(),
        })
        .unwrap();
        let obj = value.as_object().unwrap();
        assert!(obj.contains_key("exercise_slide_id"));
        assert!(obj.contains_key("exercise_task_id"));
        assert!(!obj.contains_key("data_json"));
    }

    #[test]
    fn submission_list_item_shape() {
        let value = json!({
            "id": Uuid::nil(),
            "exercise_id": Uuid::nil(),
            "created_at": "2026-07-21T00:00:00Z",
            "score_given": 1.0,
            "grading_progress": "FullyGraded"
        });
        let item: ExerciseSlideSubmissionListItem = serde_json::from_value(value).unwrap();
        assert_eq!(item.score_given, Some(1.0));
        assert!(matches!(
            item.grading_progress,
            Some(GradingProgress::FullyGraded)
        ));
    }
}
