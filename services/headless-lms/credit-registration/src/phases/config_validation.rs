//! The `config-validation` phase: the daily pass over every Suotar-enabled module's configuration.
//!
//! Asks Suotar's `course-codes/validate` about every distinct course code; the rest of the check
//! reads the database.

use std::collections::HashMap;

use headless_lms_models::course_module_suotar_configurations::{
    get_config_facts_for_enabled_modules, record_config_check,
};
use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::CreditRegistrationErrorCode;
use headless_lms_models::library::credit_registration::classification::{WireOutcome, outcome_of};
use headless_lms_models::library::credit_registration::config_validation::{
    CourseCodeVerdict, check_module_config,
};
use headless_lms_utils::services::suotar::{
    SuotarCallContext, SuotarEndpoint, SuotarItemStatus, SuotarResponseItem,
    ValidateCourseCodeRequestItem, ValidateCourseCodeResult, new_request_item_id,
};
use itertools::Itertools;

use crate::dispatch::PhaseContext;
use crate::phase::{CreditRegistrationPhase, PhaseScope};

pub(crate) async fn run(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let modules = {
        let mut conn = ctx.pool.acquire().await?;
        get_config_facts_for_enabled_modules(&mut conn, scope.course_id).await?
    };
    let course_codes: Vec<String> = modules
        .iter()
        .filter_map(|module| module.uh_course_code.as_deref())
        .map(str::trim)
        .filter(|code| !code.is_empty())
        .map(str::to_string)
        .sorted()
        .dedup()
        .collect();

    let mut verdicts: HashMap<String, CourseCodeVerdict> = HashMap::new();
    for chunk in course_codes.chunks(SuotarEndpoint::ValidateCourseCodes.max_batch_size()) {
        let items: Vec<ValidateCourseCodeRequestItem> = chunk
            .iter()
            .map(|course_code| ValidateCourseCodeRequestItem {
                request_item_id: new_request_item_id(),
                course_code: course_code.clone(),
            })
            .collect();
        let response = ctx
            .suotar_client
            .validate_course_codes(
                SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::ConfigValidation)),
                items.clone(),
            )
            .await;
        // Nothing is recorded, so the previous verdicts stand until a check gets through.
        let response = match response {
            Ok(response) => response,
            Err(error) => {
                return Ok(PhaseRunOutcome {
                    error: Some(scrub_text(error.message())),
                    ..PhaseRunOutcome::default()
                });
            }
        };
        for item in &items {
            if let Some(verdict) = response.item(&item.request_item_id).and_then(verdict_of) {
                verdicts.insert(item.course_code.clone(), verdict);
            }
        }
    }

    let mut conn = ctx.pool.acquire().await?;
    let mut with_problems = 0;
    for module in &modules {
        // A code Suotar gave no verdict for keeps its stored one: clearing it would read as allowed
        // and release a blocked module's rows.
        let verdict = module
            .uh_course_code
            .as_deref()
            .and_then(|code| verdicts.get(code.trim()).cloned())
            .or_else(|| CourseCodeVerdict::stored(module));
        let check = check_module_config(module, verdict.as_ref());
        if check.message.is_some() {
            with_problems += 1;
        }
        record_config_check(&mut conn, module.course_module_id, &check).await?;
    }
    if with_problems > 0 {
        warn!(
            modules_with_problems = with_problems,
            "Suotar-enabled course modules have configuration problems"
        );
    }

    // A misconfigured module is a finding, not a failed item: the phase did its job.
    Ok(PhaseRunOutcome::processed(
        i64::try_from(modules.len()).unwrap_or(i64::MAX),
    ))
}

/// `None` for any answer that is neither verdict.
fn verdict_of(item: &SuotarResponseItem<ValidateCourseCodeResult>) -> Option<CourseCodeVerdict> {
    match outcome_of(SuotarEndpoint::ValidateCourseCodes, &item.code) {
        WireOutcome::Unsettled if item.status == SuotarItemStatus::Ok => {
            Some(CourseCodeVerdict::Allowed)
        }
        WireOutcome::Failure(CreditRegistrationErrorCode::CourseNotAllowed) => {
            Some(CourseCodeVerdict::NotAllowed {
                reason: item
                    .error
                    .as_ref()
                    .map(|error| error.message.clone())
                    .unwrap_or_default(),
            })
        }
        _ => None,
    }
}
