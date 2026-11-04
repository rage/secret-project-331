//! `get_exercise`: an exercise's facts and reads of its instructions and task specs.

use std::collections::{HashMap, hash_map::Entry};

use async_trait::async_trait;
use headless_lms_models::{
    exercise_slide_submissions,
    library::{
        agent_changesets::course_state::{CourseView, ExerciseReviewConfig},
        entity_snapshots,
    },
    pages::CmsPageExercise,
    peer_or_self_review_configs::CmsPeerOrSelfReviewConfig,
};
use serde_json::{Value, json};
use uuid::Uuid;

use super::paths::{part_list, part_prefix, prefix_paths, split_exercise_path};
use super::specs::{TaskSpecs, load_task_specs, parse_spec_path, read_specs};
use super::{ExerciseDeadline, REVIEW_INSTRUCTIONS, missing_exercise, open_course_with_exercise};
use crate::access::{connection, state_of};
use crate::engine::read::{ReadOptions, ReadResult, ReadState, Selector, read_page};
use crate::engine::{EditError, EditErrorCode};
use crate::instruction_lists;
use crate::state::McpState;
use crate::tools::args::GetExerciseArgs;
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

/// Handler of the `get_exercise` tool.
pub struct GetExercise;

fn read_part(
    view: &CourseView,
    exercise_id: Uuid,
    selector: &Selector,
    options: &ReadOptions,
) -> Result<Value, ToolError> {
    let state = state_of(view, selector.state.unwrap_or_default());
    let (part, path) = split_exercise_path(selector.path.as_deref().unwrap_or(""))?;
    let through = selector
        .through
        .as_deref()
        .map(|through| {
            let (through_part, through) = split_exercise_path(through)?;
            if through_part != part {
                return Err(EditError::new(
                    EditErrorCode::InvalidRange,
                    "path and through are in different instructions",
                ));
            }
            Ok(through)
        })
        .transpose()?;
    let list = part_list(state, exercise_id, part)?;
    let document = list
        .document(state)
        .ok_or_else(|| missing_exercise(view, exercise_id))??;
    let inner = Selector {
        path: Some(path),
        through,
        ..selector.clone()
    };
    let read: ReadResult = read_page(&document, &inner, options)?;
    let mut value = serde_json::to_value(read).unwrap_or_default();
    let prefix = part_prefix(part);
    prefix_paths(&mut value, &prefix);
    value["selector"] = json!(selector);
    Ok(value)
}

/// The exercise's settings agents can read but not change.
fn read_only_settings(
    exercise: &CmsPageExercise,
    own_config: Option<&CmsPeerOrSelfReviewConfig>,
    question_count: usize,
) -> Value {
    let mut settings = json!({
        "score_maximum": exercise.score_maximum,
        "max_tries_per_slide": exercise.max_tries_per_slide,
        "limit_number_of_tries": exercise.limit_number_of_tries,
        "teacher_reviews_answer_after_locking": exercise.teacher_reviews_answer_after_locking,
    });
    if let Some(config) = own_config {
        settings["review"] = json!({
            "peer_reviews_to_give": config.peer_reviews_to_give,
            "peer_reviews_to_receive": config.peer_reviews_to_receive,
            "accepting_threshold": config.accepting_threshold,
            "processing_strategy": config.processing_strategy,
            "points_are_all_or_nothing": config.points_are_all_or_nothing,
            "question_count": question_count,
        });
    }
    settings
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for GetExercise {
    type Args = GetExerciseArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: GetExerciseArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let exercise_id = args.exercise.id();
        let view = open_course_with_exercise(state, ctx, args.course.id(), exercise_id).await?;
        let exercise = view
            .staged
            .exercise(exercise_id)
            .or_else(|| view.live.exercise(exercise_id))
            .ok_or_else(|| missing_exercise(&view, exercise_id))?;
        let page_id = view
            .exercise_page_id(exercise_id)
            .ok_or_else(|| missing_exercise(&view, exercise_id))?;
        let page = view
            .current_page_snapshots(&mut *connection(state).await?, &[page_id])
            .await?
            .remove(&page_id);
        let full_exercise = page
            .as_ref()
            .and_then(|page| page.exercises.iter().find(|e| e.id == exercise_id));

        let selectors = match args.selectors {
            Some(selectors) if !selectors.is_empty() => selectors,
            _ => {
                let mut outline: Vec<Selector> = exercise
                    .tasks
                    .iter()
                    .map(|task| Selector {
                        path: Some(format!("/tasks/{}", task.id)),
                        ..Selector::default()
                    })
                    .collect();
                if instruction_lists::review_list(&view.staged, exercise).is_some() {
                    outline.push(Selector {
                        path: Some(format!("/{REVIEW_INSTRUCTIONS}")),
                        ..Selector::default()
                    });
                }
                outline
            }
        };
        let options = ReadOptions {
            budget_bytes: ctx.client.result_budget_bytes() / selectors.len().max(1),
            pending: None,
        };
        let mut specs_by_state: HashMap<ReadState, HashMap<Uuid, TaskSpecs>> = HashMap::new();
        let mut reads = Vec::with_capacity(selectors.len());
        for selector in &selectors {
            let spec_path = selector.path.as_deref().and_then(parse_spec_path);
            let Some(spec_path) = spec_path else {
                reads.push(read_part(&view, exercise_id, selector, &options)?);
                continue;
            };
            let spec_path = spec_path?;
            let read_state = selector.state.unwrap_or_default();
            if let Entry::Vacant(entry) = specs_by_state.entry(read_state) {
                let mut conn = connection(state).await?;
                let state_page = match read_state {
                    ReadState::Staged => page.clone(),
                    ReadState::Published => match view.live.exercise_page_id(exercise_id) {
                        Some(live_page) => {
                            entity_snapshots::load_page(&mut conn, live_page).await?
                        }
                        None => None,
                    },
                };
                entry.insert(
                    load_task_specs(&mut conn, exercise_id, state_page.as_ref(), read_state)
                        .await?,
                );
            }
            let mut read = read_specs(
                &spec_path,
                specs_by_state
                    .get(&read_state)
                    .and_then(|specs| specs.get(&spec_path.task_id)),
                options.budget_bytes,
            )?;
            read["selector"] = json!(selector);
            reads.push(read);
        }

        let own_config = full_exercise.and_then(|e| {
            (!e.use_course_default_peer_or_self_review_config)
                .then_some(e.peer_or_self_review_config.as_ref())
                .flatten()
        });
        let question_count = full_exercise
            .and_then(|e| e.peer_or_self_review_questions.as_ref())
            .map_or(0, Vec::len);
        let review_path = instruction_lists::review_list(&view.staged, exercise)
            .map(|_| format!("/{REVIEW_INSTRUCTIONS}"));
        let has_submissions =
            !exercise_slide_submissions::get_exercise_ids_with_submissions_by_course_id(
                &mut *connection(state).await?,
                view.course.id,
                &[exercise_id],
            )
            .await?
            .is_empty();
        let mut summary = json!({
            "id": exercise.id,
            "name": exercise.name,
            "page": page_id,
            "deadline": ExerciseDeadline::of(&view.staged, exercise_id),
            "tasks": exercise.tasks.iter().map(|task| json!({
                "id": task.id,
                "exercise_type": task.exercise_type,
                "path": format!("/tasks/{}", task.id),
                "specs_path": format!("/tasks/{}/specs", task.id),
            })).collect::<Vec<_>>(),
            "reviews": {
                "needs_peer_review": exercise.needs_peer_review,
                "needs_self_review": exercise.needs_self_review,
                "config": exercise.review_config.kind().map_or(json!("unset"), |kind| json!(kind)),
                "course_default_settings": (exercise.review_config == ExerciseReviewConfig::CourseDefault)
                    .then_some("get_course_settings shows them as default_peer_review"),
                "path": review_path,
            },
            "read_only": full_exercise.map(|e| read_only_settings(e, own_config, question_count)),
            "has_staged_changes": view.staged_row(headless_lms_models::library::entity_snapshots::EntityKey::new(headless_lms_models::library::entity_snapshots::ContentEntityType::Page, page_id)).is_some(),
        });
        if has_submissions {
            summary["has_submissions"] = json!(true);
        }
        Ok(ToolResult::success(json!({
            "exercise": summary,
            "reads": reads,
        }))
        .into())
    }
}
