//! `patch_course_settings`: course and module settings. Publishing switches stay read-only.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

use super::error::{EditError, EditErrorCode, Warning};
use super::labels::parse_uuid;
use super::op::{OpKind, PatchOp, PatchTarget, parse_ops};
use super::page_content::unescape_pointer;
use super::{CreatedIds, EngineContext, push_created};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct CourseSettings {
    pub course: CourseSettingsCourse,
    pub modules: Vec<ModuleSettings>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Audience {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct ModuleSettings {
    pub id: Uuid,
    /// Shown for orientation; renamed with the structure tool.
    pub name: Option<String>,
    pub completion_policy: CompletionPolicy,
    pub certification_enabled: bool,
}

/// Module completion. The `treshold` spelling matches the stored field names.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct CompletionPolicy {
    pub policy: CompletionPolicyKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub number_of_points_treshold: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub number_of_exercises_attempted_treshold: Option<i32>,
    #[serde(default)]
    pub requires_exam: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum CompletionPolicyKind {
    Automatic,
    Manual,
}

impl CompletionPolicy {
    pub fn manual() -> Self {
        Self {
            policy: CompletionPolicyKind::Manual,
            number_of_points_treshold: None,
            number_of_exercises_attempted_treshold: None,
            requires_exam: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SettingsResult {
    pub settings: CourseSettings,
    pub created: Vec<CreatedIds>,
    pub warnings: Vec<Warning>,
}

pub fn parse(raw: &[Value]) -> Result<Vec<PatchOp>, EditError> {
    parse_ops(raw, PatchTarget::CourseSettings)
}

const EDITABLE_COURSE_FIELDS: [&str; 6] = [
    "name",
    "description",
    "is_unlisted",
    "chapter_locking_enabled",
    "base_module_completion_requires_n_submodule_completions",
    "ai_policy",
];
const READ_ONLY_COURSE_FIELDS: [&str; 8] = [
    "id",
    "slug",
    "language_code",
    "is_draft",
    "is_test_mode",
    "closed_at",
    "closed_additional_message",
    "closed_course_successor_id",
];
const POLICY_FIELDS: [&str; 4] = [
    "policy",
    "number_of_points_treshold",
    "number_of_exercises_attempted_treshold",
    "requires_exam",
];

pub fn apply(
    doc: &CourseSettings,
    ops: &[PatchOp],
    ctx: &EngineContext,
) -> Result<SettingsResult, EditError> {
    let mut settings = doc.clone();
    let mut created = Vec::new();
    for (index, op) in ops.iter().enumerate() {
        apply_op(&mut settings, op, ctx, index, &mut created).map_err(|e| e.at_op(index))?;
    }
    Ok(SettingsResult {
        settings,
        created,
        warnings: Vec::new(),
    })
}

fn apply_op(
    settings: &mut CourseSettings,
    op: &PatchOp,
    ctx: &EngineContext,
    index: usize,
    created: &mut Vec<CreatedIds>,
) -> Result<(), EditError> {
    let segments: Vec<String> = op
        .path
        .strip_prefix('/')
        .ok_or_else(|| {
            EditError::new(
                EditErrorCode::InvalidPath,
                "paths look like /course/name or /<module id>/completion_policy",
            )
        })?
        .split('/')
        .map(unescape_pointer)
        .collect();
    let is_course = segments[0] == "course"
        || Uuid::parse_str(&segments[0]).is_ok_and(|id| id == settings.course.id);
    if is_course {
        return course_op(settings, op, &segments[1..], ctx, index, created);
    }
    let id = parse_uuid(&segments[0], &op.path)?;
    if let Some(position) = settings.course.audiences.iter().position(|a| a.id == id) {
        return match (op.op, segments.get(1).map(String::as_str)) {
            (OpKind::Remove, None) => {
                settings.course.audiences.remove(position);
                Ok(())
            }
            (OpKind::Replace, Some("name")) => {
                settings.course.audiences[position].name =
                    non_empty_string(op.value.as_ref(), "an audience name")?;
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
    settings: &mut CourseSettings,
    op: &PatchOp,
    rest: &[String],
    ctx: &EngineContext,
    index: usize,
    created: &mut Vec<CreatedIds>,
) -> Result<(), EditError> {
    let course = &mut settings.course;
    let Some(field) = rest.first().map(String::as_str) else {
        return Err(EditError::new(
            EditErrorCode::InvalidPath,
            "name a course field, e.g. /course/name",
        ));
    };
    if field == "audiences" {
        return match op.op {
            OpKind::Add if rest.len() == 1 => {
                let object = op
                    .value
                    .as_ref()
                    .and_then(Value::as_object)
                    .ok_or_else(|| {
                        EditError::new(
                            EditErrorCode::InvalidValue,
                            "a new audience is {\"name\":\"…\"}",
                        )
                    })?;
                if let Some(key) = object.keys().find(|k| k.as_str() != "name") {
                    return Err(EditError::new(
                        EditErrorCode::UnknownField,
                        format!("an audience has no \"{key}\""),
                    ));
                }
                let audience_id = ctx.ids.new_id();
                push_created(created, index, audience_id);
                course.audiences.push(Audience {
                    id: audience_id,
                    name: non_empty_string(object.get("name"), "an audience name")?,
                });
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
    if op.op == OpKind::Add {
        return Err(EditError::new(
            EditErrorCode::InvalidOp,
            "course fields are set with replace",
        ));
    }
    let value = if op.op == OpKind::Remove {
        Some(&Value::Null)
    } else {
        op.value.as_ref()
    };
    match field {
        "name" => course.name = non_empty_string(value, "the course name")?,
        "description" => {
            course.description = match value {
                Some(Value::Null) | None => None,
                Some(Value::String(s)) => Some(s.clone()),
                Some(_) => return Err(EditError::new(EditErrorCode::InvalidValue, "description is a string or null")),
            }
        }
        "is_unlisted" => course.is_unlisted = boolean(value, field)?,
        "chapter_locking_enabled" => course.chapter_locking_enabled = boolean(value, field)?,
        "base_module_completion_requires_n_submodule_completions" => {
            course.base_module_completion_requires_n_submodule_completions = match value.and_then(Value::as_i64) {
                Some(n) if (0..=i64::from(i32::MAX)).contains(&n) => n as i32,
                _ => return Err(EditError::new(EditErrorCode::InvalidValue, format!("{field} is a whole number, 0 or more"))),
            }
        }
        "ai_policy" => {
            course.ai_policy = value
                .cloned()
                .and_then(|v| serde_json::from_value(v).ok())
                .ok_or_else(|| {
                    EditError::new(EditErrorCode::InvalidValue, "ai_policy is one of not-set, no-ai, planning-only, limited, full-use, required")
                })?
        }
        _ => unreachable!("checked against EDITABLE_COURSE_FIELDS"),
    }
    Ok(())
}

fn module_op(module: &mut ModuleSettings, op: &PatchOp, rest: &[String]) -> Result<(), EditError> {
    let field = rest.first().map(String::as_str);
    match field {
        Some("name") => Err(EditError::new(
            EditErrorCode::WrongTool,
            "module names are edited with patch_course_structure",
        )),
        Some("certification_enabled") if rest.len() == 1 && op.op == OpKind::Replace => {
            module.certification_enabled = boolean(op.value.as_ref(), "certification_enabled")?;
            Ok(())
        }
        Some("completion_policy") if op.op == OpKind::Replace => match rest.get(1) {
            None => {
                module.completion_policy = parse_policy(op.value.as_ref())?;
                Ok(())
            }
            Some(sub) => set_policy_field(&mut module.completion_policy, sub, op.value.as_ref()),
        },
        Some(f) if f.contains("threshold") || rest.iter().any(|s| s.contains("threshold")) => {
            Err(EditError::new(
                EditErrorCode::UnknownField,
                "the field names are spelled \"treshold\"",
            )
            .with_fix(format!(
                "/{}/completion_policy/{}",
                module.id,
                rest.last()
                    .map(|s| s.replace("threshold", "treshold"))
                    .unwrap_or_default()
            )))
        }
        _ => Err(EditError::new(
            EditErrorCode::InvalidPath,
            "module settings are completion_policy (or one of its fields) and certification_enabled, set with replace",
        )),
    }
}

fn parse_policy(value: Option<&Value>) -> Result<CompletionPolicy, EditError> {
    let object: &Map<String, Value> = value.and_then(Value::as_object).ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidValue,
            "completion_policy is an object such as {\"policy\":\"manual\"}",
        )
    })?;
    if let Some(unknown) = object.keys().find(|k| !POLICY_FIELDS.contains(&k.as_str())) {
        let fix = if unknown.contains("threshold") {
            unknown.replace("threshold", "treshold")
        } else {
            POLICY_FIELDS.join(", ")
        };
        return Err(EditError::new(
            EditErrorCode::UnknownField,
            format!("completion_policy has no \"{unknown}\""),
        )
        .with_fix(fix));
    }
    let mut policy = CompletionPolicy::manual();
    policy.policy = match object.get("policy").and_then(Value::as_str) {
        Some("automatic") => CompletionPolicyKind::Automatic,
        Some("manual") => CompletionPolicyKind::Manual,
        _ => {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                "policy is \"automatic\" or \"manual\"",
            ));
        }
    };
    for field in &POLICY_FIELDS[1..] {
        if let Some(value) = object.get(*field) {
            set_policy_field(&mut policy, field, Some(value))?;
        }
    }
    validate_policy(&policy)?;
    Ok(policy)
}

fn set_policy_field(
    policy: &mut CompletionPolicy,
    field: &str,
    value: Option<&Value>,
) -> Result<(), EditError> {
    let threshold = |value: Option<&Value>| -> Result<Option<i32>, EditError> {
        match value {
            None | Some(Value::Null) => Ok(None),
            Some(v) => match v.as_i64() {
                Some(n) if (0..=i64::from(i32::MAX)).contains(&n) => Ok(Some(n as i32)),
                _ => Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    format!("{field} is a whole number, 0 or more, or null"),
                )),
            },
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

fn boolean(value: Option<&Value>, field: &str) -> Result<bool, EditError> {
    value.and_then(Value::as_bool).ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidValue,
            format!("{field} is true or false"),
        )
    })
}

fn non_empty_string(value: Option<&Value>, what: &str) -> Result<String, EditError> {
    match value {
        Some(Value::String(s)) if !s.trim().is_empty() => Ok(s.clone()),
        _ => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{what} is a non-empty string"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::*;
    use crate::ids::SequentialIds;
    use crate::test_fixtures::{id, p};

    pub(crate) fn sample() -> CourseSettings {
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
        let raw = ops.as_array().cloned().unwrap_or_default();
        let ops = parse(&raw)?;
        let ids = SequentialIds::new();
        apply(&sample(), &ops, &EngineContext::new(&ids))
    }

    #[test]
    fn row1_set_course_fields() {
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
    fn row2_chapter_locking() {
        let result =
            run(json!([{"op":"replace","path":"/course/chapter_locking_enabled","value":true}]))
                .unwrap();
        assert!(result.settings.course.chapter_locking_enabled);
    }

    #[test]
    fn row3_add_and_remove_audience() {
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
    fn row4_completion_policy_whole_and_one_threshold() {
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
    fn row4_partial_policy_defaults_and_manual_rules() {
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
    fn row5_certificates() {
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
}
