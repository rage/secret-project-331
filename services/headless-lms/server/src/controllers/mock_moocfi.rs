/*!
Mock mooc.fi: a stand-in for mooc.fi's delegated credit registration routes, and the control surface
tests seed it through.

Mounted at `/api/v0/mock-moocfi` only when `TEST_MODE` and `USE_MOCK_MOOCFI_ENDPOINT` are both on.
State is in memory, shared by the server's workers and lost on restart, so a test seeds what it
reads. Serves:

- `GET api/delegated-completions/{course_id}/users/{upstream_id}`, `GET api/delegated-courses/{course_id}`
  and `POST api/register-completions`, as mooc.fi does, behind the mock organization secret;
- `register-completion/{slug}`, a stand-in for mooc.fi's registration page whose button mints a
  handoff through `api/credit-registration-handoff/{slug}` as mooc.fi's backend does;
- `[en/]credit-registration-handoff/`, a stand-in for mooc.fi's landing for handoffs from courses,
  which redeems the token through `api/courses-handoff/redeem` as mooc.fi's backend does;
- `control/...` to seed completions, set whether a course has a certificate, read the recorded
  report-back calls, simulate an outage and forget one student.
*/

use std::collections::HashSet;
use std::sync::Mutex;

use headless_lms_base::config::{
    MOCK_MOOCFI_HANDOFF_SECRET, MOCK_MOOCFI_ORGANIZATION_SECRET, MOCK_MOOCFI_ORGANIZATION_SLUG,
};
use headless_lms_utils::services::moocfi::{
    DelegatedCompletion, DelegatedCompletionRegistration, DelegatedCourse,
    RegisterCompletionsRequest,
};
use once_cell::sync::Lazy;
use secrecy::ExposeSecret;

use crate::domain::authentication::{authorization_credential, constant_time_eq_str};
use crate::domain::rate_limit_middleware_builder::request_client_ip;
use crate::prelude::*;

static STATE: Lazy<Mutex<MockMoocfiState>> = Lazy::new(Default::default);

#[derive(Default)]
struct MockMoocfiState {
    completions: Vec<MockCompletion>,
    register_calls: Vec<RecordedRegisterCall>,
    is_unavailable: bool,
    /// Students whose lookups fail while every other student's work, so a spec can simulate an
    /// outage without breaking the specs running beside it.
    unavailable_upstream_ids: HashSet<i32>,
    /// Courses answer `has_certificate: true` unless listed here.
    courses_without_certificate: HashSet<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MockCompletion {
    /// The TMC user id the completion belongs to; the lookup is keyed on it.
    user_upstream_id: i32,
    #[serde(flatten)]
    completion: DelegatedCompletion,
}

/// One `register-completions` call as the mock received it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedRegisterCall {
    pub received_at: DateTime<Utc>,
    pub completions: Vec<RecordedRegistration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedRegistration {
    pub completion_id: Uuid,
    pub student_number: String,
    pub registration_date: DateTime<Utc>,
}

/// A completion to seed. Omitted fields get a fresh id, the current time and no registrations.
#[derive(Debug, Deserialize)]
pub struct MockCompletionSeed {
    id: Option<Uuid>,
    course_id: Uuid,
    user_upstream_id: i32,
    completion_date: Option<DateTime<Utc>>,
    created_at: Option<DateTime<Utc>>,
    completion_language: Option<String>,
    grade: Option<String>,
    tier: Option<i32>,
    eligible_for_ects: Option<bool>,
    #[serde(default)]
    registrations: Vec<DelegatedCompletionRegistration>,
}

#[derive(Debug, Deserialize)]
pub struct MockAvailability {
    is_available: bool,
    /// Narrows the change to this student's lookups; absent changes every route.
    user_upstream_id: Option<i32>,
}

fn state() -> std::sync::MutexGuard<'static, MockMoocfiState> {
    // A test that panicked mid-update leaves nothing half-written worth refusing over.
    STATE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn assert_enabled(app_conf: &ApplicationConfiguration) {
    assert!(app_conf.test_mode && app_conf.test_moocfi);
}

fn is_organization(request: &HttpRequest) -> bool {
    authorization_credential(request, "Basic")
        .is_some_and(|secret| constant_time_eq_str(secret, MOCK_MOOCFI_ORGANIZATION_SECRET))
}

/// mooc.fi's `GET /api/delegated-completions/:course_id/users/:upstream_id`.
async fn get_delegated_completions(
    request: HttpRequest,
    app_conf: web::Data<ApplicationConfiguration>,
    path: web::Path<(Uuid, i32)>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    let (course_id, upstream_id) = path.into_inner();
    if !is_organization(&request) {
        return token.authorized_ok(HttpResponse::Forbidden().finish());
    }
    let state = state();
    if state.is_unavailable || state.unavailable_upstream_ids.contains(&upstream_id) {
        return token.authorized_ok(HttpResponse::ServiceUnavailable().finish());
    }
    let completions: Vec<&DelegatedCompletion> = state
        .completions
        .iter()
        .filter(|mock| {
            mock.completion.course_id == course_id && mock.user_upstream_id == upstream_id
        })
        .map(|mock| &mock.completion)
        .collect();
    token.authorized_ok(HttpResponse::Ok().json(completions))
}

/// mooc.fi's `POST /api/register-completions`: records the call and marks each completion
/// registered by our organization.
async fn register_completions(
    request: HttpRequest,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<RegisterCompletionsRequest>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    if !is_organization(&request) {
        return token.authorized_ok(HttpResponse::Forbidden().finish());
    }
    let mut state = state();
    if state.is_unavailable {
        return token.authorized_ok(HttpResponse::ServiceUnavailable().finish());
    }
    let now = Utc::now();
    for report in &payload.completions {
        if let Some(mock) = state
            .completions
            .iter_mut()
            .find(|mock| mock.completion.id == report.completion_id)
        {
            let registrations = &mut mock.completion.registrations;
            if !registrations.iter().any(|registration| {
                registration.organization_slug.as_deref() == Some(MOCK_MOOCFI_ORGANIZATION_SLUG)
            }) {
                registrations.push(DelegatedCompletionRegistration {
                    organization_slug: Some(MOCK_MOOCFI_ORGANIZATION_SLUG.to_string()),
                    registration_date: Some(report.registration_date),
                    created_at: now,
                });
            }
        }
    }
    let call = RecordedRegisterCall {
        received_at: now,
        completions: payload
            .completions
            .iter()
            .map(|report| RecordedRegistration {
                completion_id: report.completion_id,
                student_number: report.student_number.expose_secret().to_string(),
                registration_date: report.registration_date,
            })
            .collect(),
    };
    state.register_calls.push(call);
    token.authorized_ok(HttpResponse::Ok().json(serde_json::json!({ "message": "success" })))
}

/// mooc.fi's `GET /api/delegated-courses/:course_id`, answered from our own targets of the course.
async fn get_delegated_course(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    if !is_organization(&request) {
        return token.authorized_ok(HttpResponse::Forbidden().finish());
    }
    let has_certificate = {
        let state = state();
        if state.is_unavailable {
            return token.authorized_ok(HttpResponse::ServiceUnavailable().finish());
        }
        !state.courses_without_certificate.contains(&course_id)
    };
    let mut conn = pool.acquire().await?;
    let targets =
        models::external_credit_targets::get_by_moocfi_course_id(&mut conn, *course_id).await?;
    let Some(target) = targets.first() else {
        return token.authorized_ok(HttpResponse::NotFound().finish());
    };
    token.authorized_ok(HttpResponse::Ok().json(DelegatedCourse {
        id: *course_id,
        slug: target.moocfi_course_slug.clone(),
        name: target.name.clone(),
        has_certificate,
        link: None,
        credit_registration_delegated_at: Some(target.delegated_at),
    }))
}

#[derive(Debug, Deserialize)]
pub struct MockCourseSettings {
    has_certificate: bool,
}

/// Sets what `api/delegated-courses/{course_id}` says about the course's certificate, and stores it
/// on our targets as the daily configuration check would, so a spec need not wait for the cached
/// details to age.
async fn set_course_settings(
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    course_id: web::Path<Uuid>,
    payload: web::Json<MockCourseSettings>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    {
        let mut state = state();
        if payload.has_certificate {
            state.courses_without_certificate.remove(&course_id);
        } else {
            state.courses_without_certificate.insert(*course_id);
        }
    }
    let mut conn = pool.acquire().await?;
    models::external_credit_targets::record_moocfi_course_details(
        &mut conn,
        *course_id,
        payload.has_certificate,
    )
    .await?;
    token.authorized_ok(HttpResponse::NoContent().finish())
}

/// Upserts completions by id.
async fn seed_completions(
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<Vec<MockCompletionSeed>>,
) -> ControllerResult<web::Json<Vec<DelegatedCompletion>>> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    let now = Utc::now();
    let mut state = state();
    let mut seeded = Vec::new();
    for seed in payload.into_inner() {
        let completion = DelegatedCompletion {
            id: seed.id.unwrap_or_else(Uuid::new_v4),
            course_id: seed.course_id,
            completion_date: seed.completion_date,
            created_at: seed.created_at.unwrap_or(now),
            updated_at: Some(now),
            completion_language: seed.completion_language,
            grade: seed.grade,
            tier: seed.tier,
            eligible_for_ects: seed.eligible_for_ects,
            registrations: seed.registrations,
        };
        state
            .completions
            .retain(|mock| mock.completion.id != completion.id);
        state.completions.push(MockCompletion {
            user_upstream_id: seed.user_upstream_id,
            completion: completion.clone(),
        });
        seeded.push(completion);
    }
    token.authorized_ok(web::Json(seeded))
}

/// Deletes a completion, as an admin deleting it on mooc.fi would.
async fn delete_completion(
    app_conf: web::Data<ApplicationConfiguration>,
    completion_id: web::Path<Uuid>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    state()
        .completions
        .retain(|mock| mock.completion.id != *completion_id);
    token.authorized_ok(HttpResponse::NoContent().finish())
}

/// Every `register-completions` call since the last reset, oldest first.
async fn get_register_calls(
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Vec<RecordedRegisterCall>>> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    token.authorized_ok(web::Json(state().register_calls.clone()))
}

/// Makes the API routes, or one student's lookups, answer 503 until made available again.
async fn set_availability(
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<MockAvailability>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    let mut state = state();
    match payload.user_upstream_id {
        Some(upstream_id) if payload.is_available => {
            state.unavailable_upstream_ids.remove(&upstream_id);
        }
        Some(upstream_id) => {
            state.unavailable_upstream_ids.insert(upstream_id);
        }
        None => state.is_unavailable = !payload.is_available,
    }
    token.authorized_ok(HttpResponse::NoContent().finish())
}

/// Forgets one student's completions, the register calls about them and their outage, so a spec
/// can start over without resetting what the specs beside it seeded.
async fn forget_user(
    app_conf: web::Data<ApplicationConfiguration>,
    upstream_id: web::Path<i32>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    let upstream_id = upstream_id.into_inner();
    let mut state = state();
    let forgotten: HashSet<Uuid> = state
        .completions
        .iter()
        .filter(|mock| mock.user_upstream_id == upstream_id)
        .map(|mock| mock.completion.id)
        .collect();
    state
        .completions
        .retain(|mock| mock.user_upstream_id != upstream_id);
    state.register_calls.retain(|call| {
        !call
            .completions
            .iter()
            .any(|registration| forgotten.contains(&registration.completion_id))
    });
    state.unavailable_upstream_ids.remove(&upstream_id);
    token.authorized_ok(HttpResponse::NoContent().finish())
}

async fn reset(app_conf: web::Data<ApplicationConfiguration>) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    *state() = MockMoocfiState::default();
    token.authorized_ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, Deserialize)]
pub struct RegistrationPageQuery {
    /// The student's TMC token, which mooc.fi's page would have in a cookie. Test tokens work. The
    /// page remembers the last one it was given.
    #[serde(default)]
    tmc_access_token: String,
}

/// mooc.fi's registration page, reduced to its "Register in courses.mooc.fi" button.
async fn registration_page(
    app_conf: web::Data<ApplicationConfiguration>,
    slug: web::Path<String>,
    query: web::Query<RegistrationPageQuery>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    // Inside a script element `</script>` would end it, so `<` is escaped too.
    let js_string = |value: &str| -> Result<String, serde_json::Error> {
        Ok(serde_json::to_string(value)?.replace('<', "\\u003c"))
    };
    let html = format!(
        r#"<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Mock mooc.fi registration</title></head>
<body>
<h1>Mock mooc.fi registration</h1>
<button id="register" type="button">Register in courses.mooc.fi</button>
<p id="error" role="alert"></p>
<script>
const slug = {slug};
// Kept like mooc.fi keeps its login cookie, so a link back to this page without the token works.
const TOKEN_KEY = "mock-moocfi-tmc-access-token";
if ({tmc_access_token}) {{
  localStorage.setItem(TOKEN_KEY, {tmc_access_token});
}}
const tmcAccessToken = localStorage.getItem(TOKEN_KEY) ?? "";
document.getElementById("register").addEventListener("click", async () => {{
  const button = document.getElementById("register");
  button.textContent = "Opening courses.mooc.fi…";
  const response = await fetch(
    "/api/v0/mock-moocfi/api/credit-registration-handoff/" + encodeURIComponent(slug),
    {{ method: "POST", headers: {{ Authorization: "Bearer " + tmcAccessToken }} }},
  );
  if (!response.ok) {{
    button.textContent = "Register in courses.mooc.fi";
    document.getElementById("error").textContent = "Could not open courses.mooc.fi, try again";
    return;
  }}
  const {{ redirect_url }} = await response.json();
  window.location.assign(redirect_url);
}});
</script>
</body>
</html>"#,
        slug = js_string(&slug)?,
        tmc_access_token = js_string(&query.tmc_access_token)?,
    );
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(html),
    )
}

/// mooc.fi's `POST /api/credit-registration-handoff/:slug`: mints a handoff for the student whose
/// TMC token the page sends, and passes the mint's answer on.
async fn create_handoff(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    slug: web::Path<String>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    let Some(tmc_access_token) = authorization_credential(&request, "Bearer").map(str::to_string)
    else {
        return token.authorized_ok(HttpResponse::Unauthorized().finish());
    };
    let Some(client_ip) = request_client_ip(&request) else {
        return token.authorized_ok(HttpResponse::BadRequest().finish());
    };
    let mut conn = pool.acquire().await?;
    let Some(moocfi_course_id) =
        models::external_credit_targets::get_moocfi_course_id_by_slug(&mut conn, &slug).await?
    else {
        return token.authorized_ok(HttpResponse::NotFound().finish());
    };
    let Some(delegated_at) =
        models::external_credit_targets::get_by_moocfi_course_id(&mut conn, moocfi_course_id)
            .await?
            .first()
            .map(|target| target.delegated_at)
    else {
        return token.authorized_ok(HttpResponse::NotFound().finish());
    };
    drop(conn);

    let mint_url = url::Url::parse(&app_conf.base_url)
        .and_then(|base_url| base_url.join("/api/v0/moocfi/credit-registration-handoffs"))
        .map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Invalid BASE_URL".to_string(),
                Some(error.into()),
            )
        })?;
    let response = REQWEST_CLIENT
        .post(mint_url)
        .bearer_auth(MOCK_MOOCFI_HANDOFF_SECRET)
        .json(&serde_json::json!({
            "tmc_access_token": tmc_access_token,
            "moocfi_course_id": moocfi_course_id,
            "delegated_at": delegated_at,
            "client_ip": client_ip.to_string(),
        }))
        .send()
        .await
        .map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "The mint could not be reached".to_string(),
                Some(error.into()),
            )
        })?;
    let status = actix_web::http::StatusCode::from_u16(response.status().as_u16())
        .unwrap_or(actix_web::http::StatusCode::BAD_GATEWAY);
    let body = response.bytes().await.unwrap_or_default();
    token.authorized_ok(
        HttpResponse::build(status)
            .content_type("application/json")
            .body(body),
    )
}

/// mooc.fi's landing for handoffs from courses, reduced to redeeming the token and naming the result.
async fn handoff_landing_page(
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    let html = r#"<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Mock mooc.fi handoff</title></head>
<body>
<h1 id="heading">Opening mooc.fi…</h1>
<p id="details"></p>
<p><a id="back" hidden>Back to courses.mooc.fi</a></p>
<script>
const token = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
history.replaceState(null, "", window.location.pathname + window.location.search);
const heading = document.getElementById("heading");
const details = document.getElementById("details");
fetch("/api/v0/mock-moocfi/api/courses-handoff/redeem", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token }),
}).then(async (response) => {
  if (response.status === 410) {
    heading.textContent = "This link has expired or has been used";
    return;
  }
  if (!response.ok) {
    heading.textContent = "This link does not work";
    return;
  }
  const result = await response.json();
  heading.textContent = "Mock mooc.fi certificate";
  details.textContent =
    "Signed in as TMC user " + result.upstream_id + ", going to " + result.destination_path;
  const back = document.getElementById("back");
  back.href = "/completion-registration/mooc-fi/" + result.moocfi_course_id;
  back.hidden = false;
});
</script>
</body>
</html>"#;
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(html),
    )
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CoursesHandoffRedeemRequest {
    token: String,
}

#[derive(Debug, Deserialize)]
struct RedeemedHandoff {
    upstream_id: i32,
    moocfi_course_id: Uuid,
    destination: String,
}

/// mooc.fi's `POST /api/courses-handoff/redeem`: redeems the token with courses and resolves the
/// destination to a mooc.fi path. Signs no one in; the page only names whom mooc.fi would.
async fn redeem_courses_handoff(
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<CoursesHandoffRedeemRequest>,
) -> ControllerResult<HttpResponse> {
    assert_enabled(&app_conf);
    let token = skip_authorize();
    let redeem_url = url::Url::parse(&app_conf.base_url)
        .and_then(|base_url| base_url.join("/api/v0/moocfi/outbound-handoffs/redeem"))
        .map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Invalid BASE_URL".to_string(),
                Some(error.into()),
            )
        })?;
    let response = REQWEST_CLIENT
        .post(redeem_url)
        .bearer_auth(MOCK_MOOCFI_HANDOFF_SECRET)
        .json(&payload.into_inner())
        .send()
        .await
        .map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "The redeem could not be reached".to_string(),
                Some(error.into()),
            )
        })?;
    if !response.status().is_success() {
        let status = actix_web::http::StatusCode::from_u16(response.status().as_u16())
            .unwrap_or(actix_web::http::StatusCode::BAD_GATEWAY);
        return token.authorized_ok(HttpResponse::build(status).finish());
    }
    let redeemed: RedeemedHandoff = response.json().await.map_err(|error| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "The redeem answered something unexpected".to_string(),
            Some(error.into()),
        )
    })?;
    let mut conn = pool.acquire().await?;
    let slug = models::external_credit_targets::get_by_moocfi_course_id(
        &mut conn,
        redeemed.moocfi_course_id,
    )
    .await?
    .first()
    .map(|target| target.moocfi_course_slug.clone())
    .unwrap_or_default();
    token.authorized_ok(HttpResponse::Ok().json(serde_json::json!({
        "upstream_id": redeemed.upstream_id,
        "moocfi_course_id": redeemed.moocfi_course_id,
        "destination_path": format!("/register-completion/{slug}/{}", redeemed.destination),
    })))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/api/delegated-completions/{course_id}/users/{upstream_id}",
        web::get().to(get_delegated_completions),
    )
    .route(
        "/api/register-completions",
        web::post().to(register_completions),
    )
    .route(
        "/api/credit-registration-handoff/{slug}",
        web::post().to(create_handoff),
    )
    .route(
        "/api/delegated-courses/{course_id}",
        web::get().to(get_delegated_course),
    )
    .route(
        "/api/courses-handoff/redeem",
        web::post().to(redeem_courses_handoff),
    )
    .route(
        "/register-completion/{slug}",
        web::get().to(registration_page),
    )
    .route(
        "/credit-registration-handoff/",
        web::get().to(handoff_landing_page),
    )
    .route(
        "/en/credit-registration-handoff/",
        web::get().to(handoff_landing_page),
    )
    .route(
        "/control/courses/{course_id}",
        web::put().to(set_course_settings),
    )
    .route("/control/completions", web::post().to(seed_completions))
    .route(
        "/control/completions/{completion_id}",
        web::delete().to(delete_completion),
    )
    .route(
        "/control/users/{upstream_id}",
        web::delete().to(forget_user),
    )
    .route("/control/register-calls", web::get().to(get_register_calls))
    .route("/control/availability", web::put().to(set_availability))
    .route("/control/reset", web::post().to(reset));
}
