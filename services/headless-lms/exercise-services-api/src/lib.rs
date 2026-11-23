//! Wire types for the exercise-services client API (`/api/v0/exercise-services/client`), the
//! HTTP surface a native client authenticates against and exchanges for course, exercise,
//! and submission data. Consumed externally by `tmc-langs-rust`, so it stays free of
//! server-internal dependencies; the `openapi` feature adds `utoipa::ToSchema` derives for the
//! server's own OpenAPI generation and is off by default for other consumers.
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use uuid::Uuid;

/// The token exchanged at the OAuth2 token endpoint; its `access_token` is the bearer token sent
/// with every other request in this API.
pub type Token =
    oauth2::StandardTokenResponse<oauth2::EmptyExtraTokenFields, oauth2::basic::BasicTokenType>;

/// The user the bearer token acts for, so a client can tell when a login switched accounts.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CurrentUser {
    /// Stable for the lifetime of the account.
    pub id: Uuid,
    /// The account's name as the user entered it, for showing which account is logged in. Absent
    /// when the user has not given one, and from a host that predates the field.
    #[serde(default)]
    pub name: Option<String>,
    /// Absent from a host that predates the field.
    #[serde(default)]
    pub email: Option<String>,
}

/// A course the current user is enrolled on or teaches.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Course {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    /// Denormalized so a client needn't resolve the owning organization separately.
    pub organization_name: String,
    /// The teacher's AI-use policy for the course, uninterpreted: what each value permits is the
    /// client's decision. Absent from a host that predates the field, which reads as `not_set`.
    #[serde(default)]
    pub ai_policy: CourseAiPolicy,
    /// The course material's front page. Absent from a host that predates the field.
    #[serde(default)]
    pub url: Option<String>,
    /// The course's language as an IETF BCP 47 tag, e.g. `en-US` or `fi-FI`. Absent from a host
    /// that predates the field.
    #[serde(default)]
    pub language_code: Option<String>,
    /// Shared by every language version of the course; versions are different courses with
    /// different exercises. Absent from a host that predates the field.
    #[serde(default)]
    pub language_group_id: Option<Uuid>,
    /// The language version of this course the user now studies, when they have moved from this
    /// course to another version. Absent otherwise, and from a host that predates the field.
    #[serde(default)]
    pub moved_to_course_id: Option<Uuid>,
    /// When the course run ended or ends; the course takes no new students from then on. Absent
    /// for a course with no end, and from a host that predates the field.
    #[serde(default)]
    pub closed_at: Option<DateTime<Utc>>,
    /// The course that continues this one after it ended, if its teacher named one.
    #[serde(default)]
    pub successor_course_id: Option<Uuid>,
    /// Whether the user has a live enrollment on the course. A course the user only teaches is
    /// listed without one, and submits to it are refused with `not_enrolled`. Absent from a host
    /// that predates the field.
    #[serde(default)]
    pub is_enrolled: Option<bool>,
    /// Whether the user teaches or assists on the course. Staff are served exercises of chapters
    /// that have not opened yet, and model solutions whatever their own progress.
    #[serde(default)]
    pub is_staff: bool,
}

/// A course's AI-use policy as chosen by its teacher.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum CourseAiPolicy {
    /// The teacher has not chosen a policy. AI use is not allowed by default.
    #[default]
    NotSet,
    /// AI may not be used at any point.
    NoAi,
    /// AI may be used for planning, such as brainstorming or outlining, but not in the final work.
    PlanningOnly,
    /// AI may be used for specific tasks only, with disclosure.
    Limited,
    /// AI may be used freely, with disclosure.
    FullUse,
    /// AI use is expected.
    Required,
    /// A value newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(other, skip_serializing)]
    Unrecognized,
}

/// One selected slide of an exercise, carrying only the tasks whose exercise service can serve
/// the requesting client. An exercise with no client-servable task, or whose slide also has tasks
/// the client cannot answer, is omitted entirely by endpoints that return this type, rather than
/// appearing with an empty `tasks`.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseSlide {
    pub slide_id: Uuid,
    pub exercise_id: Uuid,
    /// The course the exercise belongs to, so a client need not resolve it separately.
    pub course_id: Uuid,
    pub exercise_name: String,
    /// The exercise's position on its page, from 0. Positions repeat across pages; the course's
    /// exercise list is already in material order.
    pub exercise_order_number: i32,
    /// The effective deadline: the exercise's own, else its chapter's. Submissions are refused
    /// from this moment on.
    pub deadline: Option<DateTime<Utc>>,
    pub tasks: Vec<ExerciseTask>,
    /// The course material page the exercise is on, where the student can also see their latest
    /// submission and its grading. Absent from a host that predates the field.
    #[serde(default)]
    pub page_url: Option<String>,
    /// Absent for an exercise outside any chapter, and from a host that predates the field.
    #[serde(default)]
    pub chapter: Option<ExerciseChapter>,
}

/// The chapter an exercise belongs to, for grouping a course's exercises the way its material
/// does.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseChapter {
    pub id: Uuid,
    pub name: String,
    /// The chapter's position in the course, from 1.
    pub chapter_number: i32,
    /// The user's status in the course's chapter locking. Submissions to the chapter's exercises
    /// are refused unless it is `unlocked`. Absent when the course does not lock chapters, and from
    /// a host that predates the field.
    #[serde(default)]
    pub locking_status: Option<ChapterLockingStatus>,
}

/// Where the user is in a course's chapter locking, which opens chapters one at a time as the
/// previous ones are completed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum ChapterLockingStatus {
    /// The chapter's exercises can be submitted to.
    Unlocked,
    /// The user has completed the chapter and locked it; its exercises take no more submissions.
    CompletedAndLocked,
    /// The previous chapters must be completed first.
    NotUnlockedYet,
    /// A value newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(other, skip_serializing)]
    Unrecognized,
}

/// One task of an exercise slide, as produced by a specific exercise service.
///
/// `public_spec` / `model_solution_spec` are plugin-owned blobs: the exercise service
/// that produces them is the only component that interprets their shape, so the host
/// forwards them verbatim and they stay opaque `serde_json::Value` here.
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

/// Which of the two representations an answer is: the JSON in `data_json`, or the files in
/// `data_files`. A request that omits it means `Json`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum AnswerKind {
    Json,
    File,
}

/// A file the host stored on a client's behalf. The host assigns `id`; a client never invents
/// one. Returned by the upload endpoint and echoed back by submission download.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AnswerFile {
    /// The host's file id. Names this file in a submit request.
    pub id: Uuid,
    /// The original file name the client sent.
    pub name: String,
    pub mime: String,
    /// `None` for a file stored before the size was recorded; never a substitute zero, so a client
    /// can tell an unknown size from an empty file.
    pub size_bytes: Option<i64>,
    /// The file's position in the answer it belongs to. `None` for a file that is not part of an
    /// answer yet, which is every file the upload endpoint returns.
    pub order_number: Option<i32>,
    /// Direct download URL; needs no bearer token.
    pub url: String,
}

/// Response of `POST exercises/{id}/files`, in the same order as the request's parts.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UploadedFiles {
    pub data_files: Vec<AnswerFile>,
}

/// Body of `POST exercises/{id}/submit`. Plain JSON — no file parts, no archive: the previously
/// uploaded files named here are the answer.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    /// Absent means `json`. A client answering with files sends `file`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer_kind: Option<AnswerKind>,
    /// The exercise service's own JSON: the whole answer for a `json` answer, the service's
    /// metadata about the files for a `file` one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_json: Option<serde_json::Value>,
    /// Ids from this exercise's `files` endpoint, in the order they are to be graded and
    /// displayed. A `file` answer must name at least one, and every id must have been uploaded by
    /// this user for this exercise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_files: Option<Vec<Uuid>>,
}

/// Why a client stores an answer snapshot. Neither purpose is graded, uses a try or awards points,
/// and both are accepted after the deadline and when out of tries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum SnapshotPurpose {
    /// To share through `submissions/{id}/share`. Never deleted to make room for others, so
    /// rate limited per user and exercise.
    Paste,
    /// To keep the answer before discarding local changes. Only the newest few per user and
    /// exercise are kept, a number the host sets; storing another deletes the oldest.
    Backup,
}

/// Body of `POST exercises/{id}/snapshots`. Names files from this exercise's `files` endpoint
/// like a `file` submit does, uploaded with `?for=snapshot` so that a passed deadline or used-up
/// tries do not refuse the upload.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct NewAnswerSnapshot {
    pub purpose: SnapshotPurpose,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    /// The exercise service's own JSON about the files, as in a `file` submit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_json: Option<serde_json::Value>,
    /// At least one id, each uploaded by this user for this exercise.
    pub data_files: Vec<Uuid>,
}

/// Result of storing a snapshot. `snapshot_id` is what `submissions/{id}/download` (and, for a
/// paste, `submissions/{id}/share`) takes, and what the submissions list reports as the entry's `id`.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AnswerSnapshotResult {
    pub snapshot_id: Uuid,
}

/// Result of a submit. Carries both ids so a client never re-derives one from the other:
/// grading polling takes `task_submission_id`, download/share take `slide_submission_id`.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseTaskSubmissionResult {
    pub task_submission_id: Uuid,
    pub slide_submission_id: Uuid,
}

/// The grading status of a task submission, as polled after `submit`.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub enum ExerciseTaskSubmissionStatus {
    NoGradingYet,
    Grading {
        grading_progress: GradingProgress,
        /// What the grading gave this submission. Absent until grading has produced a value; a
        /// partial value while `grading_progress` is still pending. The exercise's awarded points
        /// need not include it while a teacher review is pending (see `exercise_progress`).
        score_given: Option<f32>,
        grading_started_at: Option<DateTime<Utc>>,
        grading_completed_at: Option<DateTime<Utc>>,
        /// Structured grading feedback, opaque like `ExerciseTask`'s spec fields: only the
        /// exercise service that produced it interprets its shape.
        feedback_json: Option<serde_json::Value>,
        /// Human-readable feedback, for a client to display as-is.
        feedback_text: Option<String>,
        /// The user's progress on the whole exercise as of this poll, so a client can record
        /// completion without a separate `courses/{id}/progress` round-trip. Absent for an exam
        /// exercise, and from a host that predates the field.
        #[serde(default)]
        exercise_progress: Option<ExerciseProgress>,
        /// The course material page of the exercise, anchored at the exercise, where the user's
        /// latest submission and its grading are shown. Absent for an exam exercise, and from a
        /// host that predates the field.
        #[serde(default)]
        submission_page_url: Option<String>,
    },
    /// A status newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(skip_serializing)]
    Unrecognized,
}

impl<'de> Deserialize<'de> for ExerciseTaskSubmissionStatus {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        /// The known statuses. A derived `#[serde(other)]` cannot catch an unknown variant that
        /// carries data, so anything this fails on reads as `Unrecognized` instead.
        #[derive(Deserialize)]
        enum Known {
            NoGradingYet,
            Grading {
                grading_progress: GradingProgress,
                score_given: Option<f32>,
                grading_started_at: Option<DateTime<Utc>>,
                grading_completed_at: Option<DateTime<Utc>>,
                feedback_json: Option<serde_json::Value>,
                feedback_text: Option<String>,
                #[serde(default)]
                exercise_progress: Option<ExerciseProgress>,
                #[serde(default)]
                submission_page_url: Option<String>,
            },
        }

        let value = serde_json::Value::deserialize(deserializer)?;
        let is_known_variant = match &value {
            serde_json::Value::String(name) => name == "NoGradingYet",
            serde_json::Value::Object(map) => map.len() == 1 && map.contains_key("Grading"),
            _ => false,
        };
        if !is_known_variant {
            return Ok(Self::Unrecognized);
        }
        Ok(
            match serde_json::from_value(value).map_err(serde::de::Error::custom)? {
                Known::NoGradingYet => Self::NoGradingYet,
                Known::Grading {
                    grading_progress,
                    score_given,
                    grading_started_at,
                    grading_completed_at,
                    feedback_json,
                    feedback_text,
                    exercise_progress,
                    submission_page_url,
                } => Self::Grading {
                    grading_progress,
                    score_given,
                    grading_started_at,
                    grading_completed_at,
                    feedback_json,
                    feedback_text,
                    exercise_progress,
                    submission_page_url,
                },
            },
        )
    }
}

/// How far along a task submission's grading is.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub enum GradingProgress {
    /// The grading could not complete.
    Failed,
    /// No grading has occurred yet, e.g. the student has made no submission.
    NotReady,
    /// Final grade pending, needs human intervention. `score_given`, if present, is partial and may still change.
    PendingManual,
    /// Final grade pending, no human intervention needed. `score_given`, if present, is partial and may still change.
    Pending,
    /// Grading is complete. `score_given`, if present, is the final grade.
    FullyGraded,
    /// A value newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(other, skip_serializing)]
    Unrecognized,
}

/// What an entry in the submissions list is.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum SubmissionKind {
    /// A graded submission.
    #[default]
    Submission,
    /// An ungraded snapshot stored to be shared.
    Paste,
    /// An ungraded snapshot stored before local changes were discarded.
    Backup,
    /// A value newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(other, skip_serializing)]
    Unrecognized,
}

/// A past submission or snapshot of the current user to an exercise. `id` is what
/// `submissions/{id}/download` takes, and `submissions/{id}/share` for anything but a backup.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseSlideSubmissionListItem {
    pub id: Uuid,
    pub exercise_id: Uuid,
    pub created_at: DateTime<Utc>,
    /// Always `None` for a snapshot.
    pub score_given: Option<f32>,
    /// Always `None` for a snapshot.
    pub grading_progress: Option<GradingProgress>,
    /// Absent from a host that predates the field, which lists only submissions.
    #[serde(default)]
    pub kind: SubmissionKind,
    /// Whether the entry has a live share link right now, whatever its kind: a paste can have been
    /// revoked, and a graded submission can have been shared from elsewhere.
    #[serde(default)]
    pub is_shared: bool,
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
    pub data_files: Vec<AnswerFile>,
}

/// The current user's progress across the course exercises this client is served, returned
/// by `courses/{id}/progress` in a single round-trip. Course-level totals are not sent
/// separately; the client derives them by summing over `exercises` (e.g. total awarded =
/// `sum(score_given)`, total available = `sum(score_maximum)`).
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CourseProgress {
    /// The course these progress entries belong to; echoes the path id.
    pub course_id: Uuid,
    /// The user's progress on the open chapters' exercises that `courses/{id}/exercises` lists.
    pub exercises: Vec<ExerciseProgress>,
    /// The chapters that have not opened yet, with the user's progress on the exercises that
    /// `courses/{id}/exercises` will list once the chapter opens; a chapter with none is left out.
    /// Those exercises are absent from `exercises` and from `courses/{id}/exercises` until the
    /// chapter opens, so a client must not take their absence to mean they were removed. Absent
    /// from a host that predates the field.
    #[serde(default)]
    pub closed_chapters: Vec<ClosedChapter>,
}

/// A chapter of the course that opens later.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ClosedChapter {
    pub id: Uuid,
    pub name: String,
    /// The chapter's position in the course, from 1.
    pub chapter_number: i32,
    pub opens_at: DateTime<Utc>,
    pub exercises: Vec<ExerciseProgress>,
}

/// The current user's progress on a single exercise.
///
/// `standing` is the client's passed/failed signal. `completed` is the activity stage, which
/// an exercise without peer or self review reaches on any graded submission, even one
/// worth 0 points.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ExerciseProgress {
    pub exercise_id: Uuid,
    /// Points the user has been awarded, `0.0` when the user has no state for the exercise.
    pub score_given: f32,
    /// The maximum points obtainable from the exercise.
    pub score_maximum: i32,
    /// `true` once the exercise has reached the `Completed` activity stage.
    pub completed: bool,
    /// `true` once the user has started or submitted the exercise (any activity stage past
    /// the initial one), regardless of whether it is completed.
    pub attempted: bool,
    /// Absent only from a host that predates the field.
    #[serde(default)]
    pub standing: Option<ExerciseStanding>,
    /// How many graded submissions the exercise accepts per slide. Absent when tries are
    /// unlimited, and from a host that predates the field.
    #[serde(default)]
    pub max_tries: Option<i32>,
    /// How many of `max_tries` are left on the slide the user answers. Absent when tries are
    /// unlimited, and from a host that predates the field.
    #[serde(default)]
    pub tries_left: Option<i32>,
    /// What the user's points wait for while a teacher review holds them back; `score_given` is
    /// `0.0` until then. Absent when no points are held back, including when the answer got its
    /// points before the course turned chapter locking on, and from a host that predates the field.
    #[serde(default)]
    pub pending_teacher_review: Option<PendingTeacherReview>,
    /// `true` once the exercise takes no more submissions from the user, whatever the chapter's
    /// `locking_status` says: their answer was locked for review, graded by a teacher, or locked
    /// unanswered with its chapter. Only a teacher resetting the exercise lifts it. Submits are
    /// refused with 403 `chapter_completed_and_locked` while the chapter is locked for the user,
    /// and with `exercise_locked` otherwise. Absent from a host that predates the field.
    #[serde(default)]
    pub exercise_locked: bool,
    /// Where the user's answer is in the exercise's review process, which runs in the course
    /// material. Absent while the user can still answer, and from a host that predates the field.
    #[serde(default)]
    pub reviewing_stage: Option<ReviewingStage>,
    /// A teacher's grading of the user's answer, which overrides the automatic score. Absent when
    /// no teacher has graded the current answer, when the teacher awarded full points or hid the
    /// grading, and from a host that predates the field.
    #[serde(default)]
    pub teacher_review: Option<TeacherReview>,
}

/// Where an answer is in the review process of an exercise that uses peer, self or teacher review.
/// Every stage takes no new answers; the reviews themselves are done in the course material.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum ReviewingStage {
    /// The user must give peer reviews to other students' answers.
    PeerReview,
    /// The user must review their own answer.
    SelfReview,
    /// The user has given their reviews and waits for others to review their answer.
    WaitingForPeerReviews,
    /// The answer waits for a teacher's grading.
    WaitingForTeacher,
    /// Reviews are done and points awarded; the answer is final.
    ReviewedAndLocked,
    /// The answer was locked with its chapter before any review.
    Locked,
    /// The chapter was locked before the user answered.
    NotAnsweredAndLocked,
    /// A value newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(other, skip_serializing)]
    Unrecognized,
}

/// A teacher's grading of the user's answer to an exercise, as the course material shows it.
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TeacherReview {
    pub decision: TeacherDecision,
    /// The points the teacher awarded, replacing the automatic score.
    pub score_given: f32,
    /// The teacher's written reasoning, if they gave any.
    pub justification: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// What a teacher decided about an answer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum TeacherDecision {
    ZeroPoints,
    CustomPoints,
    SuspectedPlagiarism,
    /// The answer was rejected and the exercise reset, so the user can answer again.
    RejectAndReset,
    UnauthorizedAiUse,
    BadAnswer,
    Other,
    /// A value newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(other, skip_serializing)]
    Unrecognized,
}

/// What a user's points on an exercise wait for when a teacher reviews answers before awarding
/// points.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum PendingTeacherReview {
    /// The answer is graded, but the course locks chapters and awards this exercise's points only
    /// after the user completes and locks its chapter and a teacher reviews the answer. The user
    /// can still submit until they lock the chapter.
    AwaitsChapterLock,
    /// The answer is waiting for a teacher's review, and the exercise is locked.
    AwaitsTeacher,
    /// A value newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(other, skip_serializing)]
    Unrecognized,
}

/// Where the user stands on an exercise, decided by the host so every client agrees.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub enum ExerciseStanding {
    /// No graded submission and no try used.
    NotAttempted,
    /// Below full points with tries left, still being graded, in peer or self review, or waiting
    /// for a teacher's review (`pending_teacher_review`).
    Attempted,
    /// A grading awarded full points. An exercise worth 0 points passes on its first grading.
    Passed,
    /// Below full points (0 included), the try limit is used up on every slide and no review is
    /// pending, so the score is final.
    OutOfTries,
    /// A value newer than this crate. Deserialize-only: serializing it is an error, and the
    /// OpenAPI schema omits it.
    #[serde(other, skip_serializing)]
    Unrecognized,
}

/// A shareable URL for a submission or paste.
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
            exercise_progress: Some(ExerciseProgress {
                exercise_id: Uuid::nil(),
                score_given: 1.0,
                score_maximum: 1,
                completed: true,
                attempted: true,
                standing: Some(ExerciseStanding::Passed),
                max_tries: None,
                tries_left: None,
                pending_teacher_review: None,
                exercise_locked: false,
                reviewing_stage: None,
                teacher_review: None,
            }),
            submission_page_url: None,
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
                    "exercise_progress": {
                        "exercise_id": Uuid::nil(),
                        "score_given": 1.0,
                        "score_maximum": 1,
                        "completed": true,
                        "attempted": true,
                        "standing": "Passed",
                        "max_tries": null,
                        "tries_left": null,
                        "pending_teacher_review": null,
                        "exercise_locked": false,
                        "reviewing_stage": null,
                        "teacher_review": null,
                    },
                    "submission_page_url": null,
                }
            }),
        );
    }

    /// A newer client must still read a host that predates `exercise_progress`.
    #[test]
    fn grading_without_exercise_progress_still_parses() {
        let status: ExerciseTaskSubmissionStatus = serde_json::from_value(json!({
            "Grading": {
                "grading_progress": "FullyGraded",
                "score_given": 1.0,
                "grading_started_at": null,
                "grading_completed_at": null,
                "feedback_json": null,
                "feedback_text": null,
            }
        }))
        .unwrap();
        assert!(matches!(
            status,
            ExerciseTaskSubmissionStatus::Grading {
                exercise_progress: None,
                ..
            }
        ));
    }

    #[test]
    fn course_ai_policy_wire_values() {
        for (policy, wire) in [
            (CourseAiPolicy::NotSet, "not_set"),
            (CourseAiPolicy::NoAi, "no_ai"),
            (CourseAiPolicy::PlanningOnly, "planning_only"),
            (CourseAiPolicy::Limited, "limited"),
            (CourseAiPolicy::FullUse, "full_use"),
            (CourseAiPolicy::Required, "required"),
        ] {
            assert_eq!(serde_json::to_value(policy).unwrap(), json!(wire));
            assert_eq!(
                serde_json::from_value::<CourseAiPolicy>(json!(wire)).unwrap(),
                policy
            );
        }
    }

    #[test]
    fn course_ai_policy_unknown_value_reads_as_unrecognized() {
        assert_eq!(
            serde_json::from_value::<CourseAiPolicy>(json!("some_future_policy")).unwrap(),
            CourseAiPolicy::Unrecognized
        );
        assert!(serde_json::to_value(CourseAiPolicy::Unrecognized).is_err());
    }

    /// A newer client must still read a host that predates `ai_policy`.
    #[test]
    fn course_without_ai_policy_reads_as_not_set() {
        let course: Course = serde_json::from_value(json!({
            "id": Uuid::nil(),
            "slug": "slug",
            "name": "name",
            "description": null,
            "organization_name": "org",
        }))
        .unwrap();
        assert_eq!(course.ai_policy, CourseAiPolicy::NotSet);
    }

    #[test]
    fn course_serializes_ai_policy() {
        let value = serde_json::to_value(Course {
            id: Uuid::nil(),
            slug: "slug".to_string(),
            name: "name".to_string(),
            description: None,
            organization_name: "org".to_string(),
            ai_policy: CourseAiPolicy::FullUse,
            url: None,
            language_code: None,
            language_group_id: None,
            moved_to_course_id: None,
            closed_at: None,
            successor_course_id: None,
            is_enrolled: None,
            is_staff: false,
        })
        .unwrap();
        assert_eq!(value["ai_policy"], json!("full_use"));
    }

    /// A newer client must still read a host that predates `page_url` and `chapter`.
    #[test]
    fn exercise_slide_without_page_url_or_chapter_still_parses() {
        let slide: ExerciseSlide = serde_json::from_value(json!({
            "slide_id": Uuid::nil(),
            "exercise_id": Uuid::nil(),
            "course_id": Uuid::nil(),
            "exercise_name": "name",
            "exercise_order_number": 0,
            "deadline": null,
            "tasks": [],
        }))
        .unwrap();
        assert_eq!(slide.page_url, None);
        assert!(slide.chapter.is_none());
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

    /// A file answer names ids only. No archive may appear in the body: the named files are the
    /// answer, and the host has no archive concept left.
    #[test]
    fn exercise_slide_submission_names_files() {
        let file_id = Uuid::max();
        let value = serde_json::to_value(ExerciseSlideSubmission {
            exercise_slide_id: Uuid::nil(),
            exercise_task_id: Uuid::nil(),
            answer_kind: Some(AnswerKind::File),
            data_json: None,
            data_files: Some(vec![file_id]),
        })
        .unwrap();
        let obj = value.as_object().unwrap();
        assert!(obj.contains_key("exercise_slide_id"));
        assert!(obj.contains_key("exercise_task_id"));
        assert_eq!(obj["answer_kind"], json!("file"));
        assert_eq!(obj["data_files"], json!([file_id]));
        assert!(!obj.contains_key("data_json"));
        assert_eq!(obj.len(), 4);
    }

    /// A client that only ever answers with JSON sends neither `answer_kind` nor `data_files`.
    #[test]
    fn exercise_slide_submission_answer_kind_is_optional() {
        let submission: ExerciseSlideSubmission = serde_json::from_value(json!({
            "exercise_slide_id": Uuid::nil(),
            "exercise_task_id": Uuid::nil(),
            "data_json": { "opaque": "service owned" },
        }))
        .unwrap();
        assert_eq!(submission.answer_kind, None);
        assert_eq!(submission.data_files, None);
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
        let file = || AnswerFile {
            id,
            name: "src/main.rs".to_string(),
            mime: "application/octet-stream".to_string(),
            size_bytes: Some(11),
            order_number: Some(0),
            url: "http://project-331.local/api/v0/files/tmc/abc".to_string(),
        };
        let expected = json!({
            "data_files": [{
                "id": id,
                "name": "src/main.rs",
                "mime": "application/octet-stream",
                "size_bytes": 11,
                "order_number": 0,
                "url": "http://project-331.local/api/v0/files/tmc/abc",
            }]
        });
        assert_eq!(
            serde_json::to_value(UploadedFiles {
                data_files: vec![file()]
            })
            .unwrap(),
            expected
        );
        assert_eq!(
            serde_json::to_value(SubmissionFiles {
                data_files: vec![file()]
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
            serde_json::to_value(SubmissionFiles {
                data_files: Vec::new()
            })
            .unwrap(),
            json!({ "data_files": [] })
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
                standing: Some(ExerciseStanding::OutOfTries),
                max_tries: Some(3),
                tries_left: Some(0),
                pending_teacher_review: None,
                exercise_locked: false,
                reviewing_stage: None,
                teacher_review: None,
            }],
            closed_chapters: Vec::new(),
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
        assert_eq!(ex["standing"], json!("OutOfTries"));
        assert_eq!(ex["max_tries"], json!(3));
        assert_eq!(ex["tries_left"], json!(0));
        assert_eq!(obj["closed_chapters"], json!([]));
    }

    /// A newer client must still read a host that predates the try counts and closed chapters,
    /// and reads their absence as unlimited tries and no closed chapters.
    #[test]
    fn progress_without_tries_or_closed_chapters_still_parses() {
        let progress: CourseProgress = serde_json::from_value(json!({
            "course_id": Uuid::nil(),
            "exercises": [{
                "exercise_id": Uuid::nil(),
                "score_given": 0.0,
                "score_maximum": 1,
                "completed": false,
                "attempted": false,
                "standing": "NotAttempted",
            }],
        }))
        .unwrap();
        assert_eq!(progress.exercises[0].max_tries, None);
        assert_eq!(progress.exercises[0].tries_left, None);
        assert!(progress.closed_chapters.is_empty());
    }

    #[test]
    fn chapter_locking_status_wire_values() {
        let chapter: ExerciseChapter = serde_json::from_value(json!({
            "id": Uuid::nil(),
            "name": "name",
            "chapter_number": 1,
            "locking_status": "not_unlocked_yet",
        }))
        .unwrap();
        assert_eq!(
            chapter.locking_status,
            Some(ChapterLockingStatus::NotUnlockedYet)
        );
        assert_eq!(
            serde_json::to_value(ChapterLockingStatus::CompletedAndLocked).unwrap(),
            json!("completed_and_locked")
        );
        assert_eq!(
            serde_json::from_value::<ChapterLockingStatus>(json!("some_future_status")).unwrap(),
            ChapterLockingStatus::Unrecognized
        );
    }

    #[test]
    fn a_pending_teacher_review_and_a_locked_exercise_are_on_the_wire() {
        let value = serde_json::to_value(ExerciseProgress {
            exercise_id: Uuid::nil(),
            score_given: 0.0,
            score_maximum: 1,
            completed: true,
            attempted: true,
            standing: Some(ExerciseStanding::Attempted),
            max_tries: None,
            tries_left: None,
            pending_teacher_review: Some(PendingTeacherReview::AwaitsTeacher),
            exercise_locked: true,
            reviewing_stage: Some(ReviewingStage::WaitingForTeacher),
            teacher_review: None,
        })
        .unwrap();
        assert_eq!(value["pending_teacher_review"], json!("awaits_teacher"));
        assert_eq!(value["exercise_locked"], json!(true));
        assert_eq!(
            serde_json::to_value(PendingTeacherReview::AwaitsChapterLock).unwrap(),
            json!("awaits_chapter_lock")
        );
        assert_eq!(
            serde_json::from_value::<PendingTeacherReview>(json!("some_future_review")).unwrap(),
            PendingTeacherReview::Unrecognized
        );
    }

    /// A newer client reads a missing field as no review pending and an open exercise.
    #[test]
    fn progress_from_an_older_host_still_parses() {
        let progress: ExerciseProgress = serde_json::from_value(json!({
            "exercise_id": Uuid::nil(),
            "score_given": 0.0,
            "score_maximum": 1,
            "completed": false,
            "attempted": false,
        }))
        .unwrap();
        assert_eq!(progress.standing, None);
        assert_eq!(progress.pending_teacher_review, None);
        assert!(!progress.exercise_locked);
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
        assert!(!item.is_shared);
        assert_eq!(item.kind, SubmissionKind::Submission);
    }

    #[test]
    fn submission_list_item_reads_is_shared() {
        let value = json!({
            "id": Uuid::nil(),
            "exercise_id": Uuid::nil(),
            "created_at": "2026-07-21T00:00:00Z",
            "score_given": null,
            "grading_progress": null,
            "is_shared": true
        });
        let item: ExerciseSlideSubmissionListItem = serde_json::from_value(value).unwrap();
        assert!(item.is_shared);
    }

    #[test]
    fn snapshot_kinds_and_purposes_are_snake_case_on_the_wire() {
        let value = json!({
            "id": Uuid::nil(),
            "exercise_id": Uuid::nil(),
            "created_at": "2026-07-21T00:00:00Z",
            "score_given": null,
            "grading_progress": null,
            "kind": "backup"
        });
        let item: ExerciseSlideSubmissionListItem = serde_json::from_value(value).unwrap();
        assert_eq!(item.kind, SubmissionKind::Backup);
        assert_eq!(
            serde_json::to_value(SnapshotPurpose::Paste).unwrap(),
            json!("paste")
        );
    }

    /// One value newer than the client must not fail the whole response it is in.
    #[test]
    fn unknown_enum_values_read_as_unrecognized() {
        assert!(matches!(
            serde_json::from_value::<GradingProgress>(json!("SomeFutureProgress")).unwrap(),
            GradingProgress::Unrecognized
        ));
        assert_eq!(
            serde_json::from_value::<SubmissionKind>(json!("some_future_kind")).unwrap(),
            SubmissionKind::Unrecognized
        );
        assert_eq!(
            serde_json::from_value::<ExerciseStanding>(json!("SomeFutureStanding")).unwrap(),
            ExerciseStanding::Unrecognized
        );
        assert_eq!(
            serde_json::from_value::<ReviewingStage>(json!("some_future_stage")).unwrap(),
            ReviewingStage::Unrecognized
        );
        assert!(matches!(
            serde_json::from_value::<ExerciseTaskSubmissionStatus>(json!("SomeFutureStatus"))
                .unwrap(),
            ExerciseTaskSubmissionStatus::Unrecognized
        ));
        assert!(matches!(
            serde_json::from_value::<ExerciseTaskSubmissionStatus>(
                json!({ "SomeFutureStatus": { "detail": 1 } })
            )
            .unwrap(),
            ExerciseTaskSubmissionStatus::Unrecognized
        ));
        assert!(serde_json::to_value(GradingProgress::Unrecognized).is_err());
        assert!(serde_json::to_value(ExerciseTaskSubmissionStatus::Unrecognized).is_err());
    }

    /// A known status must still fail loudly when its own fields are malformed.
    #[test]
    fn malformed_grading_status_is_an_error() {
        assert!(
            serde_json::from_value::<ExerciseTaskSubmissionStatus>(json!({
                "Grading": { "grading_progress": 3 }
            }))
            .is_err()
        );
        assert!(matches!(
            serde_json::from_value::<ExerciseTaskSubmissionStatus>(json!("NoGradingYet")).unwrap(),
            ExerciseTaskSubmissionStatus::NoGradingYet
        ));
    }

    /// A newer client must still read a host that predates the course fields added after
    /// `ai_policy`.
    #[test]
    fn course_from_an_older_host_has_no_url_language_or_flags() {
        let course: Course = serde_json::from_value(json!({
            "id": Uuid::nil(),
            "slug": "slug",
            "name": "name",
            "description": null,
            "organization_name": "org",
            "ai_policy": "no_ai",
        }))
        .unwrap();
        assert_eq!(course.url, None);
        assert_eq!(course.language_code, None);
        assert_eq!(course.is_enrolled, None);
        assert!(!course.is_staff);
    }

    #[test]
    fn current_user_from_an_older_host_has_no_name() {
        let user: CurrentUser = serde_json::from_value(json!({ "id": Uuid::nil() })).unwrap();
        assert_eq!(user.name, None);
        assert_eq!(user.email, None);
    }
}
