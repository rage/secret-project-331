//! The mock Suotar control surface: test-only routes that are not part of Suotar's API.
//!
//! A tick runs one iteration of one phase synchronously, because the real loops are long-running
//! intervals in their own Deployments that a Playwright spec cannot wait out. Gated on
//! `test_mode && test_suotar`, so no token; the client is hand-written in
//! `system-tests/src/utils/suotarControl.ts`.

use chrono::Duration;

use crate::domain::credit_registration_phases::{
    CreditRegistrationPhase, PhaseContext, PhaseScope, PhaseSkipReason, PhaseTick, breaker,
    rate_limit, run_phase_once,
};
use crate::prelude::*;
use headless_lms_models::library::credit_registration::enrolment_check_schedule::{
    EnrolmentCheckGroup, EnrolmentCheckSource,
};
use headless_lms_utils::services::suotar::SuotarClient;
use sqlx::PgPool;

use super::commands;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunTickQuery {
    /// Optional so a missing phase answers our typed error listing the valid names, not actix's 400.
    pub phase: Option<String>,
    pub course_id: Option<Uuid>,
    /// Resolved here so a scenario's returned owner object doubles as the tick scope.
    pub course_slug: Option<String>,
    pub user_id: Option<Uuid>,
    pub user_email: Option<String>,
    /// Comma-separated ledger row ids, for a spec that already knows them.
    pub credit_registration_ids: Option<String>,
    /// Overrides the deployment's account-linking switch for this tick, so a spec can run a phase
    /// the way a deployment with linking off would.
    pub account_linking_enabled: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UnresolvedScope {
    pub status: String,
    pub half: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum PhaseTickResult {
    #[serde(rename_all = "camelCase")]
    Ran {
        phase: String,
        items_processed: i32,
        items_failed: i32,
        /// Set when the iteration ran but failed; already scrubbed by the phase.
        error: Option<String>,
    },
    /// The phase is paused, or the circuit breaker for this scope is open. Not a failure.
    Skipped { phase: String, reason: String },
    /// The scope names something this phase's claim query cannot narrow on.
    ScopeNotSupported { phase: String },
    #[serde(rename_all = "camelCase")]
    UnknownPhase {
        phase: Option<String>,
        known_phases: Vec<String>,
    },
}

impl PhaseTickResult {
    fn of(phase: CreditRegistrationPhase, tick: PhaseTick) -> Self {
        match tick {
            PhaseTick::Ran(outcome) => Self::Ran {
                phase: phase.as_str().to_string(),
                items_processed: outcome.items_processed,
                items_failed: outcome.items_failed,
                error: outcome.error,
            },
            PhaseTick::Skipped(reason) => Self::Skipped {
                phase: phase.as_str().to_string(),
                reason: match reason {
                    PhaseSkipReason::Paused => "paused".to_string(),
                    PhaseSkipReason::CircuitBreakerOpen => "circuitBreakerOpen".to_string(),
                    PhaseSkipReason::AccountLinkingDisabled => "accountLinkingDisabled".to_string(),
                },
            },
            PhaseTick::ScopeNotSupported => Self::ScopeNotSupported {
                phase: phase.as_str().to_string(),
            },
        }
    }
}

/// One entry per phase in the sequence, in the order they ran.
#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistrarTickResult {
    pub phases: Vec<PhaseTickResult>,
}

/// Runs one iteration of one pipeline phase: 200 when it ran, 400 for `unknownPhase` or a scope the
/// phase cannot narrow on. An optional scope narrows the rows the iteration may claim; absent is
/// unscoped, which is what production does.
async fn run_tick(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    suotar_client: web::Data<SuotarClient>,
    query: web::Query<RunTickQuery>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let Some(phase) = query
        .phase
        .as_deref()
        .and_then(CreditRegistrationPhase::from_phase_name)
    else {
        return token.authorized_ok(HttpResponse::BadRequest().json(
            PhaseTickResult::UnknownPhase {
                phase: query.phase.clone(),
                known_phases: known_phase_names(),
            },
        ));
    };

    let scope = match resolve_scope(&pool, &query).await? {
        Ok(scope) => scope,
        // Never a silent fall-through to sweeping everything.
        Err(unresolved) => {
            return token.authorized_ok(HttpResponse::BadRequest().json(unresolved));
        }
    };

    let mut suotar_conf = app_conf.suotar_configuration.clone();
    if let Some(enabled) = query.account_linking_enabled {
        suotar_conf.account_linking_enabled = enabled;
    }
    let ctx = PhaseContext {
        suotar_conf: &suotar_conf,
        ..tick_context(&app_conf, &pool, &suotar_client)
    };
    let result = PhaseTickResult::of(phase, run_phase_once(&ctx, phase, &scope).await?);
    token.authorized_ok(match &result {
        PhaseTickResult::Ran { .. } | PhaseTickResult::Skipped { .. } => {
            HttpResponse::Ok().json(&result)
        }
        PhaseTickResult::ScopeNotSupported { .. } | PhaseTickResult::UnknownPhase { .. } => {
            HttpResponse::BadRequest().json(&result)
        }
    })
}

/// The combined form of `run-tick`, walking the sequence in pipeline order. Always 200; each phase
/// reports its own status. Takes no scope on purpose: a suite that only ever ticks scoped never
/// exercises the sweep-everything behaviour production has.
async fn run_registrar_tick(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    suotar_client: web::Data<SuotarClient>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let scope = PhaseScope::default();
    let ctx = tick_context(&app_conf, &pool, &suotar_client);
    let mut phases = Vec::new();
    for phase in CreditRegistrationPhase::REGISTRAR_TICK_SEQUENCE {
        phases.push(PhaseTickResult::of(
            phase,
            run_phase_once(&ctx, phase, &scope).await?,
        ));
    }
    token.authorized_ok(HttpResponse::Ok().json(RegistrarTickResult { phases }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegradeCompletionPayload {
    pub credit_registration_id: Uuid,
    /// `null` puts the completion on the pass/fail scale, which is how a spec crosses grade scales.
    pub grade: Option<i32>,
    /// Absent leaves it alone.
    pub passed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegradeCompletionResult {
    pub course_module_completion_id: Uuid,
    pub grade: Option<i32>,
}

/// Rewrites the grade of the completion behind one ledger row.
///
/// A test hook, not a product path: the manual completion flow writes a new completion row, so
/// nothing else in the product edits a completion's grade, and the grade-improvement statement is
/// about exactly that edit.
async fn regrade_completion(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    payload: web::Json<RegradeCompletionPayload>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    let registration =
        models::credit_registrations::get_by_id(&mut conn, payload.credit_registration_id).await?;
    models::course_module_completions::set_grade_for_testing(
        &mut conn,
        registration.course_module_completion_id,
        payload.grade,
        payload.passed,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().json(RegradeCompletionResult {
        course_module_completion_id: registration.course_module_completion_id,
        grade: payload.grade,
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTestExclusiveHoldPayload {
    pub user_email: String,
    /// Absent holds every course of the user; set to narrow to one.
    pub course_id: Option<Uuid>,
    pub hold_secs: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SetTestExclusiveHoldResult {
    pub held_until: DateTime<Utc>,
}

/// Comfortably above Playwright's own 100 s per-test timeout (`playwright.config.ts`'s `timeout`),
/// so no legitimate hold is ever rejected; a value anywhere near this is a spec that mistyped a
/// unit, not one that needs the identity held that long.
const MAX_TEST_EXCLUSIVE_HOLD_SECS: i64 = 120;

/// Excuses a user's rows from the live background worker's unscoped sweeps — see
/// `credit_registrations::set_test_exclusive_hold_for_testing`. Keyed on identity rather than a row
/// id, so a spec can hold before materialize creates the row it means to protect.
async fn set_test_exclusive_hold(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    payload: web::Json<SetTestExclusiveHoldPayload>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    if !(0..=MAX_TEST_EXCLUSIVE_HOLD_SECS).contains(&payload.hold_secs) {
        return token.authorized_ok(HttpResponse::BadRequest().json(format!(
            "holdSecs must be between 0 and {MAX_TEST_EXCLUSIVE_HOLD_SECS}"
        )));
    }

    let mut conn = pool.acquire().await?;
    let Some(user_id) = models::user_details::get_active_user_id_by_email_case_insensitive(
        &mut conn,
        &payload.user_email,
    )
    .await?
    else {
        return token.authorized_ok(HttpResponse::BadRequest().json(UnresolvedScope {
            status: "unresolvedScope".to_string(),
            half: "userEmail".to_string(),
            value: payload.user_email.clone(),
        }));
    };

    let held_until = Utc::now() + Duration::seconds(payload.hold_secs);
    models::credit_registrations::set_test_exclusive_hold_for_testing(
        &mut conn,
        user_id,
        payload.course_id,
        held_until,
    )
    .await?;

    token.authorized_ok(HttpResponse::Ok().json(SetTestExclusiveHoldResult { held_until }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpireEnrolmentRecheckAllowancePayload {
    pub credit_registration_id: Uuid,
    /// Also forgets the day's schedule restarts, so a spec can go on restarting.
    #[serde(default)]
    pub clear_restarts: bool,
}

/// Lets a spec press a recheck button right after the last check or request, instead of waiting
/// out the limit on asking.
async fn expire_enrolment_recheck_allowance(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    payload: web::Json<ExpireEnrolmentRecheckAllowancePayload>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    models::credit_registrations::expire_enrolment_recheck_allowance_for_testing(
        &mut conn,
        payload.credit_registration_id,
        payload.clear_restarts,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().json(()))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MakeEnrolmentChecksDueResult {
    pub made_due_count: u64,
}

/// Brings the next enrolment check of every waiting row in the scope forward to now, so a spec can
/// drive a row past its first rung without waiting a day. Takes the tick's scope; the phase is
/// ignored.
async fn make_enrolment_checks_due(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    query: web::Query<RunTickQuery>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let scope = match resolve_scope(&pool, &query).await? {
        Ok(scope) if !scope.is_unscoped() => scope,
        Ok(_) => {
            return token.authorized_ok(
                HttpResponse::BadRequest().json("A scope is required, or every test's rows move."),
            );
        }
        Err(unresolved) => {
            return token.authorized_ok(HttpResponse::BadRequest().json(unresolved));
        }
    };
    let mut conn = pool.acquire().await?;
    let made_due_count =
        models::credit_registrations::make_enrolment_checks_due_for_testing(&mut conn, &scope)
            .await?;
    token.authorized_ok(HttpResponse::Ok().json(MakeEnrolmentChecksDueResult { made_due_count }))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MakeRosterListingsDueResult {
    pub made_due_count: u64,
}

/// Makes the roster listings of the scope's course due now and refills the listing limiter of the
/// scope, so a spec can list its codes again without waiting out the tier interval, a backoff or
/// the rate. Takes the tick's scope, which must name a course; the phase is ignored.
async fn make_roster_listings_due(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    query: web::Query<RunTickQuery>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let scope = match resolve_scope(&pool, &query).await? {
        Ok(scope) => scope,
        Err(unresolved) => {
            return token.authorized_ok(HttpResponse::BadRequest().json(unresolved));
        }
    };
    let Some(course_id) = scope.course_id else {
        return token.authorized_ok(
            HttpResponse::BadRequest().json("A course is required, or every test's codes move."),
        );
    };
    let mut conn = pool.acquire().await?;
    let made_due_count =
        models::credit_registration_roster_schedules::make_listings_due_for_testing(
            &mut conn, course_id,
        )
        .await?;
    rate_limit::reset(&breaker::ScopeKey::of(&scope));
    token.authorized_ok(HttpResponse::Ok().json(MakeRosterListingsDueResult { made_due_count }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentCheckScheduleQuery {
    pub credit_registration_id: Uuid,
}

/// A row's enrolment check schedule, which no product surface shows whole.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentCheckSchedule {
    pub state: models::credit_registrations::CreditRegistrationState,
    pub group: EnrolmentCheckGroup,
    pub anchor_at: Option<DateTime<Utc>>,
    pub step: Option<i32>,
    pub due_at: Option<DateTime<Utc>>,
    pub next_attempt_at: DateTime<Utc>,
    pub is_batched: bool,
    pub source: EnrolmentCheckSource,
    pub stopped_at: Option<DateTime<Utc>>,
    pub requested_at: Option<DateTime<Utc>>,
    pub restart_count: i32,
    pub checked_at: Option<DateTime<Utc>>,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub submit_retry_count: i32,
    pub error_code: Option<models::credit_registrations::CreditRegistrationErrorCode>,
    pub seen_enrolment_ids: Option<Vec<String>>,
}

async fn enrolment_check_schedule(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    query: web::Query<EnrolmentCheckScheduleQuery>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    let row =
        models::credit_registrations::get_by_id(&mut conn, query.credit_registration_id).await?;
    token.authorized_ok(HttpResponse::Ok().json(EnrolmentCheckSchedule {
        state: row.state,
        group: row.enrolment_check_group,
        anchor_at: row.enrolment_check_anchor_at,
        step: row.enrolment_check_step,
        due_at: row.enrolment_check_due_at,
        next_attempt_at: row.next_attempt_at,
        is_batched: row.is_enrolment_check_batched,
        source: row.enrolment_check_source,
        stopped_at: row.enrolment_checks_stopped_at,
        requested_at: row.enrolment_check_requested_at,
        restart_count: row.enrolment_check_restart_count,
        checked_at: row.enrolment_checked_at,
        first_failed_at: row.first_failed_at,
        submit_retry_count: row.submit_retry_count,
        error_code: row.error_code,
        seen_enrolment_ids: row.seen_enrolment_ids,
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterNewCompletionsViaSuotarPayload {
    pub course_module_id: Uuid,
}

/// Opts a module's new completions of linked students into Suotar, which only support can do by
/// hand: a spec that creates its own course needs its completions on the pipeline.
async fn register_new_completions_via_suotar(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    payload: web::Json<RegisterNewCompletionsViaSuotarPayload>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    models::course_modules::set_register_eligible_new_completions_via_suotar(
        &mut conn,
        payload.course_module_id,
        true,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().json(()))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueuedEmailsQuery {
    pub user_email: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QueuedEmail {
    pub template_type: String,
    pub placeholders: serde_json::Value,
}

/// How many of an account's mails one read looks back over. Generous: the shared test database has a
/// live pipeline queueing mail for everybody, and a short window would turn "exactly one" into a
/// false pass.
const QUEUED_EMAIL_SCAN: i64 = 200;

/// The mails queued to one account, newest first. There is no mail capture in this repo, so a spec
/// asserting a message was composed reads the send queue instead of an inbox.
async fn queued_emails(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
    query: web::Query<QueuedEmailsQuery>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let mut conn = pool.acquire().await?;
    let Some(user_id) = models::user_details::get_active_user_id_by_email_case_insensitive(
        &mut conn,
        &query.user_email,
    )
    .await?
    else {
        return token.authorized_ok(HttpResponse::BadRequest().json(UnresolvedScope {
            status: "unresolvedScope".to_string(),
            half: "userEmail".to_string(),
            value: query.user_email.clone(),
        }));
    };
    let queued = models::email_deliveries::get_recent_template_types_for_user_for_testing(
        &mut conn,
        user_id,
        QUEUED_EMAIL_SCAN,
    )
    .await?
    .into_iter()
    .map(|(template_type, placeholders)| QueuedEmail {
        template_type: serde_json::to_value(template_type)
            .ok()
            .and_then(|value| value.as_str().map(str::to_string))
            .unwrap_or_default(),
        placeholders,
    })
    .collect::<Vec<_>>();

    token.authorized_ok(HttpResponse::Ok().json(queued))
}

/// Attributed to the tick rather than to a worker, so the audit log says which traffic a test made.
fn tick_context<'a>(
    app_conf: &'a ApplicationConfiguration,
    pool: &'a PgPool,
    suotar_client: &'a SuotarClient,
) -> PhaseContext<'a> {
    PhaseContext::from_app(pool, suotar_client, app_conf, "run-tick")
}

/// The outer error is a real failure; the inner one is a scope half that names nothing.
async fn resolve_scope(
    pool: &PgPool,
    query: &RunTickQuery,
) -> anyhow::Result<Result<PhaseScope, UnresolvedScope>> {
    let mut scope = PhaseScope {
        course_id: query.course_id,
        user_id: query.user_id,
        credit_registration_ids: Vec::new(),
    };
    if let Some(slug) = &query.course_slug {
        let mut conn = pool.acquire().await?;
        let found = models::courses::get_active_course_id_by_slug(&mut conn, slug).await?;
        match found {
            Some(id) => scope.course_id = Some(id),
            None => {
                return Ok(Err(UnresolvedScope {
                    status: "unresolvedScope".to_string(),
                    half: "courseSlug".to_string(),
                    value: slug.clone(),
                }));
            }
        }
    }
    if let Some(email) = &query.user_email {
        let mut conn = pool.acquire().await?;
        let found =
            models::user_details::get_active_user_id_by_email_case_insensitive(&mut conn, email)
                .await?;
        match found {
            Some(id) => scope.user_id = Some(id),
            None => {
                return Ok(Err(UnresolvedScope {
                    status: "unresolvedScope".to_string(),
                    half: "userEmail".to_string(),
                    value: email.clone(),
                }));
            }
        }
    }
    if let Some(raw) = &query.credit_registration_ids {
        for part in raw.split(',').filter(|part| !part.trim().is_empty()) {
            match Uuid::parse_str(part.trim()) {
                Ok(id) => scope.credit_registration_ids.push(id),
                Err(_) => {
                    return Ok(Err(UnresolvedScope {
                        status: "unresolvedScope".to_string(),
                        half: "creditRegistrationIds".to_string(),
                        value: part.trim().to_string(),
                    }));
                }
            }
        }
    }
    Ok(Ok(scope))
}

fn known_phase_names() -> Vec<String> {
    CreditRegistrationPhase::ALL
        .iter()
        .map(|phase| phase.as_str().to_string())
        .collect()
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/run-tick", web::post().to(run_tick))
        .route("/run-registrar-tick", web::post().to(run_registrar_tick))
        .route("/regrade-completion", web::post().to(regrade_completion))
        .route(
            "/test-exclusive-hold",
            web::post().to(set_test_exclusive_hold),
        )
        .route(
            "/expire-enrolment-recheck-allowance",
            web::post().to(expire_enrolment_recheck_allowance),
        )
        .route(
            "/enrolment-check-schedule",
            web::get().to(enrolment_check_schedule),
        )
        .route(
            "/make-enrolment-checks-due",
            web::post().to(make_enrolment_checks_due),
        )
        .route(
            "/make-roster-listings-due",
            web::post().to(make_roster_listings_due),
        )
        .route(
            "/register-new-completions-via-suotar",
            web::post().to(register_new_completions_via_suotar),
        )
        .route("/queued-emails", web::get().to(queued_emails))
        .configure(commands::_add_routes);
}

#[cfg(test)]
mod tests {
    use actix_web::{App, http::StatusCode, test, web::Data};

    use super::*;
    use crate::controllers::configure_controllers;

    /// The mock config is present either way; `test_suotar` alone decides whether the routes exist.
    fn app_conf(test_suotar: bool) -> ApplicationConfiguration {
        ApplicationConfiguration {
            test_suotar,
            ..ApplicationConfiguration::mock_conf()
                .expect("the mock configuration is built from constants")
        }
    }

    /// Registers the real controller tree so the test sees the same gate production does. The pool is
    /// never connected, so only phases that answer before they would need one can be driven here.
    async fn call_run_tick(
        test_suotar: bool,
        query: &str,
    ) -> actix_web::dev::ServiceResponse<actix_web::body::BoxBody> {
        let app_conf = Data::new(app_conf(test_suotar));
        let pool = Data::new(
            PgPool::connect_lazy("postgres://headless-lms@localhost:54328/headless_lms_dev")
                .expect("a lazy pool only parses the url"),
        );
        let service = test::init_service(
            App::new()
                .app_data(pool)
                .app_data(Data::new(SuotarClient::mock_for_test()))
                .app_data(app_conf.clone())
                .service(
                    web::scope("/api/v0")
                        .configure(|cfg| configure_controllers(cfg, app_conf.clone())),
                ),
        )
        .await;
        let req = test::TestRequest::post()
            .uri(&format!("/api/v0/mock-suotar/control/run-tick{query}"))
            .to_request();
        test::call_service(&service, req).await
    }

    /// Without the flag the routes must be absent, not merely refuse.
    #[actix_web::test]
    async fn run_tick_is_absent_when_the_mock_is_disabled() {
        let res = call_run_tick(false, "?phase=verify").await;
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    /// A caller that asked to be narrowed and cannot be must be told, not quietly run wide over a
    /// shared database.
    #[actix_web::test]
    async fn a_scope_a_phase_cannot_apply_is_refused() {
        let res = call_run_tick(
            true,
            &format!("?phase=retention-sweep&courseId={}", Uuid::new_v4()),
        )
        .await;
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        let body: PhaseTickResult = test::read_body_json(res).await;
        assert_eq!(
            body,
            PhaseTickResult::ScopeNotSupported {
                phase: "retention-sweep".to_string()
            }
        );
    }

    #[actix_web::test]
    async fn an_invented_phase_name_is_rejected() {
        let res = call_run_tick(true, "?phase=materialise").await;
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        let body: PhaseTickResult = test::read_body_json(res).await;
        assert_eq!(
            body,
            PhaseTickResult::UnknownPhase {
                phase: Some("materialise".to_string()),
                known_phases: known_phase_names(),
            }
        );
    }
}
