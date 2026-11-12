//! Reading a task's specs through `get_exercise`: `/tasks/<task id>/specs[/<kind>[/<pointer>]]`.

use std::collections::HashMap;

use headless_lms_models::{exercise_tasks, library::entity_snapshots::PageSnapshot};
use serde_json::{Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::engine::path::escape_segment;
use crate::engine::read::ReadState;
use crate::engine::{EditError, EditErrorCode};
use crate::text::serialized_len;
use crate::tools::ToolError;

const AUTHORITY: &str = "private_spec is what the editor saves and the only authoritative spec; the service derives the others from it when it changes.";
const DERIVED_AT_PUBLISH: &str = "This task's private spec isn't published yet, so its public and model solution specs are derived at publish; they are null until then.";

/// One of a task's specs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpecKind {
    Private,
    Public,
    ModelSolution,
}

impl SpecKind {
    const ALL: [SpecKind; 3] = [SpecKind::Private, SpecKind::Public, SpecKind::ModelSolution];

    fn name(self) -> &'static str {
        match self {
            SpecKind::Private => "private_spec",
            SpecKind::Public => "public_spec",
            SpecKind::ModelSolution => "model_solution_spec",
        }
    }
}

/// A path into a task's specs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecPath {
    pub task_id: Uuid,
    /// `None` for all three.
    pub kind: Option<SpecKind>,
    /// A JSON pointer into the spec, `""` for the whole spec.
    pub pointer: String,
}

impl SpecPath {
    /// The path as get_exercise addresses it.
    fn to_path(&self, kind: Option<SpecKind>, pointer: &str) -> String {
        let mut path = format!("/tasks/{}/specs", self.task_id);
        if let Some(kind) = kind {
            path.push('/');
            path.push_str(kind.name());
            path.push_str(pointer);
        }
        path
    }
}

/// The spec path `path` names; `None` if it isn't one, an error if it is a malformed one.
pub fn parse_spec_path(path: &str) -> Option<Result<SpecPath, EditError>> {
    let rest = path.strip_prefix("/tasks/")?;
    let (task, rest) = rest.split_once('/')?;
    let rest = rest.strip_prefix("specs")?;
    if !rest.is_empty() && !rest.starts_with('/') {
        return None;
    }
    let invalid = || {
        EditError::new(
            EditErrorCode::InvalidPath,
            format!("{path:?} isn't a spec path"),
        )
        .with_fix("spec paths are /tasks/<task id>/specs, /tasks/<task id>/specs/<private_spec|public_spec|model_solution_spec> and a JSON pointer after that, e.g. /tasks/<task id>/specs/private_spec/items/0")
    };
    let Ok(task_id) = Uuid::parse_str(task) else {
        return Some(Err(invalid()));
    };
    if rest.is_empty() {
        return Some(Ok(SpecPath {
            task_id,
            kind: None,
            pointer: String::new(),
        }));
    }
    let rest = &rest[1..];
    let (kind, pointer) = match rest.split_once('/') {
        Some((kind, pointer)) => (kind, format!("/{pointer}")),
        None => (rest, String::new()),
    };
    let Some(kind) = SpecKind::ALL.into_iter().find(|k| k.name() == kind) else {
        return Some(Err(invalid()));
    };
    Some(Ok(SpecPath {
        task_id,
        kind: Some(kind),
        pointer,
    }))
}

/// A task's specs in one state of the course.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct TaskSpecs {
    pub private_spec: Option<Value>,
    pub public_spec: Option<Value>,
    pub model_solution_spec: Option<Value>,
    /// The stored files the private spec references, by id.
    pub private_spec_files: Vec<Uuid>,
    /// The derived specs are left null: the private spec differs from the published one.
    pub is_derived_at_publish: bool,
}

impl TaskSpecs {
    fn spec(&self, kind: SpecKind) -> Option<&Value> {
        match kind {
            SpecKind::Private => self.private_spec.as_ref(),
            SpecKind::Public => self.public_spec.as_ref(),
            SpecKind::ModelSolution => self.model_solution_spec.as_ref(),
        }
    }
}

/// The specs of the exercise's tasks in `read_state`, by task id. `page` is the page holding the
/// exercise in that state.
pub async fn load_task_specs(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    page: Option<&PageSnapshot>,
    read_state: ReadState,
) -> Result<HashMap<Uuid, TaskSpecs>, ToolError> {
    let live: HashMap<Uuid, exercise_tasks::ExerciseTask> =
        exercise_tasks::get_exercise_tasks_by_exercise_id(conn, exercise_id)
            .await?
            .into_iter()
            .map(|task| (task.id, task))
            .collect();
    let snapshot_tasks = page.into_iter().flat_map(|page| {
        let slides: Vec<Uuid> = page
            .exercise_slides
            .iter()
            .filter(|slide| slide.exercise_id == exercise_id)
            .map(|slide| slide.id)
            .collect();
        page.exercise_tasks
            .iter()
            .filter(move |task| slides.contains(&task.exercise_slide_id))
    });
    let mut specs = HashMap::new();
    for task in snapshot_tasks {
        let live_task = live.get(&task.id);
        let is_published =
            live_task.is_some_and(|live_task| live_task.private_spec == task.private_spec);
        let derived = |spec: fn(&exercise_tasks::ExerciseTask) -> &Option<Value>| {
            live_task
                .filter(|_| is_published)
                .and_then(|live_task| spec(live_task).clone())
        };
        specs.insert(
            task.id,
            TaskSpecs {
                private_spec: task.private_spec.clone(),
                public_spec: derived(|t| &t.public_spec),
                model_solution_spec: derived(|t| &t.model_solution_spec),
                private_spec_files: task.private_spec_files.clone(),
                is_derived_at_publish: read_state == ReadState::Staged && !is_published,
            },
        );
    }
    Ok(specs)
}

/// The read of a spec path, or an error naming smaller paths when it is over `budget_bytes`.
pub fn read_specs(
    path: &SpecPath,
    specs: Option<&TaskSpecs>,
    budget_bytes: usize,
) -> Result<Value, ToolError> {
    let specs = specs.ok_or_else(|| {
        ToolError::Edit(EditError::new(
            EditErrorCode::NotFound,
            format!("the exercise has no task {} in this state", path.task_id),
        ))
    })?;
    let value = match path.kind {
        None => json!({
            "private_spec": specs.private_spec,
            "public_spec": specs.public_spec,
            "model_solution_spec": specs.model_solution_spec,
        }),
        Some(kind) => {
            let spec = specs.spec(kind).cloned().unwrap_or(Value::Null);
            spec.pointer(&path.pointer).cloned().ok_or_else(|| {
                ToolError::Edit(EditError::new(
                    EditErrorCode::NotFound,
                    format!("{} has nothing at {:?}", kind.name(), path.pointer),
                ))
            })?
        }
    };
    let size = serialized_len(&value);
    if size > budget_bytes {
        let children: Vec<(Option<SpecKind>, String, &Value)> = match (path.kind, &value) {
            (None, _) => SpecKind::ALL
                .into_iter()
                .filter_map(|kind| Some((Some(kind), String::new(), specs.spec(kind)?)))
                .collect(),
            (kind, Value::Object(map)) => map
                .iter()
                .map(|(key, child)| {
                    (
                        kind,
                        format!("{}/{}", path.pointer, escape_segment(key)),
                        child,
                    )
                })
                .collect(),
            (kind, Value::Array(items)) => items
                .iter()
                .enumerate()
                .map(|(index, child)| (kind, format!("{}/{index}", path.pointer), child))
                .collect(),
            _ => Vec::new(),
        };
        let path_count = children.len();
        let smaller: Vec<Value> = children
            .into_iter()
            .take(100)
            .map(|(kind, pointer, child)| {
                json!({"path": path.to_path(kind, &pointer), "bytes": serialized_len(child)})
            })
            .collect();
        return Err(ToolError::Edit(
            EditError::new(
                EditErrorCode::TooLarge,
                format!(
                    "{} is {size} bytes, over the {budget_bytes} bytes a read may return",
                    path.to_path(path.kind, &path.pointer)
                ),
            )
            .with_fix("read the smaller paths listed in details, one or a few per selector")
            .with_details(json!({ "paths": smaller, "path_count": path_count })),
        ));
    }
    let mut read = json!({
        "path": path.to_path(path.kind, &path.pointer),
        "value": value,
        "note": AUTHORITY,
    });
    if path.kind.is_none_or(|kind| kind == SpecKind::Private) {
        read["private_spec_files"] = json!(specs.private_spec_files);
    }
    if specs.is_derived_at_publish {
        read["derived_at_publish"] = json!(DERIVED_AT_PUBLISH);
    }
    Ok(read)
}
