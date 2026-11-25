//! The `config-validation` phase: the daily pass over the configuration of every module with a
//! course code and every code of an enabled mooc.fi target.
//!
//! Asks Suotar's `course-codes/validate` about every distinct course code, and mooc.fi about each
//! target's course; the rest of the check reads the database.

use headless_lms_base::config::MoocfiDelegationConfiguration;
use headless_lms_models::course_module_suotar_configurations::{
    SuotarConfigCheck, SuotarModuleConfigFacts, get_config_facts_for_modules_with_course_code,
    record_config_check,
};
use headless_lms_models::external_credit_target_codes::{
    self, ExternalCreditTargetCodeConfigFacts, get_config_facts_for_enabled_targets,
};
use headless_lms_models::external_credit_targets;
use headless_lms_models::library::credit_registration::config_validation::{
    CourseCodeVerdict, check_module_config, check_target_code_config,
};
use headless_lms_utils::services::moocfi::{MoocfiClient, MoocfiError};
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
    moocfi_delegation: Option<&MoocfiDelegationConfiguration>,
) -> CreditRegistrationResult<Counts> {
    if scope.course_id.is_none()
        && let Some(delegation) = moocfi_delegation
    {
        refresh_moocfi_course_details(pool, scope, delegation).await?;
    }
    // A course scope has no targets in it, and a target scope no modules.
    let (modules, target_codes) = {
        let mut conn = pool.acquire().await?;
        let modules = match scope.external_credit_target_id {
            None => {
                get_config_facts_for_modules_with_course_code(&mut conn, scope.course_id).await?
            }
            Some(_) => Vec::new(),
        };
        let target_codes = match scope.course_id {
            None => {
                get_config_facts_for_enabled_targets(&mut conn, scope.external_credit_target_id)
                    .await?
            }
            Some(_) => Vec::new(),
        };
        (modules, target_codes)
    };
    let course_codes = distinct_course_codes(
        modules
            .iter()
            .map(|module| module.uh_course_code.as_deref())
            .chain(
                target_codes
                    .iter()
                    .map(|code| Some(code.uh_course_code.as_str())),
            ),
    );

    // After a refusal nothing is recorded, so the previous verdicts stand until a check gets through.
    let Ok(verdicts) = registry.validate_course_codes(&course_codes).await else {
        return Ok(Counts::default());
    };

    let checks = check_modules(&modules, &verdicts);
    record_checks(pool, &modules, &checks).await?;
    let target_checks = check_target_codes(&target_codes, &verdicts);
    record_target_code_checks(pool, &target_codes, &target_checks).await?;

    let with_problems = checks
        .iter()
        .chain(&target_checks)
        .filter(|check| check.message.is_some())
        .count();
    if with_problems > 0 {
        warn!(
            units_with_problems = with_problems,
            "Credit registration modules or mooc.fi targets have configuration problems"
        );
    }
    let modules_checked = modules.len();
    let target_codes_checked = target_codes.len();
    let codes_checked = verdicts.len();
    if modules_checked + target_codes_checked > 0 {
        info!(
            modules_checked,
            target_codes_checked,
            codes_checked,
            with_problems,
            "checked {modules_checked} modules, {target_codes_checked} mooc.fi codes, {codes_checked} course codes"
        );
    }

    // A misconfigured unit is a finding, not a failed item: the phase did its job.
    Ok(Counts::processed(
        i64::try_from(modules_checked + target_codes_checked).unwrap_or(i64::MAX),
    ))
}

/// Stores what mooc.fi says about each target's course. Best effort: a course mooc.fi does not
/// answer about keeps its last known details.
async fn refresh_moocfi_course_details(
    pool: &PgPool,
    scope: &RegistrationScope,
    delegation: &MoocfiDelegationConfiguration,
) -> CreditRegistrationResult<()> {
    let moocfi_course_ids = {
        let mut conn = pool.acquire().await?;
        external_credit_targets::get_moocfi_course_ids_of_enabled_targets(
            &mut conn,
            scope.external_credit_target_id,
        )
        .await?
    };
    let client = MoocfiClient::new(delegation);
    for moocfi_course_id in moocfi_course_ids {
        match client.get_delegated_course(moocfi_course_id).await {
            Ok(Some(course)) => {
                let mut conn = pool.acquire().await?;
                external_credit_targets::record_moocfi_course_details(
                    &mut conn,
                    moocfi_course_id,
                    course.has_certificate,
                )
                .await?;
            }
            Ok(None) => warn!(
                %moocfi_course_id,
                "mooc.fi has no delegated handler course for a credit registration target"
            ),
            // The remaining courses would only wait out the same timeout.
            Err(error @ MoocfiError::Unreachable(_)) => {
                warn!(%error, "Could not reach mooc.fi to read the credit registration targets' courses");
                break;
            }
            Err(error) => warn!(
                %moocfi_course_id,
                %error,
                "Could not read a credit registration target's course from mooc.fi"
            ),
        }
    }
    Ok(())
}

/// The course codes as the registry is asked about them: trimmed, sorted, each once.
fn distinct_course_codes<'a>(codes: impl IntoIterator<Item = Option<&'a str>>) -> Vec<CourseCode> {
    codes
        .into_iter()
        .flatten()
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

/// Each mooc.fi code's check, in order, with the same fallback to the stored verdict as modules.
fn check_target_codes(
    codes: &[ExternalCreditTargetCodeConfigFacts],
    verdicts: &CourseCodeVerdicts,
) -> Vec<SuotarConfigCheck> {
    codes
        .iter()
        .map(|code| {
            let verdict = CourseCode::parse(&code.uh_course_code)
                .and_then(|course_code| verdicts.get(&course_code).cloned())
                .or_else(|| CourseCodeVerdict::stored_for_target_code(code));
            check_target_code_config(code, verdict.as_ref())
        })
        .collect()
}

/// Writes each mooc.fi code's check, in the order of `codes`.
async fn record_target_code_checks(
    pool: &PgPool,
    codes: &[ExternalCreditTargetCodeConfigFacts],
    checks: &[SuotarConfigCheck],
) -> CreditRegistrationResult<()> {
    let mut conn = pool.acquire().await?;
    for (code, check) in codes.iter().zip(checks) {
        external_credit_target_codes::record_config_check(
            &mut conn,
            code.external_credit_target_code_id,
            check,
        )
        .await?;
    }
    Ok(())
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
        let codes: Vec<_> = distinct_course_codes(
            modules
                .iter()
                .map(|module| module.uh_course_code.as_deref()),
        )
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
}
