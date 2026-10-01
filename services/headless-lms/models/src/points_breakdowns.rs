//! One user's points in a course module, exercise by exercise, grouped by chapter and page.

use headless_lms_utils::numbers::{
    f32_to_two_decimals, option_f32_to_f32_two_decimals_with_none_as_zero,
};
use utoipa::ToSchema;

use crate::{
    exercises::{ActivityProgress, GradingProgress},
    prelude::*,
    user_exercise_states::ReviewingStage,
};

/// Where a user's answer to an exercise stands, as far as the student may know.
///
/// Collapses the exercise state into what the exercise block itself tells the student, so the
/// underlying reviewing and grading stages never reach the client.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
pub enum ExercisePointsStatus {
    NotStarted,
    GradingInProgress,
    GradingFailed,
    PeerReviewToGive,
    SelfReviewToGive,
    WaitingForPeerReviews,
    WaitingForTeacherGrading,
    /// The exercise was locked before the user answered it.
    NotAnswered,
    /// Graded; the score may still be below the maximum.
    Done,
}

impl ExercisePointsStatus {
    fn from_exercise_state(
        activity_progress: Option<ActivityProgress>,
        grading_progress: Option<GradingProgress>,
        reviewing_stage: Option<ReviewingStage>,
    ) -> Self {
        let (Some(activity_progress), Some(grading_progress), Some(reviewing_stage)) =
            (activity_progress, grading_progress, reviewing_stage)
        else {
            return Self::NotStarted;
        };
        match reviewing_stage {
            ReviewingStage::PeerReview => Self::PeerReviewToGive,
            ReviewingStage::SelfReview => Self::SelfReviewToGive,
            ReviewingStage::WaitingForPeerReviews => Self::WaitingForPeerReviews,
            ReviewingStage::WaitingForManualGrading => Self::WaitingForTeacherGrading,
            ReviewingStage::ReviewedAndLocked | ReviewingStage::Locked => Self::Done,
            ReviewingStage::NotAnsweredAndLocked => Self::NotAnswered,
            ReviewingStage::NotStarted => match grading_progress {
                GradingProgress::Pending => Self::GradingInProgress,
                GradingProgress::PendingManual => Self::WaitingForTeacherGrading,
                GradingProgress::Failed => Self::GradingFailed,
                GradingProgress::FullyGraded => Self::Done,
                GradingProgress::NotReady => match activity_progress {
                    ActivityProgress::Submitted | ActivityProgress::Completed => {
                        Self::GradingInProgress
                    }
                    ActivityProgress::Initialized
                    | ActivityProgress::Started
                    | ActivityProgress::InProgress => Self::NotStarted,
                },
            },
        }
    }
}

/// One exercise's row in a points breakdown.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ExercisePointsBreakdown {
    pub exercise_id: Uuid,
    pub name: String,
    pub status: ExercisePointsStatus,
    /// Rounded to two decimals; 0 until the answer counts towards the module's points.
    pub score_given: f32,
    pub score_maximum: i32,
    /// Submissions to the slide the user was given, which is what the attempt limit counts.
    pub attempts: i64,
    /// `None` when the exercise allows unlimited attempts.
    pub attempts_limit: Option<i32>,
}

/// A page's exercises in a points breakdown, with their subtotal.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct PagePointsBreakdown {
    pub page_id: Uuid,
    pub title: String,
    /// Path within the course; the exercise's block is anchored on the page by its exercise id.
    pub url_path: String,
    pub score_given: f32,
    pub score_maximum: i32,
    pub exercises: Vec<ExercisePointsBreakdown>,
}

/// A chapter's pages in a points breakdown, with their subtotal.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ChapterPointsBreakdown {
    pub chapter_id: Uuid,
    pub chapter_number: i32,
    pub name: String,
    pub score_given: f32,
    pub score_maximum: i32,
    pub pages: Vec<PagePointsBreakdown>,
}

/// The user's points in one course module, in chapter, page and exercise order.
///
/// Counts exercises as `user_exercise_states::get_user_course_module_progress` does, except that
/// chapters that have not opened yet are left out entirely, so the sum can fall below the module's
/// total. Chapters and pages without exercises are left out too.
pub async fn get_user_course_module_points_breakdown(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<ChapterPointsBreakdown>> {
    let rows = sqlx::query!(
        r#"
SELECT chapters.id AS "chapter_id!",
  chapters.chapter_number AS "chapter_number!",
  chapters.name AS "chapter_name!",
  pages.id AS "page_id!",
  pages.title AS "page_title!",
  pages.url_path AS "page_url_path!",
  exercises.id AS "exercise_id!",
  exercises.name AS "exercise_name!",
  exercises.score_maximum AS "score_maximum!",
  exercises.limit_number_of_tries AS "limit_number_of_tries!",
  exercises.max_tries_per_slide AS "max_tries_per_slide?",
  CASE
    WHEN ues.activity_progress IN ('completed', 'submitted') THEN ues.score_given
  END AS "score_given?",
  ues.activity_progress AS "activity_progress?: ActivityProgress",
  ues.grading_progress AS "grading_progress?: GradingProgress",
  ues.reviewing_stage AS "reviewing_stage?: ReviewingStage",
  (
    SELECT COUNT(*)
    FROM exercise_slide_submissions AS ess
    WHERE ess.exercise_slide_id = ues.selected_exercise_slide_id
      AND ess.course_id = chapters.course_id
      AND ess.user_id = $2
      AND ess.deleted_at IS NULL
  ) AS "attempts!"
FROM exercises
  JOIN chapters ON (exercises.chapter_id = chapters.id)
  JOIN pages ON (exercises.page_id = pages.id)
  LEFT JOIN user_exercise_states AS ues ON (
    ues.exercise_id = exercises.id
    AND ues.course_id = chapters.course_id
    AND ues.user_id = $2
    AND ues.deleted_at IS NULL
  )
WHERE chapters.course_module_id = $1
  AND exercises.deleted_at IS NULL
  AND chapters.deleted_at IS NULL
  AND pages.deleted_at IS NULL
  AND (
    chapters.opens_at < now()
    OR chapters.opens_at IS NULL
  )
ORDER BY chapters.chapter_number,
  pages.order_number,
  pages.id,
  exercises.order_number,
  exercises.id
        "#,
        course_module_id,
        user_id,
    )
    .fetch_all(conn)
    .await?;

    let mut chapters: Vec<ChapterPointsBreakdown> = Vec::new();
    for row in rows {
        let exercise = ExercisePointsBreakdown {
            exercise_id: row.exercise_id,
            name: row.exercise_name,
            status: ExercisePointsStatus::from_exercise_state(
                row.activity_progress,
                row.grading_progress,
                row.reviewing_stage,
            ),
            score_given: option_f32_to_f32_two_decimals_with_none_as_zero(row.score_given),
            score_maximum: row.score_maximum,
            attempts: row.attempts,
            attempts_limit: row
                .max_tries_per_slide
                .filter(|_| row.limit_number_of_tries),
        };
        if chapters
            .last()
            .is_none_or(|c| c.chapter_id != row.chapter_id)
        {
            chapters.push(ChapterPointsBreakdown {
                chapter_id: row.chapter_id,
                chapter_number: row.chapter_number,
                name: row.chapter_name,
                score_given: 0.0,
                score_maximum: 0,
                pages: Vec::new(),
            });
        }
        let Some(chapter) = chapters.last_mut() else {
            continue;
        };
        if chapter
            .pages
            .last()
            .is_none_or(|p| p.page_id != row.page_id)
        {
            chapter.pages.push(PagePointsBreakdown {
                page_id: row.page_id,
                title: row.page_title,
                url_path: row.page_url_path,
                score_given: 0.0,
                score_maximum: 0,
                exercises: Vec::new(),
            });
        }
        let Some(page) = chapter.pages.last_mut() else {
            continue;
        };
        page.score_given = f32_to_two_decimals(page.score_given + exercise.score_given);
        page.score_maximum += exercise.score_maximum;
        chapter.score_given = f32_to_two_decimals(chapter.score_given + exercise.score_given);
        chapter.score_maximum += exercise.score_maximum;
        page.exercises.push(exercise);
    }
    Ok(chapters)
}
