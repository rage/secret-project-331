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

/// A file the host stored on a client's behalf. The host assigns `id`; a client never invents
/// one. Returned by the upload endpoint and echoed back by submission download.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UploadedFile {
    /// The host's file id. Names this file in a submit request.
    pub id: Uuid,
    /// The original file name the client sent.
    pub name: String,
    /// Direct download URL; needs no bearer token.
    pub download_url: String,
}

/// Response of `POST exercises/{id}/files`, in the same order as the request's parts.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UploadedFiles {
    pub files: Vec<UploadedFile>,
}

/// Body of `POST exercises/{id}/submit`. Plain JSON — no file parts, no archive. The host hands
/// `uploaded_file_ids` to the exercise service, which builds the answer.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    /// Ids from this exercise's `files` endpoint, in the order the exercise service should see
    /// them. May be empty for a service whose answer needs no files. Every id must have been
    /// uploaded by this user for this exercise.
    pub uploaded_file_ids: Vec<Uuid>,
}

/// Result of a submit. Carries both ids so a client never re-derives one from the other:
/// grading polling takes `task_submission_id`, download/share take `slide_submission_id`.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseTaskSubmissionResult {
    pub task_submission_id: Uuid,
    pub slide_submission_id: Uuid,
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

/// Response of `GET submissions/{id}/download`: the files the submission was made from, recovered
/// from the host's own file records rather than from the service's answer.
///
/// The same shape regardless of where the submission was made. A native client's uploads are
/// recorded as it names them; an answer made in the service's IFrame carries its files inside the
/// service's own answer, so the host asks the service to enumerate them and stores them the same
/// way. Empty only when the submission genuinely has no files — an exercise type with none, or a
/// service that declares no way to enumerate its answers' files.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SubmissionFiles {
    pub files: Vec<UploadedFile>,
}

/// The current user's progress across every exercise they can see in a course, returned
/// by `courses/{id}/progress` in a single round-trip. Course-level totals are not sent
/// separately; the client derives them by summing over `exercises` (e.g. total awarded =
/// `sum(score_given)`, total available = `sum(score_maximum)`).
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CourseProgress {
    /// The course these progress entries belong to; echoes the path id.
    pub course_id: Uuid,
    pub exercises: Vec<ExerciseProgress>,
}

/// The current user's progress on a single exercise.
///
/// A client derives a boolean "passed" from these fields. The authoritative signal is
/// `completed` (the exercise reached the `Completed` activity stage). A client that
/// instead treats "full points" as passing can use `score_given >= score_maximum` when
/// `score_maximum > 0`.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseProgress {
    pub exercise_id: Uuid,
    /// Points the user has been awarded, `0.0` when the user has no state for the exercise.
    pub score_given: f32,
    /// The maximum points obtainable from the exercise.
    pub score_maximum: i32,
    /// `true` once the exercise has reached the `Completed` activity stage. The primary
    /// "passed" signal.
    pub completed: bool,
    /// `true` once the user has started or submitted the exercise (any activity stage past
    /// the initial one), regardless of whether it is completed.
    pub attempted: bool,
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

    /// The submit body names ids only. No answer blob and no archive may appear in it: the
    /// exercise service owns the answer's shape, and the host has no archive concept left.
    #[test]
    fn exercise_slide_submission_carries_only_ids() {
        let file_id = Uuid::max();
        let value = serde_json::to_value(ExerciseSlideSubmission {
            exercise_slide_id: Uuid::nil(),
            exercise_task_id: Uuid::nil(),
            uploaded_file_ids: vec![file_id],
        })
        .unwrap();
        let obj = value.as_object().unwrap();
        assert!(obj.contains_key("exercise_slide_id"));
        assert!(obj.contains_key("exercise_task_id"));
        assert_eq!(obj["uploaded_file_ids"], json!([file_id]));
        assert!(!obj.contains_key("data_json"));
        assert_eq!(obj.len(), 3);
    }

    /// A client must never have to derive one submission id from the other; both come back.
    #[test]
    fn submit_result_carries_both_submission_ids() {
        let task_submission_id = Uuid::nil();
        let slide_submission_id = Uuid::max();
        let value = serde_json::to_value(ExerciseTaskSubmissionResult {
            task_submission_id,
            slide_submission_id,
        })
        .unwrap();
        assert_eq!(
            value,
            json!({
                "task_submission_id": task_submission_id,
                "slide_submission_id": slide_submission_id,
            })
        );
    }

    #[test]
    fn uploaded_and_submission_files_share_the_file_shape() {
        let id = Uuid::max();
        let file = || UploadedFile {
            id,
            name: "src/main.rs".to_string(),
            download_url: "http://project-331.local/api/v0/files/tmc/abc".to_string(),
        };
        let expected = json!({
            "files": [{
                "id": id,
                "name": "src/main.rs",
                "download_url": "http://project-331.local/api/v0/files/tmc/abc",
            }]
        });
        assert_eq!(
            serde_json::to_value(UploadedFiles {
                files: vec![file()]
            })
            .unwrap(),
            expected
        );
        assert_eq!(
            serde_json::to_value(SubmissionFiles {
                files: vec![file()]
            })
            .unwrap(),
            expected
        );
    }

    /// Not the normal path for any origin any more, but still representable: an exercise type with
    /// no files, or a service that cannot enumerate its answers' files.
    #[test]
    fn submission_files_may_be_empty() {
        assert_eq!(
            serde_json::to_value(SubmissionFiles { files: Vec::new() }).unwrap(),
            json!({ "files": [] })
        );
    }

    #[test]
    fn course_progress_shape() {
        let value = serde_json::to_value(CourseProgress {
            course_id: Uuid::nil(),
            exercises: vec![ExerciseProgress {
                exercise_id: Uuid::nil(),
                score_given: 1.5,
                score_maximum: 3,
                completed: false,
                attempted: true,
            }],
        })
        .unwrap();
        let obj = value.as_object().unwrap();
        assert!(obj.contains_key("course_id"));
        let exercises = obj["exercises"].as_array().unwrap();
        let ex = exercises[0].as_object().unwrap();
        assert_eq!(ex["score_given"], json!(1.5));
        assert_eq!(ex["score_maximum"], json!(3));
        assert_eq!(ex["completed"], json!(false));
        assert_eq!(ex["attempted"], json!(true));
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
