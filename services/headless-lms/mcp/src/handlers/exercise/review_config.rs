//! Checking a `patch_exercise` call's review config choice, and what switching drops.

use headless_lms_models::{
    library::agent_changesets::course_state::{CourseView, ExerciseReviewConfig},
    pages::CmsPageExercise,
    peer_or_self_review_configs::CmsPeerOrSelfReviewConfig,
};
use serde::Serialize;
use uuid::Uuid;

use super::missing_exercise;
use crate::engine::{EditError, EditErrorCode};
use crate::tools::ToolError;
use crate::tools::args::ReviewConfigChoice;

pub(super) fn refused(message: impl Into<String>, fix: impl Into<String>) -> ToolError {
    ToolError::Edit(EditError::new(EditErrorCode::FieldNotAllowed, message).with_fix(fix))
}

/// Refuses a `review_config` that doesn't fit the exercise or the review ops.
pub(super) fn check_review_config(
    view: &CourseView,
    exercise_id: Uuid,
    choice: Option<ReviewConfigChoice>,
    has_review_ops: bool,
) -> Result<(), ToolError> {
    let exercise = view
        .staged
        .exercise(exercise_id)
        .ok_or_else(|| missing_exercise(view, exercise_id))?;
    let config = &exercise.review_config;
    if has_review_ops && !exercise.has_reviews() {
        return Err(refused(
            "the exercise has neither peer nor self reviews, so its review instructions aren't shown",
            "the teacher turns reviews on in the exercise's settings in the editor",
        ));
    }
    let require_course_default = |message: &str| match view.staged.course_default_review_config {
        Some(_) => Ok(()),
        None => Err(refused(
            message,
            "the teacher sets one up on the course's default peer review page",
        )),
    };
    match (choice, config) {
        (Some(ReviewConfigChoice::Fork), _) if !has_review_ops => Err(refused(
            "fork needs review ops: give the exercise its own review instructions only when they differ from the course default",
            "add ops on /review_instructions, or leave review_config out",
        )),
        (Some(ReviewConfigChoice::Fork), ExerciseReviewConfig::Own { .. }) => Err(refused(
            "the exercise already has its own review settings",
            "leave review_config out to edit its own review instructions",
        )),
        (Some(ReviewConfigChoice::Fork), ExerciseReviewConfig::Unset) => Err(refused(
            "the exercise has no review settings to copy the course default over",
            "the teacher sets up reviews for it in the editor",
        )),
        (Some(ReviewConfigChoice::Fork), ExerciseReviewConfig::CourseDefault) => {
            require_course_default("the course has no default review config to copy")
        }
        (Some(ReviewConfigChoice::UseCourseDefault), _) if has_review_ops => Err(refused(
            "use_course_default drops the exercise's own review instructions, so review ops have nothing to edit",
            "send the switch alone; edit the course default in another call with review_config edit_course_default",
        )),
        (Some(ReviewConfigChoice::UseCourseDefault), ExerciseReviewConfig::Own { .. }) => Ok(()),
        (Some(ReviewConfigChoice::UseCourseDefault), _) => Err(refused(
            "the exercise has no review settings of its own to drop",
            "leave review_config out",
        )),
        (Some(ReviewConfigChoice::EditCourseDefault), ExerciseReviewConfig::Own { .. }) => {
            Err(refused(
                "the exercise has its own review settings, so editing the course default doesn't change what it shows",
                "leave review_config out to edit its own review instructions",
            ))
        }
        (Some(ReviewConfigChoice::EditCourseDefault), _) if !has_review_ops => Err(refused(
            "edit_course_default needs review ops",
            "add ops on /review_instructions",
        )),
        (Some(ReviewConfigChoice::EditCourseDefault), ExerciseReviewConfig::CourseDefault) => {
            require_course_default("the course has no default review config")
        }
        (Some(ReviewConfigChoice::EditCourseDefault), ExerciseReviewConfig::Unset) => Err(refused(
            "the exercise doesn't use the course default review config",
            "leave review_config out",
        )),
        (None, ExerciseReviewConfig::CourseDefault) if has_review_ops => Err(refused(
            "the exercise uses the course default review config, which other exercises share",
            "set review_config: edit_course_default to edit it for every exercise using it (preferred), or fork to give only this exercise its own copy",
        )),
        (None, ExerciseReviewConfig::Unset) if has_review_ops => Err(refused(
            "the exercise has no review settings to hold review instructions",
            "the teacher sets up reviews for it in the editor",
        )),
        (None, _) => Ok(()),
    }
}

/// What switching to the course default drops of the exercise's own review settings.
#[derive(Serialize)]
pub(super) struct DroppedReviewSettings {
    pub(super) question_count: usize,
    /// Settings whose own value differs from the course default's.
    pub(super) differs_from_course_default: Vec<&'static str>,
    pub(super) has_review_instructions: bool,
}

pub(super) fn dropped_settings(
    exercise: &CmsPageExercise,
    course_default: Option<&CmsPeerOrSelfReviewConfig>,
) -> DroppedReviewSettings {
    let own = exercise.peer_or_self_review_config.as_ref();
    let differs = match (own, course_default) {
        (Some(own), Some(default)) => own.settings_differing_from(default),
        _ => Vec::new(),
    };
    DroppedReviewSettings {
        question_count: exercise
            .peer_or_self_review_questions
            .as_ref()
            .map_or(0, Vec::len),
        differs_from_course_default: differs,
        has_review_instructions: own.is_some_and(|own| own.review_instructions.is_some()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_fixtures::id;

    fn view() -> CourseView {
        let state = crate::test_fixtures::course_with_exercises();
        CourseView {
            course: crate::test_fixtures::course_row(),
            live: state.clone(),
            staged: state,
            changeset: None,
            staged_entities: Default::default(),
        }
    }

    #[test]
    fn review_config_choices_must_fit_the_exercise_and_the_ops() {
        let view = view();
        let (default_user, own) = (id("ex"), id("own"));
        let refusals = [
            (default_user, None, true),
            (default_user, Some(ReviewConfigChoice::Fork), false),
            (
                default_user,
                Some(ReviewConfigChoice::UseCourseDefault),
                false,
            ),
            (
                default_user,
                Some(ReviewConfigChoice::EditCourseDefault),
                false,
            ),
            (own, Some(ReviewConfigChoice::EditCourseDefault), true),
            (own, Some(ReviewConfigChoice::Fork), true),
            (own, Some(ReviewConfigChoice::UseCourseDefault), true),
        ];
        for (exercise, choice, has_review_ops) in refusals {
            assert!(
                check_review_config(&view, exercise, choice, has_review_ops).is_err(),
                "{exercise} {choice:?} {has_review_ops}"
            );
        }
        let allowed = [
            (
                default_user,
                Some(ReviewConfigChoice::EditCourseDefault),
                true,
            ),
            (default_user, Some(ReviewConfigChoice::Fork), true),
            (default_user, None, false),
            (own, None, true),
            (own, Some(ReviewConfigChoice::UseCourseDefault), false),
        ];
        for (exercise, choice, has_review_ops) in allowed {
            assert!(
                check_review_config(&view, exercise, choice, has_review_ops).is_ok(),
                "{exercise} {choice:?} {has_review_ops}"
            );
        }

        let mut without_reviews = view;
        without_reviews
            .staged
            .exercise_mut(own)
            .unwrap()
            .needs_peer_review = false;
        assert!(check_review_config(&without_reviews, own, None, true).is_err());
    }
}
