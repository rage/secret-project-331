//! `patch_course_settings`: course and module settings. Publishing switches stay read-only.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use super::error::{EditError, EditErrorCode};
use super::labels::parse_uuid;
use super::op::Op;
use super::{
    CreatedIdLog, CreatedIds, is_course_root, new_item_objects, non_empty_string, split_path,
};
use crate::ids::IdGenerator;

/// The settings document `get_course_settings` shows and `patch_course_settings` edits.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CourseSettings {
    pub course: CourseSettingsCourse,
    pub modules: Vec<ModuleSettings>,
}

/// The course's own settings. Its fields are [`EDITABLE_COURSE_FIELDS`],
/// [`READ_ONLY_COURSE_FIELDS`] and `audiences`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CourseSettingsCourse {
    pub id: Uuid,
    pub slug: String,
    pub language_code: String,
    pub name: String,
    pub description: Option<String>,
    pub is_draft: bool,
    pub is_test_mode: bool,
    pub is_unlisted: bool,
    pub chapter_locking_enabled: bool,
    pub base_module_completion_requires_n_submodule_completions: i32,
    pub ai_policy: AiPolicy,
    pub audiences: Vec<Audience>,
    pub closed_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// The course's AI policy with the names agents use; mirrors the models' `CourseAiPolicy`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum AiPolicy {
    NotSet,
    NoAi,
    PlanningOnly,
    Limited,
    FullUse,
    Required,
}

impl AiPolicy {
    /// Every policy's name as agents write it.
    fn names() -> Vec<String> {
        schemars::schema_for!(AiPolicy)
            .get("enum")
            .and_then(Value::as_array)
            .map(|names| {
                names
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// A target audience of the course.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Audience {
    pub id: Uuid,
    pub name: String,
}

/// One module's settings. Its fields are `id`, `name` and [`EDITABLE_MODULE_FIELDS`].
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ModuleSettings {
    pub id: Uuid,
    /// Shown for orientation; renamed with the structure tool.
    pub name: Option<String>,
    pub completion_policy: CompletionPolicy,
    pub certification_enabled: bool,
}

/// Module completion. The `treshold` spelling matches the stored field names.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CompletionPolicy {
    pub policy: CompletionPolicyKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number_of_points_treshold: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number_of_exercises_attempted_treshold: Option<i32>,
    pub requires_exam: bool,
}

/// Whether a module completes on its own when its thresholds are met.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CompletionPolicyKind {
    Automatic,
    Manual,
}

impl CompletionPolicy {
    /// The policy of a module completed by hand, which has no thresholds.
    pub fn manual() -> Self {
        Self {
            policy: CompletionPolicyKind::Manual,
            number_of_points_treshold: None,
            number_of_exercises_attempted_treshold: None,
            requires_exam: false,
        }
    }
}

/// The new state after a successful call. Nothing is stored until the caller stages it.
#[derive(Debug, Clone, PartialEq)]
pub struct SettingsResult {
    pub settings: CourseSettings,
    pub created: Vec<CreatedIds>,
}

/// Course fields agents may set.
pub(crate) const EDITABLE_COURSE_FIELDS: [&str; 6] = [
    "name",
    "description",
    "is_unlisted",
    "chapter_locking_enabled",
    "base_module_completion_requires_n_submodule_completions",
    "ai_policy",
];
/// Course fields agents see but only teachers change.
pub(crate) const READ_ONLY_COURSE_FIELDS: [&str; 6] = [
    "id",
    "slug",
    "language_code",
    "is_draft",
    "is_test_mode",
    "closed_at",
];
/// Module fields agents may set with this tool; the structure tool renames modules.
pub(crate) const EDITABLE_MODULE_FIELDS: [&str; 2] = ["completion_policy", "certification_enabled"];
/// The fields of a completion policy.
pub(crate) const POLICY_FIELDS: [&str; 4] = [
    "policy",
    "number_of_points_treshold",
    "number_of_exercises_attempted_treshold",
    "requires_exam",
];

/// Applies `ops` in order to `doc`.
pub fn apply(
    doc: &CourseSettings,
    ops: &[Op],
    ids: &dyn IdGenerator,
) -> Result<SettingsResult, EditError> {
    let mut settings = doc.clone();
    let mut ids = CreatedIdLog::new(ids);
    for (index, op) in ops.iter().enumerate() {
        ids.set_op(index);
        apply_op(&mut settings, op, &mut ids).map_err(|e| e.at_op(index))?;
    }
    Ok(SettingsResult {
        settings,
        created: ids.into_created(),
    })
}

fn apply_op(
    settings: &mut CourseSettings,
    op: &Op,
    ids: &mut CreatedIdLog,
) -> Result<(), EditError> {
    let segments = split_path(op.path()).ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidPath,
            "paths look like /course/name or /<module id>/completion_policy",
        )
    })?;
    if is_course_root(&segments[0], settings.course.id) {
        return course_op(&mut settings.course, op, &segments[1..], ids);
    }
    let id = parse_uuid(&segments[0], op.path())?;
    if let Some(position) = settings.course.audiences.iter().position(|a| a.id == id) {
        return match (op, segments.get(1).map(String::as_str)) {
            (Op::Remove { .. }, None) => {
                settings.course.audiences.remove(position);
                Ok(())
            }
            (Op::Replace { value, .. }, Some("name")) => {
                settings.course.audiences[position].name =
                    non_empty_string(Some(value), "an audience name")?;
                Ok(())
            }
            _ => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "audiences are added to /course/audiences, renamed at /<id>/name and removed at /<id>",
            )),
        };
    }
    let module = settings
        .modules
        .iter_mut()
        .find(|m| m.id == id)
        .ok_or_else(|| {
            EditError::new(
                EditErrorCode::NotFound,
                format!("no module or audience {id} in this course"),
            )
            .with_fix("get_course_settings lists module and audience ids")
        })?;
    module_op(module, op, &segments[1..])
}

fn course_op(
    course: &mut CourseSettingsCourse,
    op: &Op,
    rest: &[String],
    ids: &mut CreatedIdLog,
) -> Result<(), EditError> {
    let Some(field) = rest.first().map(String::as_str) else {
        return Err(EditError::new(
            EditErrorCode::InvalidPath,
            "name a course field, e.g. /course/name",
        ));
    };
    if field == "audiences" {
        return match op {
            Op::Add { value, .. } if rest.len() == 1 => {
                for object in new_item_objects(
                    value,
                    "an audience",
                    "a new audience is {\"name\":\"…\"}, or add a list of them",
                    &["name"],
                )? {
                    let id = ids.new_id();
                    course.audiences.push(Audience {
                        id,
                        name: non_empty_string(object.get("name"), "an audience name")?,
                    });
                }
                Ok(())
            }
            _ => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "audiences are added with add on /course/audiences and removed with remove on /<audience id>",
            )),
        };
    }
    if READ_ONLY_COURSE_FIELDS.contains(&field) {
        return Err(EditError::new(
            EditErrorCode::ReadOnlyField,
            format!(
                "{field} is read-only for agents; publishing, unpublishing and closing a course are done by the teacher in the web UI"
            ),
        ));
    }
    if !EDITABLE_COURSE_FIELDS.contains(&field) || rest.len() > 1 {
        return Err(EditError::new(
            EditErrorCode::UnknownField,
            format!("the course has no editable setting \"{}\"", rest.join("/")),
        )
        .with_fix(format!(
            "editable: {}, audiences",
            EDITABLE_COURSE_FIELDS.join(", ")
        )));
    }
    let value = match op {
        Op::Replace { value, .. } => value,
        Op::Remove { .. } => &Value::Null,
        _ => {
            return Err(EditError::new(
                EditErrorCode::InvalidOp,
                "course fields are set with replace",
            ));
        }
    };
    match field {
        "name" => course.name = non_empty_string(Some(value), "the course name")?,
        "description" => {
            course.description = match value {
                Value::Null => None,
                Value::String(s) => Some(s.clone()),
                _ => {
                    return Err(EditError::new(
                        EditErrorCode::InvalidValue,
                        "description is a string or null",
                    ));
                }
            }
        }
        "is_unlisted" => course.is_unlisted = boolean(Some(value), field)?,
        "chapter_locking_enabled" => course.chapter_locking_enabled = boolean(Some(value), field)?,
        "base_module_completion_requires_n_submodule_completions" => {
            course.base_module_completion_requires_n_submodule_completions = whole_number(value)
                .ok_or_else(|| {
                    EditError::new(
                        EditErrorCode::InvalidValue,
                        format!("{field} is a whole number, 0 or more"),
                    )
                })?
        }
        "ai_policy" => {
            course.ai_policy = serde_json::from_value(value.clone()).map_err(|_| {
                EditError::new(
                    EditErrorCode::InvalidValue,
                    format!("ai_policy is one of {}", AiPolicy::names().join(", ")),
                )
            })?
        }
        _ => unreachable!("checked against EDITABLE_COURSE_FIELDS"),
    }
    Ok(())
}

fn module_op(module: &mut ModuleSettings, op: &Op, rest: &[String]) -> Result<(), EditError> {
    match (rest.first().map(String::as_str), op) {
        (Some("name"), _) => Err(EditError::new(
            EditErrorCode::WrongTool,
            "module names are edited with patch_course_structure",
        )),
        (Some("certification_enabled"), Op::Replace { value, .. }) if rest.len() == 1 => {
            module.certification_enabled = boolean(Some(value), "certification_enabled")?;
            Ok(())
        }
        (Some("completion_policy"), Op::Replace { value, .. }) if rest.len() <= 2 => {
            match rest.get(1) {
                None => {
                    module.completion_policy = parse_policy(value)?;
                    Ok(())
                }
                Some(field) => set_policy_field(&mut module.completion_policy, field, Some(value)),
            }
        }
        (Some("completion_policy"), Op::Remove { .. }) if rest.len() == 2 => {
            set_policy_field(&mut module.completion_policy, &rest[1], None)
        }
        _ => Err(EditError::new(
            EditErrorCode::InvalidPath,
            "module settings are completion_policy (or one of its fields) and certification_enabled, set with replace",
        )),
    }
}

fn parse_policy(value: &Value) -> Result<CompletionPolicy, EditError> {
    let object = value.as_object().ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidValue,
            "completion_policy is an object such as {\"policy\":\"manual\"}",
        )
    })?;
    let mut policy = CompletionPolicy::manual();
    set_policy_field(&mut policy, "policy", object.get("policy"))?;
    for (field, value) in object.iter().filter(|(field, _)| *field != "policy") {
        set_policy_field(&mut policy, field, Some(value))?;
    }
    Ok(policy)
}

/// Sets one policy field, or clears it with `None`, and checks the result. Owns the errors for
/// unknown and misspelled field names.
fn set_policy_field(
    policy: &mut CompletionPolicy,
    field: &str,
    value: Option<&Value>,
) -> Result<(), EditError> {
    let threshold = |value: Option<&Value>| -> Result<Option<i32>, EditError> {
        match value {
            None | Some(Value::Null) => Ok(None),
            Some(value) => whole_number(value).map(Some).ok_or_else(|| {
                EditError::new(
                    EditErrorCode::InvalidValue,
                    format!("{field} is a whole number, 0 or more, or null"),
                )
            }),
        }
    };
    match field {
        "policy" => {
            policy.policy = match value.and_then(Value::as_str) {
                Some("automatic") => CompletionPolicyKind::Automatic,
                Some("manual") => {
                    *policy = CompletionPolicy::manual();
                    return Ok(());
                }
                _ => {
                    return Err(EditError::new(
                        EditErrorCode::InvalidValue,
                        "policy is \"automatic\" or \"manual\"",
                    ));
                }
            }
        }
        "number_of_points_treshold" => policy.number_of_points_treshold = threshold(value)?,
        "number_of_exercises_attempted_treshold" => {
            policy.number_of_exercises_attempted_treshold = threshold(value)?
        }
        "requires_exam" => policy.requires_exam = boolean(value, "requires_exam")?,
        other if other.contains("threshold") => {
            return Err(EditError::new(
                EditErrorCode::UnknownField,
                "the field names are spelled \"treshold\"",
            )
            .with_fix(other.replace("threshold", "treshold")));
        }
        other => {
            return Err(EditError::new(
                EditErrorCode::UnknownField,
                format!("completion_policy has no \"{other}\""),
            )
            .with_fix(POLICY_FIELDS.join(", ")));
        }
    }
    validate_policy(policy)
}

fn validate_policy(policy: &CompletionPolicy) -> Result<(), EditError> {
    let has_requirements = policy.number_of_points_treshold.is_some()
        || policy.number_of_exercises_attempted_treshold.is_some()
        || policy.requires_exam;
    if policy.policy == CompletionPolicyKind::Manual && has_requirements {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            "a manual completion policy has no thresholds; set policy to \"automatic\" first",
        ));
    }
    Ok(())
}

/// The value as a whole number from 0 to `i32::MAX`.
fn whole_number(value: &Value) -> Option<i32> {
    value
        .as_i64()
        .and_then(|n| i32::try_from(n).ok())
        .filter(|n| *n >= 0)
}

fn boolean(value: Option<&Value>, field: &str) -> Result<bool, EditError> {
    value.and_then(Value::as_bool).ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidValue,
            format!("{field} is true or false"),
        )
    })
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::*;
    use crate::engine::op::PatchTarget;
    use crate::ids::SequentialIds;
    use crate::test_fixtures::{id, p};

    fn sample() -> CourseSettings {
        CourseSettings {
            course: CourseSettingsCourse {
                id: id("c1"),
                slug: "ohpe".into(),
                language_code: "fi-FI".into(),
                name: "Ohjelmoinnin perusteet".into(),
                description: Some("…".into()),
                is_draft: false,
                is_test_mode: false,
                is_unlisted: false,
                chapter_locking_enabled: false,
                base_module_completion_requires_n_submodule_completions: 0,
                ai_policy: AiPolicy::NoAi,
                audiences: vec![Audience {
                    id: id("au1"),
                    name: "Upper secondary students".into(),
                }],
                closed_at: None,
            },
            modules: vec![
                ModuleSettings {
                    id: id("m1"),
                    name: None,
                    completion_policy: CompletionPolicy {
                        policy: CompletionPolicyKind::Automatic,
                        number_of_points_treshold: Some(60),
                        number_of_exercises_attempted_treshold: None,
                        requires_exam: false,
                    },
                    certification_enabled: true,
                },
                ModuleSettings {
                    id: id("m2"),
                    name: Some("Advanced".into()),
                    completion_policy: CompletionPolicy::manual(),
                    certification_enabled: false,
                },
            ],
        }
    }

    fn run(ops: Value) -> Result<SettingsResult, EditError> {
        let ops = crate::test_fixtures::ops(ops, PatchTarget::CourseSettings)?;
        let ids = SequentialIds::default();
        apply(&sample(), &ops, &ids)
    }

    #[test]
    fn set_course_fields() {
        let result = run(json!([
            {"op":"replace","path":"/course/name","value":"Ohjelmoinnin perusteet 2027"},
            {"op":"replace","path":"/course/description","value":null},
            {"op":"replace","path":"/course/is_unlisted","value":true},
            {"op":"replace","path":"/course/ai_policy","value":"planning-only"},
            {"op":"replace","path":"/course/base_module_completion_requires_n_submodule_completions","value":2},
        ]))
        .unwrap();
        let course = result.settings.course;
        assert_eq!(course.name, "Ohjelmoinnin perusteet 2027");
        assert_eq!(course.description, None);
        assert!(course.is_unlisted);
        assert_eq!(course.ai_policy, AiPolicy::PlanningOnly);
        assert_eq!(
            course.base_module_completion_requires_n_submodule_completions,
            2
        );
    }

    #[test]
    fn chapter_locking() {
        let result =
            run(json!([{"op":"replace","path":"/course/chapter_locking_enabled","value":true}]))
                .unwrap();
        assert!(result.settings.course.chapter_locking_enabled);
    }

    #[test]
    fn add_and_remove_audience() {
        let result = run(json!([
            {"op":"add","path":"/course/audiences","value":{"name":"Adults"}},
            {"op":"remove","path":p("au1")},
        ]))
        .unwrap();
        assert_eq!(
            result.settings.course.audiences,
            vec![Audience {
                id: SequentialIds::nth(1),
                name: "Adults".into()
            }]
        );
        assert_eq!(result.created[0].ids, vec![SequentialIds::nth(1)]);
    }

    #[test]
    fn completion_policy_whole_and_one_threshold() {
        let result = run(json!([
            {"op":"replace","path":format!("{}/completion_policy", p("m2")),"value":{"policy":"automatic","number_of_points_treshold":60,"number_of_exercises_attempted_treshold":null,"requires_exam":false}},
            {"op":"replace","path":format!("{}/completion_policy/number_of_points_treshold", p("m2")),"value":50},
        ]))
        .unwrap();
        let policy = &result.settings.modules[1].completion_policy;
        assert_eq!(policy.policy, CompletionPolicyKind::Automatic);
        assert_eq!(policy.number_of_points_treshold, Some(50));
    }

    #[test]
    fn partial_policy_defaults_and_manual_rules() {
        let result = run(json!([{"op":"replace","path":format!("{}/completion_policy", p("m1")),"value":{"policy":"automatic"}}])).unwrap();
        assert_eq!(
            result.settings.modules[0]
                .completion_policy
                .number_of_points_treshold,
            None
        );
        let error = run(json!([{"op":"replace","path":format!("{}/completion_policy/number_of_points_treshold", p("m2")),"value":5}])).unwrap_err();
        assert!(error.message.contains("automatic"));
        let manual = run(json!([{"op":"replace","path":format!("{}/completion_policy/policy", p("m1")),"value":"manual"}])).unwrap();
        assert_eq!(
            manual.settings.modules[0].completion_policy,
            CompletionPolicy::manual()
        );
    }

    #[test]
    fn certificates() {
        let result = run(json!([{"op":"replace","path":format!("{}/certification_enabled", p("m2")),"value":true}])).unwrap();
        assert!(result.settings.modules[1].certification_enabled);
    }

    #[test]
    fn publishing_switches_are_read_only() {
        for field in [
            "is_draft",
            "is_test_mode",
            "slug",
            "language_code",
            "closed_at",
        ] {
            let error =
                run(json!([{"op":"replace","path":format!("/course/{field}"),"value":true}]))
                    .unwrap_err();
            assert_eq!(error.code, EditErrorCode::ReadOnlyField, "{field}");
            assert!(error.message.contains("web UI"));
        }
    }

    #[test]
    fn misspelling_and_wrong_tool_teach() {
        let error = run(json!([{"op":"replace","path":format!("{}/completion_policy/number_of_points_threshold", p("m1")),"value":5}])).unwrap_err();
        assert!(error.fix.unwrap().contains("treshold"));
        let error = run(json!([{"op":"replace","path":format!("{}/name", p("m2")),"value":"x"}]))
            .unwrap_err();
        assert_eq!(error.code, EditErrorCode::WrongTool);
        let error = run(json!([{"op":"replace","path":"/course/ai_policy","value":"whatever"}]))
            .unwrap_err();
        assert_eq!(error.code, EditErrorCode::InvalidValue);
    }

    #[test]
    fn removing_a_threshold_clears_it_and_deeper_paths_are_rejected() {
        let result = run(json!([
            {"op":"remove","path":format!("{}/completion_policy/number_of_points_treshold", p("m1"))},
        ]))
        .unwrap();
        assert_eq!(
            result.settings.modules[0]
                .completion_policy
                .number_of_points_treshold,
            None
        );
        assert!(
            run(json!([
                {"op":"replace","path":format!("{}/completion_policy/policy/whatever", p("m1")),"value":"manual"},
            ]))
            .is_err()
        );
    }

    #[test]
    fn every_field_is_editable_or_read_only() {
        let document = serde_json::to_value(sample()).unwrap();
        let fields = |value: &Value| {
            let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
            keys.sort();
            keys
        };
        let declared = |lists: &[&[&str]]| {
            let mut keys: Vec<String> = lists.concat().into_iter().map(String::from).collect();
            keys.sort();
            keys
        };
        assert_eq!(
            fields(&document["course"]),
            declared(&[
                &EDITABLE_COURSE_FIELDS,
                &READ_ONLY_COURSE_FIELDS,
                &["audiences"]
            ])
        );
        assert_eq!(
            fields(&document["modules"][0]),
            declared(&[&EDITABLE_MODULE_FIELDS, &["id", "name"]])
        );
    }

    #[test]
    fn an_unknown_ai_policy_lists_the_policies() {
        let error = run(json!([{"op":"replace","path":"/course/ai_policy","value":"whatever"}]))
            .unwrap_err();
        assert_eq!(
            error.message,
            "ai_policy is one of not-set, no-ai, planning-only, limited, full-use, required"
        );
    }

    #[test]
    fn several_audiences_are_added_from_a_list() {
        let result = run(json!([
            {"op":"add","path":"/course/audiences","value":[{"name":"A"},{"name":"B"}]},
        ]))
        .unwrap();
        assert_eq!(result.settings.course.audiences.len(), 3);
    }
}
