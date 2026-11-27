//! `patch_exercise_tasks`: global admins' edits of an exercise's slides and tasks: their exercise
//! services, private specs and repository exercises.

use std::collections::{BTreeMap, HashSet};
use std::sync::Arc;

use async_trait::async_trait;
use headless_lms_models::{
    CourseOrExamId, exercise_service_info, exercise_services,
    library::agent_changesets::course_state::{ExerciseRecord, ExerciseTaskRecord},
    repository_exercises::{self, RepositoryExercise},
};
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use super::{missing_exercise, open_course_with_exercise};
use crate::access::connection;
use crate::engine::{EditError, EditErrorCode, Warning, WarningCode};
use crate::ids::{IdGenerator, RandomIds};
use crate::staging::{self, WriteMode, WriteRequest};
use crate::state::McpState;
use crate::tools::args::{AnswerType, PatchExerciseTasksArgs, TaskOp, TaskOpKind};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome};

/// Handler of the `patch_exercise_tasks` tool.
pub struct PatchExerciseTasks;

/// The plugin of the only exercises students can solve in the browser, whose tests run in Pyodide.
const BROWSER_PLUGIN: &str = "python3";

fn op_error(index: usize, code: EditErrorCode, message: impl Into<String>) -> EditError {
    EditError::new(code, message).at_op(index)
}

/// What the ops of one call work on and leave behind.
struct TaskEdit<'a> {
    record: &'a mut ExerciseRecord,
    labels: BTreeMap<String, Uuid>,
    /// Tasks whose private spec the call wrote, with the op that wrote it last.
    written_specs: BTreeMap<Uuid, usize>,
    ids: RandomIds,
}

impl TaskEdit<'_> {
    /// The id `reference` names: an id, or a `$label` an earlier op of the call gave.
    fn resolve(
        &self,
        index: usize,
        field: &str,
        reference: Option<&str>,
    ) -> Result<Uuid, EditError> {
        let reference = reference.map(str::trim).ok_or_else(|| {
            op_error(
                index,
                EditErrorCode::MissingField,
                format!("this op needs {field}"),
            )
        })?;
        if reference.starts_with('$') {
            return self.labels.get(reference).copied().ok_or_else(|| {
                op_error(
                    index,
                    EditErrorCode::LabelUndefined,
                    format!("no earlier op of the call is labelled {reference}"),
                )
            });
        }
        Uuid::parse_str(reference.trim_start_matches('/')).map_err(|_| {
            op_error(
                index,
                EditErrorCode::InvalidValue,
                format!("{field} is an id or a $label, got {reference:?}"),
            )
        })
    }

    fn task_index(&self, index: usize, op: &TaskOp) -> Result<usize, EditError> {
        let task_id = self.resolve(index, "task", op.task.as_deref())?;
        self.record
            .tasks
            .iter()
            .position(|task| task.id == task_id)
            .ok_or_else(|| {
                op_error(
                    index,
                    EditErrorCode::NotFound,
                    format!("the exercise has no task {task_id}"),
                )
                .with_details(
                    json!({"tasks": self.record.tasks.iter().map(|t| t.id).collect::<Vec<_>>()}),
                )
            })
    }

    fn slide(&self, index: usize, reference: Option<&str>) -> Result<Uuid, EditError> {
        let slide_id = self.resolve(index, "slide", reference)?;
        if self.record.slides.contains(&slide_id) {
            Ok(slide_id)
        } else {
            Err(op_error(
                index,
                EditErrorCode::NotFound,
                format!("the exercise has no slide {slide_id}"),
            )
            .with_details(json!({"slides": self.record.slides})))
        }
    }

    fn label(&mut self, index: usize, label: Option<&str>, id: Uuid) -> Result<(), EditError> {
        let Some(label) = label else {
            return Ok(());
        };
        if !label.starts_with('$') || label.len() < 2 {
            return Err(op_error(
                index,
                EditErrorCode::LabelInvalid,
                format!("labels look like \"$name\", got {label:?}"),
            ));
        }
        if self.labels.insert(label.to_string(), id).is_some() {
            return Err(op_error(
                index,
                EditErrorCode::LabelReused,
                format!("{label} names an earlier item of the call"),
            ));
        }
        Ok(())
    }

    /// Puts `task` into its slide, before the task `before` names or at the slide's end.
    fn insert_task(
        &mut self,
        index: usize,
        mut task: ExerciseTaskRecord,
        before: Option<&str>,
    ) -> Result<(), EditError> {
        let position = match before {
            Some(before) => {
                let before_id = self.resolve(index, "before", Some(before))?;
                let position = self
                    .record
                    .tasks
                    .iter()
                    .position(|t| t.id == before_id)
                    .ok_or_else(|| {
                        op_error(
                            index,
                            EditErrorCode::NotFound,
                            format!("the exercise has no task {before_id}"),
                        )
                    })?;
                task.slide_id = self.record.tasks[position].slide_id;
                position
            }
            None => self
                .record
                .tasks
                .iter()
                .rposition(|t| t.slide_id == task.slide_id)
                .map_or(self.record.tasks.len(), |last| last + 1),
        };
        self.record.tasks.insert(position, task);
        self.record.sort_tasks_by_slide();
        Ok(())
    }
}

/// The exercise service that prepares exercise repositories, whose tasks use repository
/// exercises.
async fn repository_service_slug(conn: &mut PgConnection) -> Result<Option<String>, ToolError> {
    Ok(
        exercise_service_info::get_all_exercise_services_by_type(conn)
            .await?
            .into_iter()
            .find(|(_, (_, info))| info.repository_preparation_endpoint_path.is_some())
            .map(|(slug, _)| slug),
    )
}

/// The repository exercise, checked to be one of the course's.
async fn course_repository_exercise(
    conn: &mut PgConnection,
    index: usize,
    course_id: Uuid,
    id: Uuid,
) -> Result<RepositoryExercise, ToolError> {
    repository_exercises::get_in_course_or_exam(conn, id, CourseOrExamId::Course(course_id))
        .await?
        .ok_or_else(|| {
            op_error(
                index,
                EditErrorCode::NotFound,
                format!("repository exercise {id} isn't one of this course's repositories' current exercises; get_exercise_repositories lists them"),
            )
            .into()
        })
}

/// The private spec the exercise editor saves for a task using `exercise`.
fn repository_spec(
    index: usize,
    exercise: &RepositoryExercise,
    answer_type: AnswerType,
) -> Result<Value, EditError> {
    if answer_type == AnswerType::Browser {
        let plugin = exercise
            .details
            .as_ref()
            .and_then(|details| details.get("plugin"))
            .and_then(Value::as_str);
        if plugin.is_some_and(|plugin| plugin != BROWSER_PLUGIN) {
            return Err(op_error(
                index,
                EditErrorCode::InvalidValue,
                format!(
                    "answer_type browser needs a Python exercise; {}/{} uses {}",
                    exercise.part,
                    exercise.name,
                    plugin.unwrap_or_default()
                ),
            ));
        }
    }
    Ok(json!({"type": answer_type, "repository_exercise": exercise}))
}

/// The repository exercise id a private spec names, as the exercise editor stores it.
fn spec_repository_exercise_id(spec: Option<&Value>) -> Option<Uuid> {
    spec?
        .pointer("/repository_exercise/id")?
        .as_str()
        .and_then(|id| Uuid::parse_str(id).ok())
}

/// The spec `link_repository_exercise` would build for the repository exercise an agent-written
/// spec names, keeping only its `type`; `None` when the spec names none.
async fn rebuilt_repository_spec(
    conn: &mut PgConnection,
    index: usize,
    course_id: Uuid,
    spec: Option<&Value>,
) -> Result<Option<(Value, Uuid)>, ToolError> {
    let Some(id) = spec_repository_exercise_id(spec) else {
        return Ok(None);
    };
    let answer_type = match spec.and_then(|spec| spec.get("type")) {
        None => AnswerType::Editor,
        Some(answer_type) => serde_json::from_value(answer_type.clone()).map_err(|_| {
            op_error(
                index,
                EditErrorCode::InvalidValue,
                format!("the private spec's type is editor or browser, got {answer_type}"),
            )
        })?,
    };
    let exercise = course_repository_exercise(conn, index, course_id, id).await?;
    let spec = repository_spec(index, &exercise, answer_type)?;
    Ok(Some((spec, exercise.id)))
}

/// Gives the task a new service and spec. Declared spec files stay while the service does, since
/// only the service's editor can declare them again.
fn set_task_spec(
    task: &mut ExerciseTaskRecord,
    exercise_type: String,
    private_spec: Option<Value>,
    repository_exercise_id: Option<Uuid>,
) {
    if task.exercise_type != exercise_type {
        task.private_spec_files.clear();
    }
    task.exercise_type = exercise_type;
    task.private_spec = private_spec.map(Arc::new);
    task.repository_exercise_id = repository_exercise_id;
}

/// The errors of `spec` against `schema`, at most 20.
fn schema_errors(schema: &Value, spec: &Value) -> Result<Vec<String>, String> {
    let validator = jsonschema::validator_for(schema).map_err(|e| e.to_string())?;
    Ok(validator
        .iter_errors(spec)
        .take(20)
        .map(|error| format!("{}: {error}", error.instance_path()))
        .collect())
}

#[derive(Serialize)]
struct TaskSummary {
    id: Uuid,
    slide: Uuid,
    exercise_type: String,
    repository_exercise_id: Option<Uuid>,
}

#[derive(Serialize)]
struct TasksSummary {
    exercise: Uuid,
    slides: Vec<Uuid>,
    tasks: Vec<TaskSummary>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    labels: BTreeMap<String, Uuid>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    warnings: Vec<Warning>,
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for PatchExerciseTasks {
    type Args = PatchExerciseTasksArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: PatchExerciseTasksArgs,
    ) -> Result<ToolOutcome, ToolError> {
        if args.ops.is_empty() {
            return Err(EditError::new(EditErrorCode::MissingField, "the call has no ops").into());
        }
        let exercise_id = args.exercise.id();
        let course_id = args.course.id();
        let view = open_course_with_exercise(state, ctx, course_id, exercise_id).await?;
        let mut after = view.staged.clone();
        let record = after
            .exercise_mut(exercise_id)
            .ok_or_else(|| missing_exercise(&view, exercise_id))?;
        let mut conn = connection(state).await?;
        let repository_slug = repository_service_slug(&mut conn).await?;
        let repository_slug_or_error = |index: usize| {
            repository_slug.clone().ok_or_else(|| {
                op_error(
                    index,
                    EditErrorCode::InvalidValue,
                    "no exercise service handles exercise repositories",
                )
            })
        };
        let mut edit = TaskEdit {
            record,
            labels: BTreeMap::new(),
            written_specs: BTreeMap::new(),
            ids: RandomIds,
        };
        for (index, op) in args.ops.iter().enumerate() {
            match op.op {
                TaskOpKind::LinkRepositoryExercise => {
                    let task = edit.task_index(index, op)?;
                    let id = op.repository_exercise.ok_or_else(|| {
                        op_error(
                            index,
                            EditErrorCode::MissingField,
                            "link_repository_exercise needs repository_exercise",
                        )
                    })?;
                    let exercise =
                        course_repository_exercise(&mut conn, index, course_id, id.id()).await?;
                    let spec = repository_spec(
                        index,
                        &exercise,
                        op.answer_type.unwrap_or(AnswerType::Editor),
                    )?;
                    let exercise_type = repository_slug_or_error(index)?;
                    let task = &mut edit.record.tasks[task];
                    set_task_spec(task, exercise_type, Some(spec), Some(exercise.id));
                    let task_id = task.id;
                    edit.written_specs.insert(task_id, index);
                }
                TaskOpKind::UnlinkRepositoryExercise | TaskOpKind::ReplaceTask => {
                    let task = edit.task_index(index, op)?;
                    let exercise_type = op.exercise_type.clone().ok_or_else(|| {
                        op_error(
                            index,
                            EditErrorCode::MissingField,
                            "this op needs exercise_type, the service the task switches to",
                        )
                    })?;
                    let is_repository_type = Some(&exercise_type) == repository_slug.as_ref();
                    if op.op == TaskOpKind::UnlinkRepositoryExercise && is_repository_type {
                        return Err(op_error(
                            index,
                            EditErrorCode::InvalidValue,
                            format!("unlink_repository_exercise switches the task away from {exercise_type}; link_repository_exercise links another repository exercise"),
                        )
                        .into());
                    }
                    let rebuilt = if is_repository_type {
                        rebuilt_repository_spec(
                            &mut conn,
                            index,
                            course_id,
                            op.private_spec.as_ref(),
                        )
                        .await?
                    } else {
                        None
                    };
                    let (spec, repository_exercise_id) = match rebuilt {
                        Some((spec, id)) => (Some(spec), Some(id)),
                        None => (op.private_spec.clone(), None),
                    };
                    let task = &mut edit.record.tasks[task];
                    let has_spec = spec.is_some();
                    set_task_spec(task, exercise_type, spec, repository_exercise_id);
                    let task_id = task.id;
                    if has_spec {
                        edit.written_specs.insert(task_id, index);
                    } else {
                        edit.written_specs.remove(&task_id);
                    }
                }
                TaskOpKind::AddTask => {
                    let slide_id = match &op.before {
                        Some(_) => edit.record.slides.first().copied().unwrap_or_default(),
                        None => edit.slide(index, op.slide.as_deref())?,
                    };
                    let mut task = ExerciseTaskRecord {
                        id: edit.ids.new_id(),
                        slide_id,
                        exercise_type: String::new(),
                        assignment: Arc::new(json!([])),
                        private_spec: None,
                        private_spec_files: Vec::new(),
                        repository_exercise_id: None,
                    };
                    if let Some(id) = op.repository_exercise {
                        let exercise =
                            course_repository_exercise(&mut conn, index, course_id, id.id())
                                .await?;
                        task.private_spec = Some(Arc::new(repository_spec(
                            index,
                            &exercise,
                            op.answer_type.unwrap_or(AnswerType::Editor),
                        )?));
                        task.exercise_type = repository_slug_or_error(index)?;
                        task.repository_exercise_id = Some(exercise.id);
                    } else {
                        task.exercise_type = op.exercise_type.clone().ok_or_else(|| {
                            op_error(index, EditErrorCode::MissingField, "add_task needs exercise_type, or repository_exercise for a task using a repository exercise")
                        })?;
                        task.private_spec = op.private_spec.clone().map(Arc::new);
                        if Some(&task.exercise_type) == repository_slug.as_ref()
                            && let Some((spec, id)) = rebuilt_repository_spec(
                                &mut conn,
                                index,
                                course_id,
                                op.private_spec.as_ref(),
                            )
                            .await?
                        {
                            task.private_spec = Some(Arc::new(spec));
                            task.repository_exercise_id = Some(id);
                        }
                    }
                    let has_spec = task.private_spec.is_some();
                    let task_id = task.id;
                    edit.insert_task(index, task, op.before.as_deref())?;
                    edit.label(index, op.label.as_deref(), task_id)?;
                    if has_spec {
                        edit.written_specs.insert(task_id, index);
                    }
                }
                TaskOpKind::RemoveTask => {
                    let task = edit.task_index(index, op)?;
                    let removed = edit.record.tasks.remove(task);
                    edit.written_specs.remove(&removed.id);
                }
                TaskOpKind::MoveTask => {
                    let position = edit.task_index(index, op)?;
                    let mut task = edit.record.tasks.remove(position);
                    if op.before.is_none()
                        && let Some(slide) = op.slide.as_deref()
                    {
                        task.slide_id = edit.slide(index, Some(slide))?;
                    }
                    edit.insert_task(index, task, op.before.as_deref())?;
                }
                TaskOpKind::AddSlide => {
                    let slide_id = edit.ids.new_id();
                    let position = match op.before.as_deref() {
                        Some(before) => {
                            let before = edit.slide(index, Some(before))?;
                            edit.record
                                .slides
                                .iter()
                                .position(|id| *id == before)
                                .unwrap_or_default()
                        }
                        None => edit.record.slides.len(),
                    };
                    edit.record.slides.insert(position, slide_id);
                    edit.label(index, op.label.as_deref(), slide_id)?;
                    edit.record.sort_tasks_by_slide();
                }
                TaskOpKind::RemoveSlide => {
                    let slide_id = edit.slide(index, op.slide.as_deref())?;
                    edit.record.slides.retain(|id| *id != slide_id);
                    let removed: HashSet<Uuid> = edit
                        .record
                        .tasks
                        .iter()
                        .filter(|t| t.slide_id == slide_id)
                        .map(|t| t.id)
                        .collect();
                    edit.record.tasks.retain(|t| !removed.contains(&t.id));
                    edit.written_specs.retain(|id, _| !removed.contains(id));
                }
            }
        }

        let invariant = |message: String| EditError::new(EditErrorCode::InvariantViolated, message);
        if edit.record.slides.is_empty() {
            return Err(invariant("an exercise needs at least one slide".into()).into());
        }
        if let Some(empty) = edit
            .record
            .slides
            .iter()
            .find(|slide| !edit.record.tasks.iter().any(|t| t.slide_id == **slide))
        {
            return Err(invariant(format!("slide {empty} has no tasks; every slide needs at least one (add_task, or remove_slide)")).into());
        }
        let services: HashSet<String> = exercise_services::get_exercise_services(&mut conn)
            .await?
            .into_iter()
            .map(|service| service.slug)
            .collect();
        for task in &edit.record.tasks {
            if !services.contains(&task.exercise_type) {
                return Err(invariant(format!(
                    "task {} has exercise_type {:?}, which isn't an exercise service",
                    task.id, task.exercise_type
                ))
                .with_details(json!({"exercise_types": services}))
                .into());
            }
            if Some(&task.exercise_type) == repository_slug.as_ref()
                && task.repository_exercise_id.is_none()
            {
                return Err(invariant(format!(
                    "task {} uses {} without a repository exercise; link one with link_repository_exercise or give it another exercise_type with replace_task",
                    task.id, task.exercise_type
                ))
                .into());
            }
        }
        drop(conn);

        let mut warnings = Vec::new();
        let written: Vec<(Uuid, usize, String, Arc<Value>)> = edit
            .written_specs
            .iter()
            .filter_map(|(task_id, op)| {
                let task = edit.record.tasks.iter().find(|t| t.id == *task_id)?;
                Some((
                    *task_id,
                    *op,
                    task.exercise_type.clone(),
                    task.private_spec.clone()?,
                ))
            })
            .collect();
        for (task_id, op, exercise_type, spec) in written {
            let schema = match state.private_spec_schema(&exercise_type).await {
                Ok(schema) => schema,
                Err(ToolError::Internal(message))
                | Err(ToolError::InvalidArguments { message }) => {
                    let mut warning = Warning::new(
                        WarningCode::PrivateSpecNotChecked,
                        format!(
                            "couldn't get the {exercise_type} private spec schema ({message}); the service checks task {task_id}'s spec when the changeset is published"
                        ),
                    );
                    warning.op = Some(op);
                    warnings.push(warning);
                    continue;
                }
                Err(other) => return Err(other),
            };
            let Some(schema) = schema else {
                let mut warning = Warning::new(
                    WarningCode::PrivateSpecNotChecked,
                    format!(
                        "{exercise_type} serves no private spec schema; it checks task {task_id}'s spec when the changeset is published"
                    ),
                );
                warning.op = Some(op);
                warnings.push(warning);
                continue;
            };
            let errors = schema_errors(&schema.schema, &spec).map_err(|e| {
                ToolError::Internal(format!(
                    "the {exercise_type} private spec schema doesn't compile: {e}"
                ))
            })?;
            if !errors.is_empty() {
                return Err(op_error(
                    op,
                    EditErrorCode::InvalidValue,
                    format!("the private spec of task {task_id} doesn't match the {exercise_type} schema"),
                )
                .with_fix(format!("guide with exercise_types [\"{exercise_type}\"] returns the schema and examples"))
                .with_details(json!({"errors": errors}))
                .into());
            }
        }

        let summary = TasksSummary {
            exercise: exercise_id,
            slides: edit.record.slides.clone(),
            tasks: edit
                .record
                .tasks
                .iter()
                .map(|task| TaskSummary {
                    id: task.id,
                    slide: task.slide_id,
                    exercise_type: task.exercise_type.clone(),
                    repository_exercise_id: task.repository_exercise_id,
                })
                .collect(),
            labels: edit.labels,
            warnings,
        };
        let report = staging::commit(
            state,
            ctx,
            &view,
            after,
            WriteRequest::new(
                json!(&args),
                format!("edit of the tasks of exercise {exercise_id}"),
                WriteMode::from_dry_run(args.dry_run),
            ),
        )
        .await?;
        Ok(report.into_result(&summary).into())
    }
}
