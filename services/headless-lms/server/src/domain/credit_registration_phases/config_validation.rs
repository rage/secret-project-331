//! The `config-validation` phase: the daily pass over every Suotar-enabled module's configuration.
//!
//! Database-only. Everything Suotar could say about a configuration has already been recorded by
//! the phases that call it — a listing answered `courseCodeNotFound`, a product token that never
//! resolved — so this reads their traces rather than spending a call of its own.

use headless_lms_models::course_module_suotar_configurations::{
    get_config_facts_for_enabled_modules, record_config_check,
};
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::library::credit_registration::config_validation::check_module_config;

use super::{PhaseContext, PhaseScope};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let modules = get_config_facts_for_enabled_modules(&mut conn, scope.course_id).await?;
    let mut with_problems = 0;
    for module in &modules {
        let check = check_module_config(module);
        if check.message.is_some() {
            with_problems += 1;
        }
        record_config_check(&mut conn, module.course_module_id, &check).await?;
    }
    if with_problems > 0 {
        info!("{with_problems} Suotar-enabled course modules have configuration problems.");
    }

    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(modules.len()).unwrap_or(i32::MAX),
        // A misconfigured module is a finding, not a failed iteration: the phase did its job.
        items_failed: 0,
        error: None,
    })
}
