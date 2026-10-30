//! `patch_exercise`: edits of an exercise's name, own deadline, instructions and review config.

use std::collections::BTreeMap;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use headless_lms_models::{
    error::TryToOptional,
    exercise_slide_submissions,
    library::agent_changesets::course_state::{CourseState, CourseView},
    peer_or_self_review_configs, peer_or_self_review_submissions,
};
use serde::Serialize;
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

use super::paths::{ExercisePart, call_index, group_ops, in_call, part_list};
use super::review_config::{DroppedReviewSettings, check_review_config, dropped_settings};
use super::{ExerciseDeadline, missing_exercise, open_course_with_exercise};
use crate::access::connection;
use crate::engine::{
    CreatedIds, EditError, EditErrorCode, PatchTarget, Warning, WarningCode, page_content,
};
use crate::hints;
use crate::ids::{IdGenerator, RandomIds};
use crate::instruction_lists;
use crate::staging::{self, WriteMode, WriteRequest};
use crate::state::McpState;
use crate::tools::args::{PatchExerciseArgs, ReviewConfigChoice};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome};

/// Handler of the `patch_exercise` tool.
pub struct PatchExercise;

/// The `deadline` argument as a time, `None` to clear it. Naive times are refused: the server
/// can't know which time zone they mean.
fn parse_deadline(raw: Option<&str>) -> Result<Option<DateTime<Utc>>, EditError> {
    raw.map(|raw| {
        DateTime::parse_from_rfc3339(raw)
            .map(|deadline| deadline.with_timezone(&Utc))
            .map_err(|_| {
                EditError::new(
                    EditErrorCode::InvalidValue,
                    "deadline is an RFC 3339 time with an offset, like \"2027-02-01T21:59:00Z\", or null to clear it",
                )
            })
    })
    .transpose()
}

/// What the agent should know about giving the exercise the own deadline `deadline` in `state`.
fn deadline_warnings(
    state: &CourseState,
    exercise_id: Uuid,
    deadline: DateTime<Utc>,
) -> Vec<Warning> {
    let mut warnings = vec![Warning::new(
        WarningCode::OwnExerciseDeadline,
        "an exercise's own deadline overrides its chapter's and is easy to miss when dates change; prefer the chapter deadline (patch_course_structure) and add own deadlines only when the teacher asks",
    )];
    let chapter = state
        .exercise_page_id(exercise_id)
        .and_then(|page| state.page(page)?.chapter_id)
        .and_then(|chapter| state.chapters.iter().find(|c| c.id == chapter));
    if let Some(chapter) = chapter {
        let outside = match (chapter.opens_at, chapter.deadline) {
            (Some(opens_at), _) if deadline < opens_at => Some(format!("opens at {opens_at}")),
            (_, Some(end)) if deadline > end => Some(format!("has the deadline {end}")),
            _ => None,
        };
        if let Some(outside) = outside {
            warnings.push(Warning::new(
                WarningCode::DeadlineOutsideChapterWindow,
                format!(
                    "the deadline is outside the time the chapter is open: chapter \"{}\" {outside}",
                    chapter.name
                ),
            ));
        }
    }
    warnings
}

/// How many reviews students have given on the exercise.
async fn review_count(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> Result<Option<i64>, ToolError> {
    Ok(
        peer_or_self_review_submissions::count_by_exercise_ids(conn, &[exercise_id])
            .await?
            .get(&exercise_id)
            .copied(),
    )
}

/// The exercise's own review settings that switching it to the course default would drop.
async fn settings_dropped_for_course_default(
    conn: &mut PgConnection,
    view: &CourseView,
    exercise_id: Uuid,
) -> Result<Option<DroppedReviewSettings>, ToolError> {
    let page_id = view
        .exercise_page_id(exercise_id)
        .ok_or_else(|| missing_exercise(view, exercise_id))?;
    let page = view
        .current_page_snapshots(conn, &[page_id])
        .await?
        .remove(&page_id);
    let course_default =
        peer_or_self_review_configs::get_course_default_cms_peer_review(conn, view.course.id)
            .await
            .optional()?;
    Ok(page
        .as_ref()
        .and_then(|page| page.exercises.iter().find(|e| e.id == exercise_id))
        .map(|own| dropped_settings(own, course_default.as_ref())))
}

#[derive(Serialize)]
struct ExerciseSummary<'a> {
    exercise: Uuid,
    created: Vec<CreatedIds>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    labels: BTreeMap<String, Uuid>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    warnings: Vec<Warning>,
    /// After the call, when it sets the deadline.
    #[serde(skip_serializing_if = "Option::is_none")]
    deadline: Option<ExerciseDeadline>,
    #[serde(skip_serializing_if = "Option::is_none")]
    review_config: Option<ReviewConfigChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    dropped_review_settings: Option<DroppedReviewSettings>,
    /// Reviews students have given on the exercise, when the call switches its review settings.
    #[serde(skip_serializing_if = "Option::is_none")]
    existing_review_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    course_default_review_config: Option<&'a str>,
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for PatchExercise {
    type Args = PatchExerciseArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: PatchExerciseArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let raw_ops = args.ops.clone().unwrap_or_default();
        if args.name.is_none()
            && args.deadline.is_none()
            && raw_ops.is_empty()
            && args.review_config.is_none()
        {
            return Err(ToolError::Edit(EditError::new(
                EditErrorCode::MissingField,
                "the call changes nothing; give name, deadline, ops or review_config",
            )));
        }
        let name = args
            .name
            .as_deref()
            .map(instruction_lists::checked_name)
            .transpose()?;
        let deadline = args
            .deadline
            .as_ref()
            .map(|raw| parse_deadline(raw.as_deref()))
            .transpose()?;
        let groups = group_ops(&raw_ops)?;
        let parsed = groups
            .iter()
            .map(|group| {
                crate::engine::parse_ops(&group.raw, PatchTarget::PageContent)
                    .map_err(|e| in_call(e, &group.indexes))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let exercise_id = args.exercise.id();
        let view = open_course_with_exercise(state, ctx, args.course.id(), exercise_id).await?;
        let has_review_ops = groups
            .iter()
            .any(|group| group.part == ExercisePart::ReviewInstructions);
        check_review_config(&view, exercise_id, args.review_config, has_review_ops)?;

        let ids = RandomIds;
        let mut after = view.staged.clone();
        if let Some(name) = name
            && let Some(record) = after.exercise_mut(exercise_id)
        {
            record.name = name;
        }
        let mut warnings = Vec::new();
        if let Some(deadline) = deadline {
            after.set_exercise_deadline(exercise_id, deadline);
            if let Some(deadline) = deadline {
                warnings.extend(deadline_warnings(&after, exercise_id, deadline));
            }
        }
        match args.review_config {
            Some(ReviewConfigChoice::Fork) => after.fork_review_config(exercise_id, ids.new_id()),
            Some(ReviewConfigChoice::UseCourseDefault) => {
                after.use_course_default_review_config(exercise_id)
            }
            Some(ReviewConfigChoice::EditCourseDefault) | None => {}
        }

        let mut created = Vec::new();
        let mut labels = BTreeMap::new();
        for (group, ops) in groups.iter().zip(&parsed) {
            let list = part_list(&after, exercise_id, group.part)?;
            let document = list
                .document(&after)
                .ok_or_else(|| missing_exercise(&view, exercise_id))??;
            let result = page_content::apply(document, &|_| None, ops, &ids)
                .map_err(|e| in_call(e, &group.indexes))?;
            list.set_blocks(&mut after, &result.page.blocks);
            for mut created_ids in result.created {
                created_ids.op = call_index(&group.indexes, created_ids.op)?;
                created.push(created_ids);
            }
            labels.extend(result.labels);
            for mut warning in result.warnings {
                warning.op = warning
                    .op
                    .map(|op| call_index(&group.indexes, op))
                    .transpose()?;
                warnings.push(warning);
            }
        }
        created.sort_by_key(|ids| ids.op);

        let (existing_review_count, dropped_review_settings) = match args.review_config {
            Some(ReviewConfigChoice::Fork) => {
                let mut conn = connection(state).await?;
                (review_count(&mut conn, exercise_id).await?, None)
            }
            Some(ReviewConfigChoice::UseCourseDefault) => {
                let mut conn = connection(state).await?;
                (
                    review_count(&mut conn, exercise_id).await?,
                    settings_dropped_for_course_default(&mut conn, &view, exercise_id).await?,
                )
            }
            Some(ReviewConfigChoice::EditCourseDefault) | None => (None, None),
        };
        let has_task_ops = groups
            .iter()
            .any(|group| matches!(group.part, ExercisePart::Task(_)));
        let is_answered = has_task_ops
            && !exercise_slide_submissions::get_exercise_ids_with_submissions_by_course_id(
                &mut *connection(state).await?,
                view.course.id,
                &[exercise_id],
            )
            .await?
            .is_empty();
        let edits_course_default =
            after.course_default_review_config != view.staged.course_default_review_config;
        let deadline_after = deadline.map(|_| ExerciseDeadline::of(&after, exercise_id));

        let report = staging::commit(
            state,
            ctx,
            &view,
            after,
            WriteRequest::new(
                json!(&args),
                format!("edit of exercise {exercise_id}"),
                WriteMode::from_dry_run(args.dry_run),
            ),
        )
        .await?;
        let summary = ExerciseSummary {
            exercise: exercise_id,
            created,
            labels,
            warnings,
            deadline: deadline_after,
            review_config: args.review_config,
            dropped_review_settings,
            existing_review_count,
            course_default_review_config: edits_course_default.then_some(
                "edited: the change shows in every exercise that uses the course default review config",
            ),
        };
        let mut result = report.into_result(&summary);
        if let Some(count) = existing_review_count.filter(|count| *count > 0) {
            result = result.with_hint(hints::review_config_switched_with_reviews(count));
        }
        if is_answered {
            result = result.with_hint(hints::answered_task_instructions_edited());
        }
        Ok(result.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_one_line_of_plain_text() {
        assert_eq!(
            instruction_lists::checked_name("  Loops  ").unwrap(),
            "Loops"
        );
        for invalid in ["", "  ", "a\nb", "<b>Loops</b>"] {
            assert!(
                instruction_lists::checked_name(invalid).is_err(),
                "{invalid:?}"
            );
        }
        assert_eq!(instruction_lists::checked_name("x < y").unwrap(), "x < y");
    }
}
