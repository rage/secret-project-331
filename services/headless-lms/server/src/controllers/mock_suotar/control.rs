//! The mock Suotar control surface: test-only routes that are not part of Suotar's API.
//!
//! A tick runs one iteration of one phase synchronously: the real loops are long-running
//! `tokio::time::interval`s in their own Deployments, which a Playwright spec cannot wait out inside
//! its 100 s timeout.
//!
//! Reachable only when `test_mode && test_suotar`, so no token. Not exported to utoipa or
//! `bindings.ts`; Playwright uses a hand-written client (`system-tests/src/utils/suotarControl.ts`).

use crate::domain::credit_registration_phases::{
    CreditRegistrationPhase, PhaseTick, run_phase_once,
};
use crate::prelude::*;
use sqlx::PgPool;

#[derive(Debug, Deserialize)]
pub struct RunTickQuery {
    /// Optional so a missing phase answers our typed error listing the valid names, not actix's 400.
    pub phase: Option<String>,
}

/// The outcome of dispatching one phase.
#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum PhaseTickResult {
    Ran {
        phase: String,
        items_processed: i32,
        items_failed: i32,
        /// Set when the iteration ran but failed; already scrubbed by the phase.
        error: Option<String>,
    },
    /// No implementation is registered for this phase in `run_phase_once` yet.
    PhaseNotImplemented { phase: String },
    /// The `?phase=` value is not one of the twelve canonical names.
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
            PhaseTick::NotImplemented => Self::PhaseNotImplemented {
                phase: phase.as_str().to_string(),
            },
        }
    }
}

/// What `run-registrar-tick` returns: one entry per phase in the sequence, in the order they ran.
#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistrarTickResult {
    pub phases: Vec<PhaseTickResult>,
}

/**
POST `/api/v0/mock-suotar/control/run-tick?phase={phase}`

Runs one iteration of one pipeline phase. 200 when the phase ran, 501 `phaseNotImplemented` when no
implementation is registered for it, 400 `unknownPhase` for a name that is not a phase.
*/
async fn run_tick(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
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

    let result = PhaseTickResult::of(phase, run_phase_once(&pool, phase).await?);
    token.authorized_ok(match &result {
        PhaseTickResult::Ran { .. } => HttpResponse::Ok().json(&result),
        _ => HttpResponse::NotImplemented().json(&result),
    })
}

/**
POST `/api/v0/mock-suotar/control/run-registrar-tick`

The combined form of `run-tick`: materialize, preconditions, resolve-enrolments, import and verify in
pipeline order, for specs that want a completion walked end to end. Always 200; each phase reports
its own status in the body.
*/
async fn run_registrar_tick(
    app_conf: web::Data<ApplicationConfiguration>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();

    let mut phases = Vec::new();
    for phase in CreditRegistrationPhase::REGISTRAR_TICK_SEQUENCE {
        phases.push(PhaseTickResult::of(
            phase,
            run_phase_once(&pool, phase).await?,
        ));
    }
    token.authorized_ok(HttpResponse::Ok().json(RegistrarTickResult { phases }))
}

fn known_phase_names() -> Vec<String> {
    CreditRegistrationPhase::ALL
        .iter()
        .map(|phase| phase.as_str().to_string())
        .collect()
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/run-tick", web::post().to(run_tick))
        .route("/run-registrar-tick", web::post().to(run_registrar_tick));
}

#[cfg(test)]
mod tests {
    use actix_web::{App, http::StatusCode, test, web::Data};
    use headless_lms_base::config::{OAuthServerConfiguration, SuotarConfiguration};
    use secrecy::{SecretBox, SecretString};
    use std::sync::Arc;

    use super::*;
    use crate::controllers::configure_controllers;

    /// The mock config is present either way; `test_suotar` alone decides whether the routes exist.
    fn app_conf(test_suotar: bool) -> ApplicationConfiguration {
        ApplicationConfiguration {
            base_url: "http://project-331.local".to_string(),
            test_mode: true,
            test_chatbot: false,
            test_sisu: false,
            test_suotar,
            development_uuid_login: false,
            enable_admin_email_verification: false,
            azure_configuration: None,
            suotar_configuration: SuotarConfiguration::mock_conf("http://project-331.local")
                .expect("the mock configuration is built from a constant base url"),
            tmc_account_creation_origin: None,
            tmc_admin_access_token: SecretString::new("mock-access-token".to_string().into()),
            oauth_server_configuration: OAuthServerConfiguration {
                rsa_public_key: "test".into(),
                rsa_private_key: SecretString::new("test".into()),
                oauth_token_hmac_key: SecretString::new("test".into()),
                dpop_nonce_key: Arc::new(SecretBox::new(Box::new("test".into()))),
            },
        }
    }

    /// Registers the real controller tree so the test sees the same gate production does. The pool is
    /// lazy and never connected: an unimplemented phase answers before it would need one.
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

    #[actix_web::test]
    async fn run_tick_reports_phase_not_implemented_when_the_mock_is_enabled() {
        let res = call_run_tick(true, "?phase=verify").await;
        assert_eq!(res.status(), StatusCode::NOT_IMPLEMENTED);
        let body: PhaseTickResult = test::read_body_json(res).await;
        assert_eq!(
            body,
            PhaseTickResult::PhaseNotImplemented {
                phase: "verify".to_string()
            }
        );
    }

    /// Without the flag the routes must be absent, not merely refuse.
    #[actix_web::test]
    async fn run_tick_is_absent_when_the_mock_is_disabled() {
        let res = call_run_tick(false, "?phase=verify").await;
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn every_canonical_phase_name_dispatches() {
        for phase in CreditRegistrationPhase::ALL {
            let res = call_run_tick(true, &format!("?phase={}", phase.as_str())).await;
            assert_eq!(
                res.status(),
                StatusCode::NOT_IMPLEMENTED,
                "phase {} did not dispatch",
                phase.as_str()
            );
        }
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
