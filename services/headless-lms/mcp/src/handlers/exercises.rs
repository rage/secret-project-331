//! `get_exercise` and `patch_exercise`: an exercise's name, own deadline, task instructions and
//! review instructions. Everything else of an exercise is read-only for agents.

use std::collections::{BTreeMap, HashMap, hash_map::Entry};
use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use headless_lms_models::{
    error::TryToOptional,
    library::{
        agent_changesets::course_state::{CourseState, CourseView, ExerciseReviewConfig},
        entity_snapshots,
    },
    pages::CmsPageExercise,
    peer_or_self_review_configs::{self, CmsPeerOrSelfReviewConfig},
    peer_or_self_review_submissions,
};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::access::{connection, open_course};
use crate::engine::read::{ReadOptions, ReadResult, ReadState, Selector, read_page};
use crate::engine::{
    CreatedIds, EditError, EditErrorCode, PatchTarget, Warning, WarningCode, page_content,
};
use crate::exercises::{self, InstructionsList};
use crate::handlers::exercise_specs::{TaskSpecs, load_task_specs, parse_spec_path, read_specs};
use crate::hints;
use crate::ids::{IdGenerator, RandomIds};
use crate::staging::{self, WriteRequest};
use crate::state::McpState;
use crate::tools::args::{GetExerciseArgs, PatchExerciseArgs, ReviewConfigChoice};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

pub struct GetExercise;
pub struct PatchExercise;

const REVIEW_INSTRUCTIONS: &str = "review_instructions";

/// The course with the records of the exercises on the pages holding `exercise_id` loaded.
async fn open_course_with_exercise(
    state: &McpState,
    ctx: &RequestContext,
    course_id: Uuid,
    exercise_id: Uuid,
) -> Result<CourseView, ToolError> {
    let mut view = open_course(state, ctx, course_id).await?;
    let page_ids: Vec<Uuid> = [
        view.staged.exercise_page_id(exercise_id),
        view.live.exercise_page_id(exercise_id),
    ]
    .into_iter()
    .flatten()
    .collect();
    view.load_exercises_on_pages(&mut *connection(state).await?, &page_ids)
        .await?;
    Ok(view)
}

fn missing_exercise(view: &CourseView, exercise_id: Uuid) -> ToolError {
    ToolError::NotFound {
        message: format!(
            "course {} has no exercise {exercise_id} on its pages; exercise blocks in get_page_content show exercise ids, and exam exercises can't be edited here",
            view.course.id
        ),
    }
}

/// Which part of an exercise a path starts at.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ExercisePart {
    Task(Uuid),
    ReviewInstructions,
}

/// Splits `/tasks/<task id>/rest` or `/review_instructions/rest` into the part and the page-content
/// path of the rest, `""` for the part's top level.
fn split_exercise_path(path: &str) -> Result<(ExercisePart, String), EditError> {
    let invalid = || {
        EditError::new(
            EditErrorCode::InvalidPath,
            format!("{path:?} isn't in the exercise's instructions"),
        )
        .with_fix("paths start at /tasks/<task id> or /review_instructions, e.g. /tasks/<task id>/<block id>/attributes/content")
    };
    let rest = path.strip_prefix('/').ok_or_else(invalid)?;
    let (head, rest) = rest.split_once('/').unwrap_or((rest, ""));
    let (part, rest) = match head {
        "tasks" => {
            let (task, rest) = rest.split_once('/').unwrap_or((rest, ""));
            let task_id = Uuid::parse_str(task).map_err(|_| invalid())?;
            (ExercisePart::Task(task_id), rest)
        }
        REVIEW_INSTRUCTIONS => (ExercisePart::ReviewInstructions, rest),
        _ => return Err(invalid()),
    };
    let rest = if rest.is_empty() {
        String::new()
    } else {
        format!("/{rest}")
    };
    Ok((part, rest))
}

/// The prefix to put back on the paths a read of `part` returns.
fn part_prefix(part: ExercisePart) -> String {
    match part {
        ExercisePart::Task(task_id) => format!("/tasks/{task_id}"),
        ExercisePart::ReviewInstructions => format!("/{REVIEW_INSTRUCTIONS}"),
    }
}

/// The instruction list `part` of the exercise is in `state`, or why it has none.
fn part_list(
    state: &CourseState,
    exercise_id: Uuid,
    part: ExercisePart,
) -> Result<InstructionsList, EditError> {
    let exercise = state.exercise(exercise_id).ok_or_else(|| {
        EditError::new(
            EditErrorCode::NotFound,
            format!("exercise {exercise_id} doesn't exist in this state"),
        )
    })?;
    match part {
        ExercisePart::Task(task_id) => {
            if exercise.tasks.iter().any(|task| task.id == task_id) {
                Ok(InstructionsList::Task {
                    exercise_id,
                    task_id,
                })
            } else {
                Err(EditError::new(
                    EditErrorCode::NotFound,
                    format!("exercise {exercise_id} has no task {task_id}"),
                )
                .with_details(json!({"tasks": exercise.tasks.iter().map(|t| t.id).collect::<Vec<_>>()})))
            }
        }
        ExercisePart::ReviewInstructions => exercises::review_list(state, exercise).ok_or_else(|| {
            EditError::new(
                EditErrorCode::NotFound,
                format!("exercise {exercise_id} has no peer or self reviews, so it shows no review instructions"),
            )
        }),
    }
}

/// Prefixes every block path in a read result with `prefix`.
fn prefix_paths(value: &mut Value, prefix: &str) {
    match value {
        Value::Object(map) => {
            for (key, child) in map.iter_mut() {
                match child {
                    Value::String(path) if key == "path" || key == "through" || key == "parent" => {
                        *path = format!("{prefix}{path}");
                    }
                    _ => prefix_paths(child, prefix),
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(|item| prefix_paths(item, prefix)),
        _ => {}
    }
}

fn read_part(
    view: &CourseView,
    exercise_id: Uuid,
    selector: &Selector,
    options: &ReadOptions,
) -> Result<Value, ToolError> {
    let state = match selector.state.unwrap_or_default() {
        ReadState::Staged => &view.staged,
        ReadState::Published => &view.live,
    };
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
    let document =
        exercises::document(state, list).ok_or_else(|| missing_exercise(view, exercise_id))??;
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
            .staged
            .exercise_page_id(exercise_id)
            .unwrap_or(exercise.page_id);
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
                if exercises::review_list(&view.staged, exercise).is_some() {
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
                specs_by_state[&read_state].get(&spec_path.task_id),
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
        let review_path = exercises::review_list(&view.staged, exercise)
            .map(|_| format!("/{REVIEW_INSTRUCTIONS}"));
        Ok(ToolResult::success(json!({
            "exercise": {
                "id": exercise.id,
                "name": exercise.name,
                "page": page_id,
                "deadline": ExerciseDeadline::of(&view.staged, exercise_id),
                "tasks": exercise.tasks.iter().map(|task| json!({
                    "id": task.id,
                    "exercise_type": task.exercise_type,
                    "path": format!("/tasks/{}", task.id),
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
                "has_staged_changes": view.staged_row((headless_lms_models::library::entity_snapshots::ContentEntityType::Page, page_id)).is_some(),
            },
            "reads": reads,
        }))
        .into())
    }
}

/// An exercise's own deadline and the one that applies to it, its chapter's without an own one.
#[derive(Serialize)]
struct ExerciseDeadline {
    own: Option<DateTime<Utc>>,
    effective: Option<DateTime<Utc>>,
}

impl ExerciseDeadline {
    fn of(state: &CourseState, exercise_id: Uuid) -> Self {
        Self {
            own: state.exercise(exercise_id).and_then(|e| e.deadline),
            effective: state.effective_exercise_deadline(exercise_id),
        }
    }
}

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

/// The ops of one instruction list, with their indexes in the call.
#[derive(Debug)]
struct PartOps {
    part: ExercisePart,
    indexes: Vec<usize>,
    raw: Vec<Value>,
}

/// Groups the ops by the instructions they edit and rewrites their paths to page-content paths.
fn group_ops(raw_ops: &[Value]) -> Result<Vec<PartOps>, EditError> {
    let mut groups: Vec<PartOps> = Vec::new();
    for (index, raw) in raw_ops.iter().enumerate() {
        let mut op = raw.clone();
        let Some(object) = op.as_object_mut() else {
            return Err(EditError::new(
                EditErrorCode::InvalidOp,
                "each op must be an object like {\"op\":\"remove\",\"path\":\"/tasks/<task id>/<block id>\"}",
            )
            .at_op(index));
        };
        if object.contains_key("to_page") {
            return Err(EditError::new(
                EditErrorCode::FieldNotAllowed,
                "to_page isn't available in exercise instructions",
            )
            .at_op(index));
        }
        let mut part = None;
        for key in ["path", "from", "through"] {
            let Some(Value::String(path)) = object.get(key) else {
                continue;
            };
            let (path_part, rest) = split_exercise_path(path).map_err(|e| e.at_op(index))?;
            if part.is_some_and(|part| part != path_part) {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "an op works within one task's or the review instructions; it can't move or copy between them",
                )
                .at_op(index));
            }
            part = Some(path_part);
            object.insert(key.to_string(), Value::String(rest));
        }
        let part = part.ok_or_else(|| {
            EditError::new(EditErrorCode::MissingField, "the op has no path").at_op(index)
        })?;
        match groups.iter_mut().find(|group| group.part == part) {
            Some(group) => {
                group.indexes.push(index);
                group.raw.push(op);
            }
            None => groups.push(PartOps {
                part,
                indexes: vec![index],
                raw: vec![op],
            }),
        }
    }
    Ok(groups)
}

fn refused(message: impl Into<String>, fix: impl Into<String>) -> ToolError {
    ToolError::Edit(EditError::new(EditErrorCode::FieldNotAllowed, message).with_fix(fix))
}

/// Refuses a `review_config` that doesn't fit the exercise or the review ops.
fn review_plan(
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
            if view.staged.course_default_review_config.is_none() {
                return Err(refused(
                    "the course has no default review config to copy",
                    "the teacher sets one up on the course's default peer review page",
                ));
            }
            Ok(())
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
            if view.staged.course_default_review_config.is_none() {
                return Err(refused(
                    "the course has no default review config",
                    "the teacher sets one up on the course's default peer review page",
                ));
            }
            Ok(())
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
struct DroppedReviewSettings {
    question_count: usize,
    /// Settings whose own value differs from the course default's.
    differs_from_course_default: Vec<&'static str>,
    has_review_instructions: bool,
}

fn dropped_settings(
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
            .map(exercises::checked_name)
            .transpose()?;
        let deadline = args
            .deadline
            .as_ref()
            .map(|raw| parse_deadline(raw.as_deref()))
            .transpose()?;
        let groups = group_ops(&raw_ops)?;
        let mut parsed = Vec::with_capacity(groups.len());
        for group in &groups {
            let ops = crate::engine::parse_ops(&group.raw, PatchTarget::PageContent)
                .map_err(|e| in_call(e, &group.indexes))?;
            parsed.push(ops);
        }
        let exercise_id = args.exercise.id();
        let view = open_course_with_exercise(state, ctx, args.course.id(), exercise_id).await?;
        let exercise = view
            .staged
            .exercise(exercise_id)
            .ok_or_else(|| missing_exercise(&view, exercise_id))?
            .clone();
        let has_review_ops = groups
            .iter()
            .any(|group| group.part == ExercisePart::ReviewInstructions);
        review_plan(&view, exercise_id, args.review_config, has_review_ops)?;

        let ids = RandomIds;
        let mut after = view.staged.clone();
        if let Some(name) = name
            && let Some(record) = exercises::exercise_mut(&mut after, exercise_id)
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
            Some(ReviewConfigChoice::Fork) => {
                let instructions = after
                    .course_default_review_config
                    .as_ref()
                    .and_then(|config| config.review_instructions.clone());
                if let Some(record) = exercises::exercise_mut(&mut after, exercise_id) {
                    record.review_config = ExerciseReviewConfig::Own {
                        config_id: ids.new_id(),
                        review_instructions: instructions.map(Arc::new),
                    };
                }
            }
            Some(ReviewConfigChoice::UseCourseDefault) => {
                if let Some(record) = exercises::exercise_mut(&mut after, exercise_id) {
                    record.review_config = ExerciseReviewConfig::CourseDefault;
                }
            }
            Some(ReviewConfigChoice::EditCourseDefault) | None => {}
        }

        let mut created = Vec::new();
        let mut labels = BTreeMap::new();
        for (group, ops) in groups.iter().zip(&parsed) {
            let list = part_list(&after, exercise_id, group.part)?;
            let document = exercises::document(&after, list)
                .ok_or_else(|| missing_exercise(&view, exercise_id))??;
            let result = page_content::apply(document, &|_| None, ops, &ids)
                .map_err(|e| in_call(e, &group.indexes))?;
            exercises::set_blocks(&mut after, list, &result.page.blocks);
            created.extend(result.created.into_iter().map(|mut ids| {
                ids.op = group.indexes[ids.op];
                ids
            }));
            labels.extend(result.labels);
            warnings.extend(result.warnings.into_iter().map(|mut warning| {
                warning.op = warning.op.map(|op| group.indexes[op]);
                warning
            }));
        }
        created.sort_by_key(|ids| ids.op);

        let is_switch = matches!(
            args.review_config,
            Some(ReviewConfigChoice::Fork | ReviewConfigChoice::UseCourseDefault)
        );
        let mut dropped_review_settings = None;
        let mut existing_review_count = None;
        if is_switch {
            let mut conn = connection(state).await?;
            existing_review_count =
                peer_or_self_review_submissions::count_by_exercise_ids(&mut conn, &[exercise_id])
                    .await?
                    .get(&exercise_id)
                    .copied();
            if args.review_config == Some(ReviewConfigChoice::UseCourseDefault) {
                let page_id = view
                    .staged
                    .exercise_page_id(exercise_id)
                    .unwrap_or(exercise.page_id);
                let page = view
                    .current_page_snapshots(&mut conn, &[page_id])
                    .await?
                    .remove(&page_id);
                let course_default =
                    peer_or_self_review_configs::get_course_default_cms_peer_review(
                        &mut conn,
                        view.course.id,
                    )
                    .await
                    .optional()?;
                dropped_review_settings = page
                    .as_ref()
                    .and_then(|page| page.exercises.iter().find(|e| e.id == exercise_id))
                    .map(|own| dropped_settings(own, course_default.as_ref()));
            }
        }
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
                args.dry_run,
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
        Ok(result.into())
    }
}

/// `error` of one group's ops, with the op index it names translated to the call's.
fn in_call(mut error: EditError, indexes: &[usize]) -> EditError {
    error.op = error.op.and_then(|op| indexes.get(op).copied());
    error
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_fixtures::id;

    #[test]
    fn exercise_paths_split_into_part_and_block_path() {
        let task = id("task");
        assert_eq!(
            split_exercise_path(&format!("/tasks/{task}")).unwrap(),
            (ExercisePart::Task(task), String::new())
        );
        assert_eq!(
            split_exercise_path(&format!("/tasks/{task}/{}/attributes/content", id("p1"))).unwrap(),
            (
                ExercisePart::Task(task),
                format!("/{}/attributes/content", id("p1"))
            )
        );
        assert_eq!(
            split_exercise_path("/review_instructions").unwrap(),
            (ExercisePart::ReviewInstructions, String::new())
        );
        for invalid in ["", "/tasks", "/tasks/x", "/name", "tasks/1"] {
            assert!(split_exercise_path(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn ops_group_by_instructions_and_keep_their_call_indexes() {
        let (task, p1) = (id("task"), id("p1"));
        let groups = group_ops(&[
            json!({"op": "remove", "path": format!("/review_instructions/{p1}")}),
            json!({"op": "add", "path": format!("/tasks/{task}"), "position": "end", "value": {"name": "core/paragraph"}}),
            json!({"op": "remove", "path": format!("/review_instructions/{}", id("p2"))}),
        ])
        .unwrap();
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].part, ExercisePart::ReviewInstructions);
        assert_eq!(groups[0].indexes, vec![0, 2]);
        assert_eq!(groups[0].raw[0]["path"], json!(format!("/{p1}")));
        assert_eq!(groups[1].raw[0]["path"], json!(""));

        let across = group_ops(&[json!({
            "op": "move",
            "from": format!("/tasks/{task}/{p1}"),
            "path": "/review_instructions",
            "position": "end",
        })]);
        assert_eq!(across.unwrap_err().code, EditErrorCode::InvalidPath);
        let to_page = group_ops(&[
            json!({"op": "move", "path": format!("/tasks/{task}"), "to_page": id("pg")}),
        ]);
        assert_eq!(to_page.unwrap_err().code, EditErrorCode::FieldNotAllowed);
    }

    #[test]
    fn names_are_one_line_of_plain_text() {
        assert_eq!(exercises::checked_name("  Loops  ").unwrap(), "Loops");
        for invalid in ["", "  ", "a\nb", "<b>Loops</b>"] {
            assert!(exercises::checked_name(invalid).is_err(), "{invalid:?}");
        }
        assert_eq!(exercises::checked_name("x < y").unwrap(), "x < y");
    }

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
                review_plan(&view, exercise, choice, has_review_ops).is_err(),
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
                review_plan(&view, exercise, choice, has_review_ops).is_ok(),
                "{exercise} {choice:?} {has_review_ops}"
            );
        }

        let mut without_reviews = view;
        exercises::exercise_mut(&mut without_reviews.staged, own)
            .unwrap()
            .needs_peer_review = false;
        assert!(review_plan(&without_reviews, own, None, true).is_err());
    }

    #[test]
    fn read_paths_get_the_instructions_prefix() {
        let mut read = json!({"items": [{"path": "/a", "innerBlocks": [{"path": "/b"}]}], "parent": "/c/innerBlocks", "next": {"path": "/d"}});
        prefix_paths(&mut read, "/tasks/t");
        assert_eq!(
            read["items"][0]["innerBlocks"][0]["path"],
            json!("/tasks/t/b")
        );
        assert_eq!(read["parent"], json!("/tasks/t/c/innerBlocks"));
        assert_eq!(read["next"]["path"], json!("/tasks/t/d"));
    }
}
