//! The `config-validation` phase: the daily pass over every Suotar-enabled module's configuration.
//!
//! Asks Suotar's `course-codes/validate` about every distinct course code; the rest of the check
//! reads the database.

use headless_lms_data_operations::library::credit_registration::config_validation::{
    CourseCodeVerdict, check_module_config,
};
use headless_lms_models::course_module_suotar_configurations::{
    SuotarConfigCheck, SuotarModuleConfigFacts, get_config_facts_for_enabled_modules,
    record_config_check,
};
use itertools::Itertools;
use sqlx::PgPool;

use crate::error::CreditRegistrationResult;
use crate::registry::{CourseCode, CourseCodeVerdicts, StudyRegistry};
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

pub(crate) async fn run<R: StudyRegistry>(
    pool: &PgPool,
    scope: &RegistrationScope,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    let modules = {
        let mut conn = pool.acquire().await?;
        get_config_facts_for_enabled_modules(&mut conn, scope.course_id).await?
    };
    let course_codes = distinct_course_codes(&modules);

    // After a refusal nothing is recorded, so the previous verdicts stand until a check gets through.
    let Ok(verdicts) = registry.validate_course_codes(&course_codes).await else {
        return Ok(Counts::default());
    };

    let checks = check_modules(&modules, &verdicts);
    record_checks(pool, &modules, &checks).await?;

    let with_problems = checks
        .iter()
        .filter(|check| check.message.is_some())
        .count();
    if with_problems > 0 {
        warn!(
            modules_with_problems = with_problems,
            "Suotar-enabled course modules have configuration problems"
        );
    }
    let modules_checked = modules.len();
    let codes_checked = verdicts.len();
    if modules_checked > 0 {
        info!(
            modules_checked,
            codes_checked,
            with_problems,
            "checked {modules_checked} modules, {codes_checked} course codes"
        );
    }

    // A misconfigured module is a finding, not a failed item: the phase did its job.
    Ok(Counts::processed(
        i64::try_from(modules.len()).unwrap_or(i64::MAX),
    ))
}

/// The modules' course codes as the registry is asked about them: trimmed, sorted, each once.
fn distinct_course_codes(modules: &[SuotarModuleConfigFacts]) -> Vec<CourseCode> {
    modules
        .iter()
        .filter_map(|module| module.uh_course_code.as_deref())
        .filter_map(CourseCode::parse)
        .sorted()
        .dedup()
        .collect()
}

/// Each module's check, in module order.
fn check_modules(
    modules: &[SuotarModuleConfigFacts],
    verdicts: &CourseCodeVerdicts,
) -> Vec<SuotarConfigCheck> {
    modules
        .iter()
        .map(|module| {
            // A code Suotar gave no verdict for, or left unchecked, keeps its stored one: clearing
            // it would read as allowed and release a blocked module's rows.
            let verdict = module
                .uh_course_code
                .as_deref()
                .and_then(CourseCode::parse)
                .and_then(|code| verdicts.get(&code).cloned())
                .or_else(|| CourseCodeVerdict::stored(module));
            check_module_config(module, verdict.as_ref())
        })
        .collect()
}

/// Writes each module's check, in module order.
async fn record_checks(
    pool: &PgPool,
    modules: &[SuotarModuleConfigFacts],
    checks: &[SuotarConfigCheck],
) -> CreditRegistrationResult<()> {
    let mut conn = pool.acquire().await?;
    for (module, check) in modules.iter().zip(checks) {
        record_config_check(&mut conn, module.course_module_id, check).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;

    fn module(
        code: Option<&str>,
        stored_course_code_allowed: Option<bool>,
    ) -> SuotarModuleConfigFacts {
        SuotarModuleConfigFacts {
            course_module_id: Uuid::new_v4(),
            course_id: Uuid::new_v4(),
            uh_course_code: code.map(str::to_string),
            ects_credits: Some(5.0),
            stored_course_code_allowed,
            stored_course_code_rejection: stored_course_code_allowed
                .filter(|allowed| !allowed)
                .map(|_| "stored reason".to_string()),
        }
    }

    fn verdicts(entries: &[(&str, CourseCodeVerdict)]) -> CourseCodeVerdicts {
        entries
            .iter()
            .map(|(code, verdict)| (CourseCode::parse(code).unwrap(), verdict.clone()))
            .collect()
    }

    #[test]
    fn the_registry_is_asked_about_each_trimmed_code_once_in_order() {
        let modules = [
            module(Some(" TKT2 "), None),
            module(Some("TKT1"), None),
            module(Some("TKT2"), None),
            module(Some("   "), None),
            module(None, None),
        ];
        let codes: Vec<_> = distinct_course_codes(&modules)
            .iter()
            .map(|code| code.as_str().to_string())
            .collect();
        assert_eq!(codes, ["TKT1", "TKT2"]);
    }

    #[test]
    fn each_module_takes_the_verdict_for_its_trimmed_code() {
        let modules = [
            module(Some(" TKT1 "), Some(true)),
            module(Some("TKT2"), None),
        ];
        let verdicts = verdicts(&[
            (
                "TKT1",
                CourseCodeVerdict::NotAllowed {
                    reason: "closed".to_string(),
                },
            ),
            ("TKT2", CourseCodeVerdict::Allowed),
        ]);
        let checks = check_modules(&modules, &verdicts);
        assert_eq!(checks[0].course_code_allowed, Some(false));
        assert_eq!(checks[0].course_code_rejection.as_deref(), Some("closed"));
        assert!(checks[0].message.is_some());
        assert_eq!(checks[1].course_code_allowed, Some(true));
        assert_eq!(checks[1].checked_course_code.as_deref(), Some("TKT2"));
        assert_eq!(checks[1].message, None);
    }

    #[test]
    fn a_code_left_without_a_verdict_keeps_its_stored_one() {
        let modules = [
            module(Some("TKT1"), Some(false)),
            module(Some("TKT2"), Some(true)),
        ];
        let checks = check_modules(&modules, &verdicts(&[]));
        assert_eq!(checks[0].course_code_allowed, Some(false));
        assert_eq!(
            checks[0].course_code_rejection.as_deref(),
            Some("stored reason")
        );
        assert_eq!(checks[1].course_code_allowed, Some(true));
    }

    #[test]
    fn a_code_never_checked_stays_unknown_rather_than_allowed() {
        let checks = check_modules(&[module(Some("TKT1"), None)], &verdicts(&[]));
        assert_eq!(checks[0].course_code_allowed, None);
        assert_eq!(checks[0].checked_course_code, None);
    }

    #[test]
    fn a_module_without_a_code_is_a_problem_whatever_the_registry_says() {
        let checks = check_modules(
            &[module(None, Some(true))],
            &verdicts(&[("TKT1", CourseCodeVerdict::Allowed)]),
        );
        assert_eq!(checks[0].course_code_allowed, Some(false));
        assert!(checks[0].message.is_some());
    }
}
