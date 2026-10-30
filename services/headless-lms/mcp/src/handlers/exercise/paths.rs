//! Exercise paths: `/tasks/<task id>/...` and `/review_instructions/...`, and the page-content
//! paths of the instructions they lead into.

use headless_lms_models::library::agent_changesets::course_state::CourseState;
use serde_json::{Value, json};
use uuid::Uuid;

use super::REVIEW_INSTRUCTIONS;
use crate::engine::{EditError, EditErrorCode};
use crate::instruction_lists::{self, InstructionsList};
use crate::tools::ToolError;

/// Which part of an exercise a path starts at.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ExercisePart {
    Task(Uuid),
    ReviewInstructions,
}

/// Splits `/tasks/<task id>/rest` or `/review_instructions/rest` into the part and the page-content
/// path of the rest, `""` for the part's top level.
pub(super) fn split_exercise_path(path: &str) -> Result<(ExercisePart, String), EditError> {
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
pub(super) fn part_prefix(part: ExercisePart) -> String {
    match part {
        ExercisePart::Task(task_id) => format!("/tasks/{task_id}"),
        ExercisePart::ReviewInstructions => format!("/{REVIEW_INSTRUCTIONS}"),
    }
}

/// The instruction list `part` of the exercise is in `state`, or why it has none.
pub(super) fn part_list(
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
        ExercisePart::ReviewInstructions => instruction_lists::review_list(state, exercise).ok_or_else(|| {
            EditError::new(
                EditErrorCode::NotFound,
                format!("exercise {exercise_id} has no peer or self reviews, so it shows no review instructions"),
            )
        }),
    }
}

/// Prefixes every block path in a read result with `prefix`.
pub(super) fn prefix_paths(value: &mut Value, prefix: &str) {
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

/// The ops of one instruction list, with their indexes in the call.
#[derive(Debug)]
pub(super) struct PartOps {
    pub(super) part: ExercisePart,
    pub(super) indexes: Vec<usize>,
    pub(super) raw: Vec<Value>,
}

/// Groups the ops by the instructions they edit and rewrites their paths to page-content paths.
pub(super) fn group_ops(raw_ops: &[Value]) -> Result<Vec<PartOps>, EditError> {
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

/// The call's index of op `op` of a group whose ops are at `indexes` in the call.
pub(super) fn call_index(indexes: &[usize], op: usize) -> Result<usize, ToolError> {
    indexes.get(op).copied().ok_or_else(|| {
        ToolError::Internal(format!(
            "op {op} of a group of {} has no index in the call",
            indexes.len()
        ))
    })
}

/// `error` of one group's ops, with the op index it names translated to the call's.
pub(super) fn in_call(mut error: EditError, indexes: &[usize]) -> EditError {
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
