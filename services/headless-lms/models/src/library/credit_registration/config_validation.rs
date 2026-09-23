//! Deciding whether one module's credit-registration configuration is usable.
//!
//! Pure: the facts are gathered by
//! [`crate::course_module_suotar_configurations::get_config_facts_for_enabled_modules`] and the
//! verdict is stamped back by
//! [`crate::course_module_suotar_configurations::record_config_check`].

use crate::course_module_suotar_configurations::{SuotarConfigCheck, SuotarModuleConfigFacts};

use super::grade_mapping::{GradeScaleFamily, grade_scale_family};

/// The problems the check reports, in the order they block a registration. English on purpose:
/// this is operator diagnostics stored on the row, not student-facing copy.
const NO_COURSE_CODE: &str = "No uh_course_code, so nothing can be submitted.";
const COURSE_CODE_NOT_FOUND: &str = "The study registry does not know this uh_course_code.";
const NO_ECTS: &str = "No ects_credits, so there is nothing to register.";
const UNKNOWN_GRADE_SCALE: &str =
    "The grade scale override is not a scale the study registry accepts.";
const NUMERIC_SCALE_ON_UNGRADED_COMPLETIONS: &str =
    "The grade scale override is numeric but the module has passed completions with no grade.";
const OLD_FLOW_ALSO_ENABLED: &str = "enable_registering_completion_to_uh_open_university is on as well, which would register the same completion twice.";

/// Checks one module's configuration.
///
/// `course_code_resolves` is left `None` while no listing has been attempted: never checked is not
/// the same as checked and failed, and the Courses tab renders the two differently.
pub fn check_module_config(facts: &SuotarModuleConfigFacts) -> SuotarConfigCheck {
    let mut problems: Vec<&str> = Vec::new();

    let has_course_code = facts
        .uh_course_code
        .as_deref()
        .is_some_and(|code| !code.trim().is_empty());
    let course_code_resolves = if !has_course_code {
        problems.push(NO_COURSE_CODE);
        Some(false)
    } else if facts.course_code_not_found {
        problems.push(COURSE_CODE_NOT_FOUND);
        Some(false)
    } else if facts.listed_successfully {
        Some(true)
    } else {
        None
    };
    if facts.ects_credits.is_none() {
        problems.push(NO_ECTS);
    }

    match facts.grade_scale_id.as_deref().map(grade_scale_family) {
        Some(None) => problems.push(UNKNOWN_GRADE_SCALE),
        Some(Some(GradeScaleFamily::Numeric)) if facts.has_passed_completions_without_a_grade => {
            problems.push(NUMERIC_SCALE_ON_UNGRADED_COMPLETIONS)
        }
        _ => {}
    }
    if facts.old_flow_also_enabled {
        problems.push(OLD_FLOW_ALSO_ENABLED);
    }

    SuotarConfigCheck {
        course_code_resolves,
        message: (!problems.is_empty()).then(|| problems.join(" ")),
    }
}
