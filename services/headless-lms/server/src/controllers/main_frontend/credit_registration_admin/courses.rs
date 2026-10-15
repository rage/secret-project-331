//! The Courses tab: one row per Suotar-enabled course module and per mooc.fi target, with its
//! configuration validated, and the mooc.fi targets' configuration.

use std::collections::HashMap;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::course_module_suotar_configurations::SuotarConfigCheck;
use headless_lms_models::course_module_suotar_configurations::{
    self, SuotarModuleOverview, get_config_facts_for_enabled_modules,
};
use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registrations::{
    self, AttentionStanding, CreditRegistrationErrorCode,
};
use headless_lms_models::external_credit_targets::{
    self, ExternalCreditTarget, ExternalCreditTargetConfiguration, ExternalGrading, TierRange,
};
use headless_lms_models::library::credit_registration::config_validation::{
    CourseCodeVerdict, check_module_config, check_target_config,
};
use utoipa::ToSchema;

use crate::domain::error::{BadRequestReason, bad_request_with_reason};
use crate::prelude::*;

use super::dashboard::{CreditRegistrationStepCount, sum_step_counts};
use super::{attention_rules, authorize_credit_registration_admin, required_reason};

/// Suotar-enabled modules, comfortably above any real deployment's count. The only admin tab
/// without a page or a limit of its own before this.
const COURSES_LIMIT: i64 = 2_000;

const NO_CHECK: CreditRegistrationCourseConfigCheck = CreditRegistrationCourseConfigCheck {
    course_code_allowed: None,
    message: None,
};

/// What the configuration check concluded about one module, freshly derived from the same facts and
/// the same rule the `config-validation` phase uses, with the course code verdict Suotar gave that
/// phase.
///
/// `course_code_allowed` is `None` while Suotar has given no verdict on the current course code:
/// never checked is not the same as checked and failed, and the two must not render alike.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationCourseConfigCheck {
    pub course_code_allowed: Option<bool>,
    /// Every problem found, in one line. `None` means the module is fine.
    pub message: Option<String>,
}

/// One row of the Courses tab: a course module or a mooc.fi target.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationCourseStats {
    /// The module's or target's id, which the Registrations list's `course_module_id` filter takes.
    pub credit_unit_id: Uuid,
    /// `None` for a mooc.fi target, as is `course_module_id`.
    pub course_id: Option<Uuid>,
    /// The course's name, or "mooc.fi: " and the target's name.
    pub course_name: String,
    pub course_module_id: Option<Uuid>,
    pub course_module_name: Option<String>,
    /// The target's configuration, for a mooc.fi target only.
    pub external_credit_target: Option<ExternalCreditTarget>,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    /// Where a student with no usable enrolment is sent to enrol.
    pub enrolment_link: Option<String>,
    pub paused_at: Option<DateTime<Utc>>,
    pub pause_reason: Option<String>,
    pub last_listed_at: Option<DateTime<Utc>>,
    /// What the current facts say. Recomputed on read, so a configuration fixed a minute ago no
    /// longer shows as broken.
    pub check: CreditRegistrationCourseConfigCheck,
    /// When the `config-validation` phase last stamped its verdict on the row. `None` means never,
    /// which the stored verdict beside it cannot express on its own.
    pub config_checked_at: Option<DateTime<Utc>>,
    /// The verdict as the phase stored it, which may be older than `check`.
    pub stored_config_check_message: Option<String>,
    /// Every passed, ECTS-eligible completion on the module, whichever path owns it. Wider than
    /// what `materialize` takes, which is only the ones carrying `register_credits_via_suotar`, so
    /// a module opted in mid-course keeps a permanent gap against `registration_count` for the
    /// completions that predate the opt-in. For a mooc.fi target, exactly the completions it is
    /// responsible for, withdrawn ones left out.
    pub eligible_completion_count: i64,
    pub registration_count: i64,
    /// Registered, already in Sisu and better grade in Sisu: the denominator the failure rate is
    /// taken against, with `failed_count`.
    pub success_count: i64,
    /// Of `success_count`, registered by us.
    pub registered_count: i64,
    /// Of `success_count`, already in Sisu or with a better grade there.
    pub already_in_sisu_count: i64,
    pub in_flight_count: i64,
    pub failed_count: i64,
    /// The row's registrations counted in Needs attention: the Registrations list with
    /// `course_module_id` and `needs_attention=true` holds exactly these.
    pub needs_attention_count: i64,
    /// The module's "Where registrations stand", Not started left out; each count equals the
    /// Registrations list filtered by its step, engagement and `course_module_id`.
    pub where_registrations_stand: Vec<CreditRegistrationStepCount>,
    pub last_registered_at: Option<DateTime<Utc>>,
    pub top_error_code: Option<CreditRegistrationErrorCode>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationStatsByCourse {
    /// Modules first, then mooc.fi targets.
    pub credit_units: Vec<CreditRegistrationCourseStats>,
    /// Modules and targets whose current facts fail the check, which is the tab badge.
    pub misconfigured_count: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminPauseCourseModulePayload {
    pub reason: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminResumeCourseModulePayload {
    pub reason: Option<String>,
}

/// A mooc.fi target's configuration as the admin form sends it, with the audit reason.
#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminExternalCreditTargetPayload {
    /// The handler course on mooc.fi, which the completions are stored on.
    pub moocfi_course_id: Uuid,
    pub moocfi_course_slug: String,
    pub name: String,
    /// BCP 47, e.g. `fi-FI`.
    pub language_code: String,
    /// `None` for an untiered course.
    pub tiers: Option<TierRange>,
    pub uh_course_code: String,
    pub ects_credits: f32,
    pub grading: ExternalGrading,
    pub enrolment_link: Option<String>,
    /// Must equal mooc.fi's `credit_registration_delegated_at` and the other live targets' cutoff
    /// of the same mooc.fi course. Cannot change once the target has registrations.
    pub delegated_at: DateTime<Utc>,
    pub enabled: bool,
    pub reason: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminDeleteExternalCreditTargetPayload {
    pub reason: String,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/courses` - Every Suotar-enabled course module,
its validated configuration and its volumes.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/courses",
    operation_id = "getCreditRegistrationStatsByCourse",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "One row per enabled course module", body = CreditRegistrationStatsByCourse)
    )
)]
pub async fn get_credit_registration_stats_by_course(
    user: AuthUser,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<CreditRegistrationStatsByCourse>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let overviews =
        course_module_suotar_configurations::get_module_overviews(&mut conn, COURSES_LIMIT).await?;
    let mut checks: HashMap<Uuid, CreditRegistrationCourseConfigCheck> =
        get_config_facts_for_enabled_modules(&mut conn, None)
            .await?
            .into_iter()
            .map(|facts| {
                let check = check_module_config(&facts, CourseCodeVerdict::stored(&facts).as_ref());
                (facts.course_module_id, config_check_stats(check))
            })
            .collect();
    let mut totals: HashMap<Uuid, _> = credit_registrations::count_by_credit_unit(&mut conn)
        .await?
        .into_iter()
        .map(|row| (row.credit_unit_id, row))
        .collect();

    let rules = attention_rules(&mut conn, &app_conf).await?;
    let mut needs_attention: HashMap<Uuid, i64> = HashMap::new();
    for row in credit_registrations::get_attention_items(&mut conn, &rules, None).await? {
        if row.standing(&rules.blocking) == AttentionStanding::NeedsAttention {
            *needs_attention.entry(row.credit_unit_id).or_insert(0) += 1;
        }
    }
    let step_counts = credit_registrations::count_by_step_and_engagement(
        &mut conn,
        app_conf.suotar_configuration.account_linking_since,
    )
    .await?;

    let unit_stats = |stats: &mut CreditRegistrationCourseStats,
                      needs_attention: &mut HashMap<Uuid, i64>| {
        stats.needs_attention_count = needs_attention.remove(&stats.credit_unit_id).unwrap_or(0);
        stats.where_registrations_stand = sum_step_counts(
            step_counts
                .iter()
                .filter(|row| row.credit_unit_id == stats.credit_unit_id),
        );
    };

    let mut credit_units: Vec<CreditRegistrationCourseStats> = overviews
        .into_iter()
        .map(|overview| {
            let module_id = overview.course_module_id;
            let mut stats = to_course_stats(
                overview,
                checks.remove(&module_id).unwrap_or(NO_CHECK),
                totals.remove(&module_id),
            );
            unit_stats(&mut stats, &mut needs_attention);
            stats
        })
        .collect();

    let mut target_checks: HashMap<Uuid, CreditRegistrationCourseConfigCheck> =
        external_credit_targets::get_config_facts_for_enabled_targets(&mut conn, None)
            .await?
            .into_iter()
            .map(|facts| {
                let check = check_target_config(
                    &facts,
                    CourseCodeVerdict::stored_for_target(&facts).as_ref(),
                );
                (facts.external_credit_target_id, config_check_stats(check))
            })
            .collect();
    let mut eligible_counts =
        external_credit_targets::count_eligible_completions_by_target(&mut conn).await?;
    for target in external_credit_targets::get_all(&mut conn).await? {
        let id = target.id;
        let mut stats = target_course_stats(
            target,
            target_checks.remove(&id).unwrap_or(NO_CHECK),
            eligible_counts.remove(&id).unwrap_or(0),
            totals.remove(&id),
        );
        unit_stats(&mut stats, &mut needs_attention);
        credit_units.push(stats);
    }

    token.authorized_ok(web::Json(CreditRegistrationStatsByCourse {
        misconfigured_count: credit_units
            .iter()
            .filter(|row| row.check.message.is_some())
            .count() as i64,
        credit_units,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/courses/{course_module_id}/pause` - Stops every
phase from claiming this module's rows.

Freezes the rows where they stand rather than cancelling them, so resuming picks up what was already
in flight.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/courses/{course_module_id}/pause",
    operation_id = "adminPauseCourseModuleCreditRegistration",
    tag = "credit-registration-admin",
    params(("course_module_id" = Uuid, Path, description = "Course module id")),
    request_body = AdminPauseCourseModulePayload,
    responses(
        (status = 200, description = "Paused"),
        (status = 422, description = "No reason given, or the module has no Suotar configuration")
    )
)]
pub async fn admin_pause_course_module_credit_registration(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_module_id: web::Path<Uuid>,
    payload: web::Json<AdminPauseCourseModulePayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let module_id = *course_module_id;
    require_suotar_configuration(&mut conn, module_id).await?;

    let mut tx = conn.begin().await?;
    course_module_suotar_configurations::set_paused(
        &mut tx,
        module_id,
        Some(course_module_suotar_configurations::SuotarPause {
            paused_at: Utc::now(),
            paused_by_user_id: user.id,
            reason: Some(reason),
        }),
    )
    .await?;
    record_module_action(
        &mut tx,
        CreditRegistrationAdminAction::PauseCourseModule,
        module_id,
        user.id,
        Some(reason),
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/courses/{course_module_id}/resume` - Lets the
phases claim this module's rows again.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/courses/{course_module_id}/resume",
    operation_id = "adminResumeCourseModuleCreditRegistration",
    tag = "credit-registration-admin",
    params(("course_module_id" = Uuid, Path, description = "Course module id")),
    request_body = AdminResumeCourseModulePayload,
    responses(
        (status = 200, description = "Resumed"),
        (status = 422, description = "The module has no Suotar configuration")
    )
)]
pub async fn admin_resume_course_module_credit_registration(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_module_id: web::Path<Uuid>,
    payload: web::Json<AdminResumeCourseModulePayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let module_id = *course_module_id;
    require_suotar_configuration(&mut conn, module_id).await?;

    let mut tx = conn.begin().await?;
    course_module_suotar_configurations::set_paused(&mut tx, module_id, None).await?;
    record_module_action(
        &mut tx,
        CreditRegistrationAdminAction::ResumeCourseModule,
        module_id,
        user.id,
        payload.reason.as_deref(),
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/// A module with no configuration row has nothing to pause: `set_paused` would update no rows and
/// the call would report a pause that never happened.
async fn require_suotar_configuration(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> Result<(), ControllerError> {
    if course_module_suotar_configurations::exists(conn, course_module_id).await? {
        return Ok(());
    }
    Err(controller_err!(
        BadRequest,
        "This course module has no credit registration configuration.".to_string()
    ))
}

async fn record_module_action(
    tx: &mut PgConnection,
    action: CreditRegistrationAdminAction,
    course_module_id: Uuid,
    actor_user_id: Uuid,
    reason: Option<&str>,
) -> Result<(), ControllerError> {
    record_action(
        tx,
        action,
        CreditRegistrationAdminActionTarget::CourseModule,
        course_module_id,
        actor_user_id,
        reason,
        None,
    )
    .await
}

fn config_check_stats(check: SuotarConfigCheck) -> CreditRegistrationCourseConfigCheck {
    CreditRegistrationCourseConfigCheck {
        course_code_allowed: check.course_code_allowed,
        message: check.message,
    }
}

fn to_course_stats(
    overview: SuotarModuleOverview,
    check: CreditRegistrationCourseConfigCheck,
    totals: Option<credit_registrations::CreditUnitRegistrationTotals>,
) -> CreditRegistrationCourseStats {
    let totals = totals.unwrap_or_default();
    CreditRegistrationCourseStats {
        credit_unit_id: overview.course_module_id,
        course_id: Some(overview.course_id),
        course_name: overview.course_name,
        course_module_id: Some(overview.course_module_id),
        course_module_name: overview.course_module_name,
        external_credit_target: None,
        uh_course_code: overview.uh_course_code,
        ects_credits: overview.ects_credits,
        enrolment_link: overview.enrolment_link,
        paused_at: overview.paused_at,
        pause_reason: overview.pause_reason,
        last_listed_at: overview.last_listed_at,
        check,
        config_checked_at: overview.config_checked_at,
        stored_config_check_message: overview.config_check_message,
        eligible_completion_count: overview.eligible_completion_count,
        registration_count: totals.total_count,
        success_count: totals.success_count,
        registered_count: totals.registered_count,
        already_in_sisu_count: totals.already_in_sisu_count,
        in_flight_count: totals.in_flight_count,
        failed_count: totals.failed_count,
        needs_attention_count: 0,
        where_registrations_stand: Vec::new(),
        last_registered_at: totals.last_registered_at,
        top_error_code: totals.top_error_code,
    }
}

fn target_course_stats(
    target: ExternalCreditTarget,
    check: CreditRegistrationCourseConfigCheck,
    eligible_completion_count: i64,
    totals: Option<credit_registrations::CreditUnitRegistrationTotals>,
) -> CreditRegistrationCourseStats {
    let totals = totals.unwrap_or_default();
    CreditRegistrationCourseStats {
        credit_unit_id: target.id,
        course_id: None,
        course_name: format!("mooc.fi: {}", target.name),
        course_module_id: None,
        course_module_name: None,
        uh_course_code: Some(target.uh_course_code.clone()),
        ects_credits: Some(target.ects_credits),
        enrolment_link: target.enrolment_link.clone(),
        paused_at: target.paused_at,
        pause_reason: target.pause_reason.clone(),
        last_listed_at: target.last_listed_at,
        check,
        config_checked_at: target.config_checked_at,
        stored_config_check_message: target.config_check_message.clone(),
        eligible_completion_count,
        registration_count: totals.total_count,
        success_count: totals.success_count,
        registered_count: totals.registered_count,
        already_in_sisu_count: totals.already_in_sisu_count,
        in_flight_count: totals.in_flight_count,
        failed_count: totals.failed_count,
        needs_attention_count: 0,
        where_registrations_stand: Vec::new(),
        last_registered_at: totals.last_registered_at,
        top_error_code: totals.top_error_code,
        external_credit_target: Some(target),
    }
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/courses/external-targets` - Adds a mooc.fi
course whose credits courses registers.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/courses/external-targets",
    operation_id = "adminCreateExternalCreditTarget",
    tag = "credit-registration-admin",
    request_body = AdminExternalCreditTargetPayload,
    responses(
        (status = 200, description = "The new target's id", body = Uuid),
        (status = 422, description = "Invalid configuration, overlapping tiers or a course code the mooc.fi course already has")
    )
)]
pub async fn admin_create_external_credit_target(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminExternalCreditTargetPayload>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let configuration = target_configuration(&payload, None)?;

    let mut tx = conn.begin().await?;
    require_shared_cutoff(&mut tx, &configuration, None).await?;
    let id = external_credit_targets::insert(&mut tx, PKeyPolicy::Generate, &configuration).await?;
    record_target_action(
        &mut tx,
        CreditRegistrationAdminAction::ConfigureExternalCreditTarget,
        id,
        user.id,
        Some(reason),
        Some(serde_json::json!({ "change": "create", "after": configuration })),
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(id))
}

/**
PUT `/api/v0/main-frontend/credit-registration-admin/courses/external-targets/{external_credit_target_id}`
- Replaces a mooc.fi target's configuration.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    put,
    path = "/courses/external-targets/{external_credit_target_id}",
    operation_id = "adminUpdateExternalCreditTarget",
    tag = "credit-registration-admin",
    params(("external_credit_target_id" = Uuid, Path, description = "mooc.fi target id")),
    request_body = AdminExternalCreditTargetPayload,
    responses(
        (status = 200, description = "Saved"),
        (status = 422, description = "Invalid configuration, overlapping tiers, a course code the mooc.fi course already has, a cutoff change on a target with registrations, or a mooc.fi course change on a target with completions")
    )
)]
pub async fn admin_update_external_credit_target(
    user: AuthUser,
    pool: web::Data<PgPool>,
    external_credit_target_id: web::Path<Uuid>,
    payload: web::Json<AdminExternalCreditTargetPayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let id = *external_credit_target_id;

    let mut tx = conn.begin().await?;
    let before = external_credit_targets::get_by_id(&mut tx, id).await?;
    let configuration = target_configuration(&payload, Some(&before))?;
    // Moving the cutoff of a target with registrations is a hand-run procedure on both platforms.
    if configuration.delegated_at != before.delegated_at
        && external_credit_targets::has_credit_registrations(&mut tx, id).await?
    {
        return Err(controller_err!(
            BadRequest,
            "The cutoff cannot change once the target has registrations.".to_string()
        ));
    }
    // Its completions and their ledger rows were read from the old course.
    if configuration.moocfi_course_id != before.moocfi_course_id
        && external_credit_targets::has_completions(&mut tx, id).await?
    {
        return Err(bad_request_with_reason(
            BadRequestReason::ExternalCreditTargetMoocfiCourseFixed,
            "The mooc.fi course cannot change once the target has completions.".to_string(),
        ));
    }
    require_shared_cutoff(&mut tx, &configuration, Some(id)).await?;
    external_credit_targets::update(&mut tx, id, &configuration).await?;
    record_target_action(
        &mut tx,
        CreditRegistrationAdminAction::ConfigureExternalCreditTarget,
        id,
        user.id,
        Some(reason),
        Some(serde_json::json!({
            "change": "update",
            "before": before,
            "after": configuration,
        })),
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/courses/external-targets/{external_credit_target_id}/delete`
- Soft-deletes a mooc.fi target, which withdraws its completions not yet submitted.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/courses/external-targets/{external_credit_target_id}/delete",
    operation_id = "adminDeleteExternalCreditTarget",
    tag = "credit-registration-admin",
    params(("external_credit_target_id" = Uuid, Path, description = "mooc.fi target id")),
    request_body = AdminDeleteExternalCreditTargetPayload,
    responses(
        (status = 200, description = "Deleted"),
        (status = 422, description = "No reason given")
    )
)]
pub async fn admin_delete_external_credit_target(
    user: AuthUser,
    pool: web::Data<PgPool>,
    external_credit_target_id: web::Path<Uuid>,
    payload: web::Json<AdminDeleteExternalCreditTargetPayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let id = *external_credit_target_id;

    let mut tx = conn.begin().await?;
    let before = external_credit_targets::get_by_id(&mut tx, id).await?;
    external_credit_targets::delete(&mut tx, id).await?;
    record_target_action(
        &mut tx,
        CreditRegistrationAdminAction::ConfigureExternalCreditTarget,
        id,
        user.id,
        Some(reason),
        Some(serde_json::json!({ "change": "delete", "before": before })),
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/courses/external-targets/{external_credit_target_id}/pause`
- Stops every phase from claiming this mooc.fi target's rows, freezing them where they stand.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/courses/external-targets/{external_credit_target_id}/pause",
    operation_id = "adminPauseExternalCreditTarget",
    tag = "credit-registration-admin",
    params(("external_credit_target_id" = Uuid, Path, description = "mooc.fi target id")),
    request_body = AdminPauseCourseModulePayload,
    responses(
        (status = 200, description = "Paused"),
        (status = 422, description = "No reason given")
    )
)]
pub async fn admin_pause_external_credit_target(
    user: AuthUser,
    pool: web::Data<PgPool>,
    external_credit_target_id: web::Path<Uuid>,
    payload: web::Json<AdminPauseCourseModulePayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let id = *external_credit_target_id;

    let mut tx = conn.begin().await?;
    external_credit_targets::set_paused(
        &mut tx,
        id,
        Some(course_module_suotar_configurations::SuotarPause {
            paused_at: Utc::now(),
            paused_by_user_id: user.id,
            reason: Some(reason),
        }),
    )
    .await?;
    record_target_action(
        &mut tx,
        CreditRegistrationAdminAction::PauseExternalCreditTarget,
        id,
        user.id,
        Some(reason),
        None,
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/courses/external-targets/{external_credit_target_id}/resume`
- Lets the phases claim this mooc.fi target's rows again.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/courses/external-targets/{external_credit_target_id}/resume",
    operation_id = "adminResumeExternalCreditTarget",
    tag = "credit-registration-admin",
    params(("external_credit_target_id" = Uuid, Path, description = "mooc.fi target id")),
    request_body = AdminResumeCourseModulePayload,
    responses(
        (status = 200, description = "Resumed")
    )
)]
pub async fn admin_resume_external_credit_target(
    user: AuthUser,
    pool: web::Data<PgPool>,
    external_credit_target_id: web::Path<Uuid>,
    payload: web::Json<AdminResumeCourseModulePayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let id = *external_credit_target_id;

    let mut tx = conn.begin().await?;
    external_credit_targets::set_paused(&mut tx, id, None).await?;
    record_target_action(
        &mut tx,
        CreditRegistrationAdminAction::ResumeExternalCreditTarget,
        id,
        user.id,
        payload.reason.as_deref(),
        None,
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/// The payload as a configuration to store, trimmed and checked. `existing` keeps the time an
/// already enabled target was switched on.
fn target_configuration(
    payload: &AdminExternalCreditTargetPayload,
    existing: Option<&ExternalCreditTarget>,
) -> Result<ExternalCreditTargetConfiguration, ControllerError> {
    let required = |value: &str, field: &str| -> Result<String, ControllerError> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Err(controller_err!(BadRequest, format!("{field} is required.")));
        }
        Ok(trimmed.to_string())
    };
    if !(payload.ects_credits.is_finite() && payload.ects_credits > 0.0) {
        return Err(controller_err!(
            BadRequest,
            "ECTS credits must be more than zero.".to_string()
        ));
    }
    if let Some(TierRange {
        lowest: Some(lowest),
        highest: Some(highest),
    }) = payload.tiers
        && lowest > highest
    {
        return Err(controller_err!(
            BadRequest,
            "The lowest tier is above the highest.".to_string()
        ));
    }
    Ok(ExternalCreditTargetConfiguration {
        moocfi_course_id: payload.moocfi_course_id,
        moocfi_course_slug: required(&payload.moocfi_course_slug, "The mooc.fi course slug")?,
        name: required(&payload.name, "The name")?,
        language_code: required(&payload.language_code, "The language")?,
        tiers: payload.tiers,
        uh_course_code: required(&payload.uh_course_code, "The course code")?,
        ects_credits: payload.ects_credits,
        grading: payload.grading,
        enrolment_link: payload
            .enrolment_link
            .as_deref()
            .map(str::trim)
            .filter(|link| !link.is_empty())
            .map(str::to_string),
        delegated_at: payload.delegated_at,
        enabled_at: payload.enabled.then(|| {
            existing
                .and_then(|target| target.enabled_at)
                .unwrap_or_else(Utc::now)
        }),
    })
}

/// Refuses a cutoff that differs from the other live targets' of the same mooc.fi course: mooc.fi
/// has one cutoff per course, and the handoff checks every target against it.
async fn require_shared_cutoff(
    conn: &mut PgConnection,
    configuration: &ExternalCreditTargetConfiguration,
    own_id: Option<Uuid>,
) -> Result<(), ControllerError> {
    let siblings =
        external_credit_targets::get_by_moocfi_course_id(conn, configuration.moocfi_course_id)
            .await?;
    match siblings
        .iter()
        .find(|sibling| Some(sibling.id) != own_id)
        .map(|sibling| sibling.delegated_at)
    {
        Some(cutoff) if cutoff != configuration.delegated_at => Err(controller_err!(
            BadRequest,
            format!(
                "Every target of one mooc.fi course has the same cutoff, here {}.",
                cutoff.to_rfc3339()
            )
        )),
        _ => Ok(()),
    }
}

async fn record_target_action(
    tx: &mut PgConnection,
    action: CreditRegistrationAdminAction,
    external_credit_target_id: Uuid,
    actor_user_id: Uuid,
    reason: Option<&str>,
    details: Option<serde_json::Value>,
) -> Result<(), ControllerError> {
    record_action(
        tx,
        action,
        CreditRegistrationAdminActionTarget::ExternalCreditTarget,
        external_credit_target_id,
        actor_user_id,
        reason,
        details,
    )
    .await
}

async fn record_action(
    tx: &mut PgConnection,
    action: CreditRegistrationAdminAction,
    target: CreditRegistrationAdminActionTarget,
    target_id: Uuid,
    actor_user_id: Uuid,
    reason: Option<&str>,
    details: Option<serde_json::Value>,
) -> Result<(), ControllerError> {
    models::credit_registration_admin_actions::record(
        tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(target_id),
            reason: reason.map(str::to_string),
            details,
            ..NewCreditRegistrationAdminAction::new(
                action,
                target,
                actor_user_id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    Ok(())
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/courses",
        web::get().to(get_credit_registration_stats_by_course),
    )
    .route(
        "/courses/{course_module_id}/pause",
        web::post().to(admin_pause_course_module_credit_registration),
    )
    .route(
        "/courses/{course_module_id}/resume",
        web::post().to(admin_resume_course_module_credit_registration),
    )
    .route(
        "/courses/external-targets",
        web::post().to(admin_create_external_credit_target),
    )
    .route(
        "/courses/external-targets/{external_credit_target_id}",
        web::put().to(admin_update_external_credit_target),
    )
    .route(
        "/courses/external-targets/{external_credit_target_id}/delete",
        web::post().to(admin_delete_external_credit_target),
    )
    .route(
        "/courses/external-targets/{external_credit_target_id}/pause",
        web::post().to(admin_pause_external_credit_target),
    )
    .route(
        "/courses/external-targets/{external_credit_target_id}/resume",
        web::post().to(admin_resume_external_credit_target),
    );
}
