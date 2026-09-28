//! The control surface's command, health and world-dump routes.

use serde_json::json;
use sqlx::PgPool;

use crate::mock_suotar::commands::{
    CommandResult, MockSuotarCommand, WORLD_DUMP_CALL_LIMIT, execute,
};
use crate::mock_suotar::default_world;
use crate::mock_suotar::store::{EntityHash, MockSuotarStore};
use crate::mock_suotar::world::{
    MockAttainment, MockCourseUnit, MockEnrolment, MockPerson, MockSubmission,
};
use crate::prelude::*;

pub async fn health(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let db_generation = default_world::db_generation_marker(&pool).await;
    let generation = match store.live_generation().await {
        Ok(generation) => generation,
        Err(error) => return token.authorized_ok(internal_error(&error)),
    };
    let body = match &generation {
        Some(generation) => {
            let (counts, preamble) = match (
                store.counts(generation).await,
                store.preamble(generation).await,
            ) {
                (Ok(counts), Ok(preamble)) => (counts, preamble),
                (Err(error), _) | (_, Err(error)) => {
                    return token.authorized_ok(internal_error(&error));
                }
            };
            json!({
                "enabled": true,
                "generation": generation,
                "dbGeneration": db_generation,
                "worldDbGeneration": preamble.db_generation,
                "generationMatches": preamble.db_generation.is_some()
                    && preamble.db_generation == db_generation,
                "counts": counts,
                "defaults": preamble.defaults,
            })
        }
        // Never installs one: a health check that built a world could not report an empty one.
        None => json!({
            "enabled": true,
            "generation": serde_json::Value::Null,
            "dbGeneration": db_generation,
            "worldDbGeneration": serde_json::Value::Null,
            "generationMatches": false,
            "counts": serde_json::Value::Null,
            "defaults": serde_json::Value::Null,
        }),
    };
    token.authorized_ok(HttpResponse::Ok().json(body))
}

pub async fn world(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let Some(generation) = (match store.live_generation().await {
        Ok(generation) => generation,
        Err(error) => return token.authorized_ok(internal_error(&error)),
    }) else {
        return token.authorized_ok(HttpResponse::Ok().json(json!({ "generation": null })));
    };
    match dump(&store, &generation).await {
        Ok(body) => token.authorized_ok(HttpResponse::Ok().json(body)),
        Err(error) => token.authorized_ok(internal_error(&error)),
    }
}

async fn dump(store: &MockSuotarStore, generation: &str) -> anyhow::Result<serde_json::Value> {
    let preamble = store.preamble(generation).await?;
    let counts = store.counts(generation).await?;
    Ok(json!({
        "generation": generation,
        "defaults": preamble.defaults,
        "persons": store.all_json::<MockPerson>(generation, EntityHash::Persons).await?,
        "courseUnits": store.all_json::<MockCourseUnit>(generation, EntityHash::CourseUnits).await?,
        "enrolments": store.all_json::<MockEnrolment>(generation, EntityHash::Enrolments).await?,
        "attainments": store.all_json::<MockAttainment>(generation, EntityHash::Attainments).await?,
        "submissions": store.all_json::<MockSubmission>(generation, EntityHash::Submissions).await?,
        "sisuViolations": store.all_json::<Vec<String>>(generation, EntityHash::SisuViolations).await?,
        "faults": store.faults(generation).await?,
        "calls": store.recent_calls(generation, WORLD_DUMP_CALL_LIMIT).await?,
        "callLogLen": counts.call_log_len,
    }))
}

pub async fn command(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let parsed: MockSuotarCommand = match serde_json::from_slice(&body) {
        Ok(parsed) => parsed,
        Err(error) => {
            return token.authorized_ok(HttpResponse::BadRequest().json(CommandResult::Error {
                command: None,
                code: "unknownCommand".to_string(),
                message: error.to_string(),
            }));
        }
    };
    let result = execute(&store, &pool, parsed).await;
    token.authorized_ok(match &result {
        CommandResult::Ok { .. } => HttpResponse::Ok().json(&result),
        CommandResult::NotImplemented { .. } => HttpResponse::NotImplemented().json(&result),
        CommandResult::Error { code, .. } if code == "internalError" => {
            HttpResponse::InternalServerError().json(&result)
        }
        CommandResult::Error { .. } => HttpResponse::BadRequest().json(&result),
    })
}

fn internal_error(error: &anyhow::Error) -> HttpResponse {
    error!("mock Suotar control failure: {error:?}");
    HttpResponse::InternalServerError().json(CommandResult::Error {
        command: None,
        code: "internalError".to_string(),
        message: error.to_string(),
    })
}

/// Nothing here is exported to utoipa or `bindings.ts`; no mock's DTOs are.
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/command", web::post().to(command))
        .route("/health", web::get().to(health))
        .route("/world", web::get().to(world));
}
