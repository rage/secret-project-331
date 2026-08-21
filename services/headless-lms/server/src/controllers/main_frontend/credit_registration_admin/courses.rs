//! The Courses tab: one row per Suotar-enabled course module, with its configuration validated.

use std::collections::HashMap;

use headless_lms_models::course_module_suotar_configurations::{
    self, SuotarModuleOverview, get_config_facts_for_enabled_modules,
};
use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registrations::{self, CreditRegistrationErrorCode};
use headless_lms_models::library::credit_registration::config_validation::check_module_config;
use utoipa::ToSchema;

use crate::prelude::*;

use super::{authorize_credit_registration_admin, required_reason};

/// What the configuration check concluded about one module, freshly derived from the same facts and
/// the same rule the `config-validation` phase uses.
///
/// `course_code_resolves` is `None` while no listing has been attempted: never checked is not the
/// same as checked and failed, and the two must not render alike.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationCourseConfigCheck {
    pub course_code_resolves: Option<bool>,
    pub product_token_found: Option<bool>,
    /// Every problem found, in one line. `None` means the module is fine.
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationCourseStats {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub open_university_product_id: Option<String>,
    /// The module's override; `None` means the scale is derived from the completion.
    pub grade_scale_id: Option<String>,
    /// The old pull path is on as well, which would register the same completion twice.
    pub old_flow_also_enabled: bool,
    pub paused_at: Option<DateTime<Utc>>,
    pub pause_reason: Option<String>,
    pub active_realisation_count: i64,
    pub last_listed_at: Option<DateTime<Utc>>,
    /// What the current facts say. Recomputed on read, so a configuration fixed a minute ago no
    /// longer shows as broken.
    pub check: CreditRegistrationCourseConfigCheck,
    /// When the `config-validation` phase last stamped its verdict on the row. `None` means never,
    /// which the stored verdict beside it cannot express on its own.
    pub config_checked_at: Option<DateTime<Utc>>,
    /// The verdict as the phase stored it, which may be older than `check`.
    pub stored_config_check_message: Option<String>,
    /// Completions `materialize` would take. Against `registration_count` this is the backfill
    /// progress: a gap that stops closing is the actionable signal.
    pub eligible_completion_count: i64,
    pub registration_count: i64,
    pub success_count: i64,
    pub in_flight_count: i64,
    pub failed_count: i64,
    /// Neither a success nor a failure, and shown separately so it is never read as one.
    pub abandoned_count: i64,
    pub needs_admin_attention_count: i64,
    pub awaiting_consent_count: i64,
    pub last_registered_at: Option<DateTime<Utc>>,
    pub top_error_code: Option<CreditRegistrationErrorCode>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationStatsByCourse {
    pub modules: Vec<CreditRegistrationCourseStats>,
    /// Modules whose current facts fail the check, which is the tab badge.
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

/**
GET `/api/v0/main-frontend/credit-registration-admin/courses` - Every Suotar-enabled course module,
its validated configuration and its volumes.
*/
#[instrument(skip(pool))]
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
) -> ControllerResult<web::Json<CreditRegistrationStatsByCourse>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let overviews = course_module_suotar_configurations::get_module_overviews(&mut conn).await?;
    let mut checks: HashMap<Uuid, CreditRegistrationCourseConfigCheck> =
        get_config_facts_for_enabled_modules(&mut conn, None)
            .await?
            .into_iter()
            .map(|facts| {
                let check = check_module_config(&facts);
                (
                    facts.course_module_id,
                    CreditRegistrationCourseConfigCheck {
                        course_code_resolves: check.course_code_resolves,
                        product_token_found: check.product_token_found,
                        message: check.message,
                    },
                )
            })
            .collect();
    let mut totals: HashMap<Uuid, _> = credit_registrations::count_by_module(&mut conn)
        .await?
        .into_iter()
        .map(|row| (row.course_module_id, row))
        .collect();

    let modules: Vec<CreditRegistrationCourseStats> = overviews
        .into_iter()
        .map(|overview| {
            let module_id = overview.course_module_id;
            to_course_stats(
                overview,
                checks
                    .remove(&module_id)
                    .unwrap_or(CreditRegistrationCourseConfigCheck {
                        course_code_resolves: None,
                        product_token_found: None,
                        message: None,
                    }),
                totals.remove(&module_id),
            )
        })
        .collect();

    token.authorized_ok(web::Json(CreditRegistrationStatsByCourse {
        misconfigured_count: modules
            .iter()
            .filter(|row| row.check.message.is_some())
            .count() as i64,
        modules,
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
    models::credit_registration_admin_actions::record(
        tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(course_module_id),
            reason: reason.map(str::to_string),
            ..NewCreditRegistrationAdminAction::new(
                action,
                CreditRegistrationAdminActionTarget::CourseModule,
                actor_user_id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    Ok(())
}

fn to_course_stats(
    overview: SuotarModuleOverview,
    check: CreditRegistrationCourseConfigCheck,
    totals: Option<credit_registrations::ModuleRegistrationTotals>,
) -> CreditRegistrationCourseStats {
    CreditRegistrationCourseStats {
        course_id: overview.course_id,
        course_name: overview.course_name,
        course_module_id: overview.course_module_id,
        course_module_name: overview.course_module_name,
        uh_course_code: overview.uh_course_code,
        ects_credits: overview.ects_credits,
        open_university_product_id: overview.open_university_product_id,
        grade_scale_id: overview.grade_scale_id,
        old_flow_also_enabled: overview.old_flow_also_enabled,
        paused_at: overview.paused_at,
        pause_reason: overview.pause_reason,
        active_realisation_count: overview.active_realisation_count,
        last_listed_at: overview.last_listed_at,
        check,
        config_checked_at: overview.config_checked_at,
        stored_config_check_message: overview.config_check_message,
        eligible_completion_count: overview.eligible_completion_count,
        registration_count: totals.as_ref().map_or(0, |row| row.total_count),
        success_count: totals.as_ref().map_or(0, |row| row.success_count),
        in_flight_count: totals.as_ref().map_or(0, |row| row.in_flight_count),
        failed_count: totals.as_ref().map_or(0, |row| row.failed_count),
        abandoned_count: totals.as_ref().map_or(0, |row| row.abandoned_count),
        needs_admin_attention_count: totals
            .as_ref()
            .map_or(0, |row| row.needs_admin_attention_count),
        awaiting_consent_count: totals.as_ref().map_or(0, |row| row.awaiting_consent_count),
        last_registered_at: totals.as_ref().and_then(|row| row.last_registered_at),
        top_error_code: totals.and_then(|row| row.top_error_code),
    }
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
    );
}
