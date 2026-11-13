//! `patch_course_settings`: course and module settings. Publishing switches stay read-only.

use headless_lms_models::course_modules::{
    CompletionMethod, CreditRegistrationRoute, ExamRequirement,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use super::error::{EditError, EditErrorCode};
use super::op::Op;
use super::path::{is_course_root, parse_uuid, split_path};
use super::{CreatedIdLog, CreatedIds, new_item_objects, non_empty_string};
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

/// A target audience of the course.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Audience {
    pub id: Uuid,
    pub name: String,
}

/// One module's settings. Its fields are `id`, `name` and [`EDITABLE_MODULE_FIELDS`]. How the
/// fields must fit together is checked against the whole course when the call ends, with the same
/// rules as the teacher's module editor.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ModuleSettings {
    pub id: Uuid,
    /// Shown for orientation; renamed with the structure tool.
    pub name: Option<String>,
    pub exam_requirement: ExamRequirement,
    /// Where the exam is held when `exam_requirement` is `elsewhere`.
    pub exam_location_description: Option<String>,
    pub completion_method: CompletionMethod,
    /// Exact counts; only `by_requirements` and `by_exam` have them.
    pub points_threshold: Option<i32>,
    pub exercises_attempted_threshold: Option<i32>,
    pub credit_registration_route: CreditRegistrationRoute,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    /// The link students register their completion with.
    pub registration_link: Option<String>,
    pub certification_enabled: bool,
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
pub(crate) const EDITABLE_MODULE_FIELDS: [&str; 10] = [
    "exam_requirement",
    "exam_location_description",
    "completion_method",
    "points_threshold",
    "exercises_attempted_threshold",
    "credit_registration_route",
    "uh_course_code",
    "ects_credits",
    "registration_link",
    "certification_enabled",
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
            "paths look like /course/name or /<module id>/completion_method",
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
        return Err(unknown_course_field(&rest.join("/")));
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
            let names = ai_policy_names();
            let names: Vec<&str> = names.iter().map(String::as_str).collect();
            course.ai_policy = enum_value(value, field, &names)?
        }
        _ => return Err(unknown_course_field(field)),
    }
    Ok(())
}

/// `path` names no course setting agents can edit.
fn unknown_course_field(path: &str) -> EditError {
    EditError::new(
        EditErrorCode::UnknownField,
        format!("the course has no editable setting \"{path}\""),
    )
    .with_fix(format!(
        "editable: {}, audiences",
        EDITABLE_COURSE_FIELDS.join(", ")
    ))
}

fn module_op(module: &mut ModuleSettings, op: &Op, rest: &[String]) -> Result<(), EditError> {
    let [field] = rest else {
        return Err(unknown_module_field(&rest.join("/")));
    };
    let field = field.as_str();
    if field == "name" {
        return Err(EditError::new(
            EditErrorCode::WrongTool,
            "module names are edited with patch_course_structure",
        ));
    }
    if !EDITABLE_MODULE_FIELDS.contains(&field) {
        return Err(unknown_module_field(field));
    }
    let value = match op {
        Op::Replace { value, .. } => value,
        Op::Remove { .. } => &Value::Null,
        _ => {
            return Err(EditError::new(
                EditErrorCode::InvalidOp,
                "module settings are set with replace; remove sets a nullable one to null",
            ));
        }
    };
    match field {
        "exam_requirement" => {
            module.exam_requirement = enum_value(value, field, &EXAM_REQUIREMENTS)?
        }
        "exam_location_description" => module.exam_location_description = text(value, field)?,
        "completion_method" => {
            module.completion_method = enum_value(value, field, &COMPLETION_METHODS)?;
            if !has_thresholds(module.completion_method) {
                module.points_threshold = None;
                module.exercises_attempted_threshold = None;
            }
        }
        "points_threshold" | "exercises_attempted_threshold" => {
            let threshold = match value {
                Value::Null => None,
                value => Some(whole_number(value).ok_or_else(|| {
                    EditError::new(
                        EditErrorCode::InvalidValue,
                        format!("{field} is a whole number, 0 or more, or null"),
                    )
                })?),
            };
            if threshold.is_some() && !has_thresholds(module.completion_method) {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "only by_requirements and by_exam have thresholds; set completion_method first",
                ));
            }
            if field == "points_threshold" {
                module.points_threshold = threshold;
            } else {
                module.exercises_attempted_threshold = threshold;
            }
        }
        "credit_registration_route" => {
            module.credit_registration_route =
                enum_value(value, field, &CREDIT_REGISTRATION_ROUTES)?
        }
        "uh_course_code" => module.uh_course_code = text(value, field)?,
        "ects_credits" => {
            module.ects_credits = match value {
                Value::Null => None,
                value => Some(
                    value
                        .as_f64()
                        .filter(|credits| *credits > 0.0 && *credits <= f64::from(f32::MAX))
                        .ok_or_else(|| {
                            EditError::new(
                                EditErrorCode::InvalidValue,
                                "ects_credits is a positive number or null",
                            )
                        })? as f32,
                ),
            }
        }
        "registration_link" => module.registration_link = text(value, field)?,
        "certification_enabled" => module.certification_enabled = boolean(Some(value), field)?,
        _ => return Err(unknown_module_field(field)),
    }
    Ok(())
}

/// `path` names no module setting.
fn unknown_module_field(path: &str) -> EditError {
    EditError::new(
        EditErrorCode::UnknownField,
        format!("a module has no setting \"{path}\""),
    )
    .with_fix(format!("settings: {}", EDITABLE_MODULE_FIELDS.join(", ")))
}

/// Whether the method uses the points and exercises-attempted thresholds.
fn has_thresholds(method: CompletionMethod) -> bool {
    matches!(
        method,
        CompletionMethod::ByRequirements | CompletionMethod::ByExam
    )
}

/// A string setting; a blank string is stored as null.
fn text(value: &Value, field: &str) -> Result<Option<String>, EditError> {
    match value {
        Value::Null => Ok(None),
        Value::String(s) if s.trim().is_empty() => Ok(None),
        Value::String(s) => Ok(Some(s.trim().to_string())),
        _ => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{field} is a string or null"),
        )),
    }
}

/// One of `names`, the serialized names of `T`'s variants.
fn enum_value<T: for<'de> Deserialize<'de>>(
    value: &Value,
    field: &str,
    names: &[&str],
) -> Result<T, EditError> {
    serde_json::from_value(value.clone()).map_err(|_| {
        EditError::new(
            EditErrorCode::InvalidValue,
            format!("{field} is one of {}", names.join(", ")),
        )
    })
}

/// The names [`AiPolicy`] serializes to.
fn ai_policy_names() -> Vec<String> {
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

const EXAM_REQUIREMENTS: [&str; 4] = ["none", "platform", "examinarium", "elsewhere"];
const COMPLETION_METHODS: [&str; 4] = ["not_decided", "by_requirements", "by_exam", "teacher_adds"];
const CREDIT_REGISTRATION_ROUTES: [&str; 3] = ["platform", "external", "certificate_only"];

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
                    exam_requirement: ExamRequirement::None,
                    exam_location_description: None,
                    completion_method: CompletionMethod::ByRequirements,
                    points_threshold: Some(60),
                    exercises_attempted_threshold: None,
                    credit_registration_route: CreditRegistrationRoute::Platform,
                    uh_course_code: Some("TKT-101".into()),
                    ects_credits: Some(5.0),
                    registration_link: Some("https://example.com/register".into()),
                    certification_enabled: true,
                },
                ModuleSettings {
                    id: id("m2"),
                    name: Some("Advanced".into()),
                    exam_requirement: ExamRequirement::None,
                    exam_location_description: None,
                    completion_method: CompletionMethod::TeacherAdds,
                    points_threshold: None,
                    exercises_attempted_threshold: None,
                    credit_registration_route: CreditRegistrationRoute::Platform,
                    uh_course_code: None,
                    ects_credits: None,
                    registration_link: None,
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
    fn completion_method_and_thresholds() {
        let result = run(json!([
            {"op":"replace","path":format!("{}/completion_method", p("m2")),"value":"by_exam"},
            {"op":"replace","path":format!("{}/points_threshold", p("m2")),"value":50},
            {"op":"replace","path":format!("{}/exam_requirement", p("m2")),"value":"platform"},
        ]))
        .unwrap();
        let module = &result.settings.modules[1];
        assert_eq!(module.completion_method, CompletionMethod::ByExam);
        assert_eq!(module.points_threshold, Some(50));
        assert_eq!(module.exam_requirement, ExamRequirement::Platform);
    }

    #[test]
    fn thresholds_belong_to_methods_that_have_them() {
        let error =
            run(json!([{"op":"replace","path":format!("{}/points_threshold", p("m2")),"value":5}]))
                .unwrap_err();
        assert!(error.message.contains("completion_method"));
        let result = run(json!([{"op":"replace","path":format!("{}/completion_method", p("m1")),"value":"teacher_adds"}])).unwrap();
        assert_eq!(result.settings.modules[0].points_threshold, None);
    }

    #[test]
    fn unknown_names_list_the_choices() {
        let error = run(json!([{"op":"replace","path":format!("{}/credit_registration_route", p("m1")),"value":"sisu"}])).unwrap_err();
        assert_eq!(
            error.message,
            "credit_registration_route is one of platform, external, certificate_only"
        );
    }

    #[test]
    fn credit_fields() {
        let result = run(json!([
            {"op":"replace","path":format!("{}/uh_course_code", p("m2")),"value":" TKT-202 "},
            {"op":"replace","path":format!("{}/ects_credits", p("m2")),"value":2.5},
            {"op":"remove","path":format!("{}/registration_link", p("m1"))},
        ]))
        .unwrap();
        assert_eq!(
            result.settings.modules[1].uh_course_code.as_deref(),
            Some("TKT-202")
        );
        assert_eq!(result.settings.modules[1].ects_credits, Some(2.5));
        assert_eq!(result.settings.modules[0].registration_link, None);
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
    fn unknown_fields_and_wrong_tool_teach() {
        let error = run(
            json!([{"op":"replace","path":format!("{}/completion_policy", p("m1")),"value":{}}]),
        )
        .unwrap_err();
        assert!(error.fix.unwrap().contains("completion_method"));
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
            {"op":"remove","path":format!("{}/points_threshold", p("m1"))},
        ]))
        .unwrap();
        assert_eq!(result.settings.modules[0].points_threshold, None);
        assert!(
            run(json!([
                {"op":"replace","path":format!("{}/completion_method/whatever", p("m1")),"value":"by_exam"},
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
