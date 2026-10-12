//! Deciding whether one module's or mooc.fi target's credit-registration configuration is usable.
//!
//! Pure: the facts are gathered by
//! [`crate::course_module_suotar_configurations::get_config_facts_for_enabled_modules`] and
//! [`crate::external_credit_targets::get_config_facts_for_enabled_targets`], the course code
//! verdict comes from Suotar's `course-codes/validate`, and the result is stamped back by each
//! one's `record_config_check`.

use std::borrow::Cow;

use crate::course_module_suotar_configurations::{SuotarConfigCheck, SuotarModuleConfigFacts};
use crate::external_credit_targets::ExternalCreditTargetConfigFacts;

/// The problems the check reports, in the order they block a registration. English on purpose:
/// this is operator diagnostics stored on the row, not student-facing copy.
const NO_COURSE_CODE: &str = "No uh_course_code, so nothing can be submitted.";
const COURSE_CODE_NOT_ALLOWED: &str = "Suotar does not accept this uh_course_code:";
const NO_ECTS: &str = "No ects_credits, so there is nothing to register.";

/// What Suotar's `course-codes/validate` said about a course code.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CourseCodeVerdict {
    Allowed,
    /// Carries Suotar's own reason.
    NotAllowed {
        reason: String,
    },
}

impl CourseCodeVerdict {
    /// The verdict the last check stored for the module's current course code, for rechecking
    /// without asking Suotar again.
    pub fn stored(facts: &SuotarModuleConfigFacts) -> Option<Self> {
        Self::from_stored(
            facts.stored_course_code_allowed,
            facts.stored_course_code_rejection.as_deref(),
        )
    }

    /// [`Self::stored`] for a mooc.fi target.
    pub fn stored_for_target(facts: &ExternalCreditTargetConfigFacts) -> Option<Self> {
        Self::from_stored(
            facts.stored_course_code_allowed,
            facts.stored_course_code_rejection.as_deref(),
        )
    }

    fn from_stored(allowed: Option<bool>, rejection: Option<&str>) -> Option<Self> {
        match allowed? {
            true => Some(Self::Allowed),
            false => Some(Self::NotAllowed {
                reason: rejection.unwrap_or_default().to_string(),
            }),
        }
    }
}

/// Checks one module's configuration.
///
/// `verdict` is `None` when Suotar gave no answer for the code, which leaves `course_code_allowed`
/// `None`: never checked is not the same as checked and failed, and the Courses tab renders the two
/// differently.
pub fn check_module_config(
    facts: &SuotarModuleConfigFacts,
    verdict: Option<&CourseCodeVerdict>,
) -> SuotarConfigCheck {
    check_config(
        facts.uh_course_code.as_deref(),
        facts.ects_credits.is_some(),
        verdict,
    )
}

/// [`check_module_config`] for a mooc.fi target, whose code and credits the schema already
/// requires, so only Suotar's verdict can fail it.
pub fn check_target_config(
    facts: &ExternalCreditTargetConfigFacts,
    verdict: Option<&CourseCodeVerdict>,
) -> SuotarConfigCheck {
    check_config(Some(&facts.uh_course_code), true, verdict)
}

fn check_config(
    uh_course_code: Option<&str>,
    has_ects_credits: bool,
    verdict: Option<&CourseCodeVerdict>,
) -> SuotarConfigCheck {
    let mut problems: Vec<Cow<'static, str>> = Vec::new();

    let uh_course_code = uh_course_code
        .map(str::trim)
        .filter(|code| !code.is_empty());
    let (course_code_allowed, checked_course_code, course_code_rejection) =
        match (uh_course_code, verdict) {
            (None, _) => {
                problems.push(NO_COURSE_CODE.into());
                (Some(false), None, None)
            }
            (Some(code), Some(CourseCodeVerdict::Allowed)) => {
                (Some(true), Some(code.to_string()), None)
            }
            (Some(code), Some(CourseCodeVerdict::NotAllowed { reason })) => {
                problems.push(format!("{COURSE_CODE_NOT_ALLOWED} {reason}").into());
                (Some(false), Some(code.to_string()), Some(reason.clone()))
            }
            (Some(_), None) => (None, None, None),
        };
    if !has_ects_credits {
        problems.push(NO_ECTS.into());
    }

    SuotarConfigCheck {
        course_code_allowed,
        checked_course_code,
        course_code_rejection,
        message: (!problems.is_empty()).then(|| problems.join(" ")),
    }
}
