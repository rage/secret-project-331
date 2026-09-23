//! The moocfi endpoints, one stage boundary at a time.
//!
//! Order per request, as Suotar's middleware runs it: the JSON body parse (size, then syntax), the
//! credential, the envelope and item validation, the item-keyed load, the `auth`/`requestGate`/
//! `parse` faults, `resolve` request-level then per item, then `afterWrite` and `respond`. The
//! write-back commits before the response — or its deliberate absence — leaves the process, which is
//! what makes a timeout that landed distinguishable from one that did not.

use std::collections::{BTreeSet, HashMap};

use futures::StreamExt;
use itertools::Itertools;
use serde::de::DeserializeOwned;
use sqlx::PgPool;

use crate::prelude::*;

use super::default_world;
use super::faults::{Effect, Fault, FaultMatch, ItemAddress, Stage, matches_item, matches_request};
use super::logic::{self, ImportResolution};
use super::store::{MockSuotarStore, Preamble};
use super::wire::{
    self, Endpoint, ItemStatus, NOT_AN_ARRAY, RequestLevelError, ResponseItem, SubmittedAttainment,
};
use super::world::{
    MissedFault, MockSubmission, RecordedCall, RecordedFaults, RecordedItem, SendState, WorkingSet,
    WorldWrite,
};

const RAW_BODY_LIMIT: usize = 8 * 1024;

/// Express's `5mb`.
const MAX_BODY_BYTES: usize = 5 * 1024 * 1024;

const IMPORT_STRING_FIELDS: [&str; 7] = [
    "studentNumber",
    "courseCode",
    "enrolmentId",
    "attainmentDate",
    "attainmentLanguage",
    "gradeScaleId",
    "gradeId",
];

/// Actix binds one handler per route, so the endpoint each route serves is all these differ by.
macro_rules! endpoint_handlers {
    ($($handler:ident => $endpoint:ident,)*) => {
        $(
            pub async fn $handler(
                app_conf: web::Data<ApplicationConfiguration>,
                store: web::Data<MockSuotarStore>,
                pool: web::Data<PgPool>,
                req: HttpRequest,
                payload: web::Payload,
            ) -> ControllerResult<HttpResponse> {
                endpoint(Endpoint::$endpoint, app_conf, store, pool, req, payload).await
            }
        )*
    };
}

endpoint_handlers! {
    resolve_persons => ResolvePersons,
    resolve_enrolments => ResolveEnrolments,
    list_by_course => ListByCourse,
    import_attainments => ImportAttainments,
    verify_attainments => VerifyAttainments,
    validate_course_codes => ValidateCourseCodes,
}

async fn endpoint(
    endpoint: Endpoint,
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    payload: web::Payload,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let body = read_body(payload).await;
    let delivery = match run(endpoint, &store, &pool, &req, &body).await {
        Ok(delivery) => delivery,
        Err(error) => {
            // A store failure is loud: silent degradation is wrong for something tests assert against.
            error!("mock Suotar failed to serve a request: {error:?}");
            Delivery::json(500, &RequestLevelError::new("internalError"))
        }
    };
    token.authorized_ok(deliver(delivery))
}

/// Anything under the prefix that no route serves, including a wrong method. A valid key falls
/// through to Suotar's internal routes, whose refusal is a bare string rather than the envelope.
pub async fn fall_through(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    payload: web::Payload,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let body = read_body(payload).await;
    let delivery = match resolve_world(&store, &pool).await {
        Ok((_, preamble)) => {
            match pre_route_rejection(&parse_body(&req, &body), authorized(&req, &preamble)) {
                Some((status, error)) => Delivery::json(status, &error),
                None => Delivery::json(401, &serde_json::json!({ "error": "Unauthorized access" })),
            }
        }
        Err(error) => {
            error!("mock Suotar failed to serve a request: {error:?}");
            Delivery::json(500, &RequestLevelError::new("internalError"))
        }
    };
    token.authorized_ok(deliver(delivery))
}

fn deliver(delivery: Delivery) -> HttpResponse {
    let status_of = |status: u16| {
        actix_web::http::StatusCode::from_u16(status).unwrap_or(actix_web::http::StatusCode::OK)
    };
    match delivery {
        Delivery::Json { status, body } => HttpResponse::build(status_of(status))
            .content_type("application/json")
            .body(body),
        Delivery::Raw {
            status,
            body,
            content_type,
        } => HttpResponse::build(status_of(status))
            .content_type(content_type)
            .body(body),
        Delivery::ConnectionReset => {
            let stream = futures::stream::once(async {
                Err::<web::Bytes, actix_web::Error>(actix_web::error::ErrorInternalServerError(
                    "mock Suotar dropped the connection",
                ))
            });
            HttpResponse::Ok().streaming(stream)
        }
    }
}

enum Delivery {
    Json {
        status: u16,
        body: String,
    },
    Raw {
        status: u16,
        body: String,
        content_type: String,
    },
    ConnectionReset,
}

impl Delivery {
    fn json<T: Serialize>(status: u16, value: &T) -> Self {
        Self::Json {
            status,
            body: serde_json::to_string(value).unwrap_or_else(|_| "null".to_string()),
        }
    }
}

enum Body {
    Read(Vec<u8>),
    TooLarge,
    Broken,
}

/// Stops reading past the limit, so an oversized body costs no more than the limit.
async fn read_body(mut payload: web::Payload) -> Body {
    let mut bytes = Vec::new();
    while let Some(chunk) = payload.next().await {
        let Ok(chunk) = chunk else {
            return Body::Broken;
        };
        if bytes.len() + chunk.len() > MAX_BODY_BYTES {
            return Body::TooLarge;
        }
        bytes.extend_from_slice(&chunk);
    }
    Body::Read(bytes)
}

/// What Express's JSON parser made of the body before any route ran.
enum ParsedBody {
    Json(serde_json::Value),
    /// Not declared as JSON, so never parsed: the envelope check then finds no array.
    NotJson,
    TooLarge,
    Invalid,
}

fn parse_body(req: &HttpRequest, body: &Body) -> ParsedBody {
    let is_json = req
        .headers()
        .get(actix_web::http::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .is_some_and(|essence| essence.trim().eq_ignore_ascii_case("application/json"));
    if !is_json {
        return ParsedBody::NotJson;
    }
    match body {
        Body::TooLarge => ParsedBody::TooLarge,
        Body::Broken => ParsedBody::Invalid,
        Body::Read(bytes) if bytes.is_empty() => ParsedBody::Json(serde_json::json!({})),
        // Strict mode: only an object or an array is a JSON body.
        Body::Read(bytes) => match serde_json::from_slice::<serde_json::Value>(bytes) {
            Ok(value) if value.is_object() || value.is_array() => ParsedBody::Json(value),
            _ => ParsedBody::Invalid,
        },
    }
}

/// The body parser runs before the credential check, so its failures win over a missing key.
fn pre_route_rejection(
    parsed: &ParsedBody,
    is_authorized: bool,
) -> Option<(u16, RequestLevelError)> {
    match parsed {
        ParsedBody::TooLarge => Some((413, RequestLevelError::new("requestTooLarge"))),
        ParsedBody::Invalid => Some((
            400,
            RequestLevelError::with_message(
                "malformedRequest",
                "Request body is not valid JSON.".to_string(),
            ),
        )),
        _ if !is_authorized => Some((401, RequestLevelError::new("unauthorized"))),
        _ => None,
    }
}

/// What a request is answered with, and what its call-log entry records about the answer.
struct Answer {
    delivery: Delivery,
    status: u16,
    request_level_code: Option<String>,
    /// The fault effect that shaped the whole answer, if one did.
    effect: Option<String>,
}

impl Answer {
    fn json<T: Serialize>(status: u16, body: &T) -> Self {
        Self {
            delivery: Delivery::json(status, body),
            status,
            request_level_code: None,
            effect: None,
        }
    }

    fn request_level(status: u16, error: &RequestLevelError) -> Self {
        Self {
            request_level_code: Some(error.error.code.clone()),
            ..Self::json(status, error)
        }
    }
}

/// `None` for an item-shaped effect, which shapes one item rather than the whole answer.
fn terminal(effect: &Effect) -> Option<Answer> {
    let answer = match effect {
        Effect::ConnectionReset => Answer {
            delivery: Delivery::ConnectionReset,
            status: 200,
            request_level_code: None,
            effect: None,
        },
        Effect::RequestLevel {
            status,
            code,
            message,
        } => Answer::request_level(
            *status,
            &match message {
                Some(message) => RequestLevelError::with_message(code, message.clone()),
                None => RequestLevelError::new(code),
            },
        ),
        Effect::RawBody {
            status,
            body,
            content_type,
        } => Answer {
            delivery: Delivery::Raw {
                status: *status,
                body: body.clone(),
                content_type: content_type
                    .clone()
                    .unwrap_or_else(|| "application/json".to_string()),
            },
            status: *status,
            request_level_code: None,
            effect: None,
        },
        Effect::ItemLevel { .. } | Effect::DropItem => return None,
    };
    Some(Answer {
        effect: Some(effect.kind().to_string()),
        ..answer
    })
}

async fn run(
    endpoint: Endpoint,
    store: &MockSuotarStore,
    pool: &PgPool,
    req: &HttpRequest,
    body: &Body,
) -> anyhow::Result<Delivery> {
    let now = Utc::now();
    let (generation, preamble) = resolve_world(store, pool).await?;
    let mut runner = FaultRunner {
        store,
        generation: &generation,
        faults: &preamble.faults,
        preamble: &preamble,
        log: RecordedFaults::default(),
    };
    let mut call = RecordedCall {
        seq: store.next_call_seq(&generation).await?,
        received_at: now,
        endpoint,
        correlation_id: req
            .headers()
            .get("X-Correlation-Id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string),
        authorized: authorized(req, &preamble),
        http_status: 200,
        request_level_code: None,
        effect: None,
        raw_body_truncated: match body {
            Body::Read(bytes) => truncate(bytes),
            Body::TooLarge => "(over the size limit)".to_string(),
            Body::Broken => "(unreadable)".to_string(),
        },
        faults: RecordedFaults::default(),
        items: Vec::new(),
    };
    let mut working = WorkingSet {
        defaults: preamble.defaults.clone(),
        ..Default::default()
    };

    let answer = answer(
        endpoint,
        req,
        body,
        now,
        &mut runner,
        &mut call,
        &mut working,
    )
    .await?;
    call.faults = runner.log;
    call.effect = answer.effect;
    call.http_status = answer.status;
    call.request_level_code = answer.request_level_code;
    let capacity = working.defaults.call_log_capacity.max(1);
    store.commit(&generation, &working, &call, capacity).await?;
    Ok(answer.delivery)
}

/// Resolves one request against the working set, which the caller then commits along with `call`.
async fn answer(
    endpoint: Endpoint,
    req: &HttpRequest,
    body: &Body,
    now: DateTime<Utc>,
    runner: &mut FaultRunner<'_>,
    call: &mut RecordedCall,
    working: &mut WorkingSet,
) -> anyhow::Result<Answer> {
    let parsed_body = parse_body(req, body);
    if let Some((status, error)) = pre_route_rejection(&parsed_body, call.authorized) {
        return Ok(Answer::request_level(status, &error));
    }
    let json = match parsed_body {
        ParsedBody::Json(value) => Some(value),
        _ => None,
    };

    let parsed = match parse_envelope(endpoint, json) {
        Ok(Some(parsed)) => parsed,
        Ok(None) => return Ok(Answer::json(200, &Vec::<ResponseItem>::new())),
        Err(message) => {
            return Ok(Answer::request_level(
                400,
                &RequestLevelError::with_message("malformedRequest", message),
            ));
        }
    };

    let mut addresses = parsed.addresses();
    load(runner.store, runner.generation, &parsed, working).await?;
    parsed.enrich_addresses(&mut addresses, working);

    // `auth`, `requestGate` and `parse` run before the body in a real Suotar and after it here,
    // because narrowing a fault to one spec's rows needs the parse. Nothing is written yet at any of
    // these stages.
    for stage in [
        Stage::Auth,
        Stage::RequestGate,
        Stage::Parse,
        Stage::Resolve,
    ] {
        if let Some(effect) = runner.request_stage(endpoint, stage, &addresses).await?
            && let Some(terminal) = terminal(&effect)
        {
            call.authorized = stage != Stage::Auth;
            return Ok(terminal);
        }
    }

    let (mut items, written) = match &parsed {
        ParsedRequest::Import(requests) => {
            match resolve_import_batch(requests, &addresses, now, runner, working).await? {
                Ok(resolved) => resolved,
                Err(rejection) => return Ok(rejection),
            }
        }
        _ => {
            let mut items = Vec::with_capacity(addresses.len());
            for (index, address) in addresses.iter().enumerate() {
                let fault = runner.item_stage(endpoint, Stage::Resolve, address).await?;
                items.push(match fault {
                    Some(effect) => item_effect_response(endpoint, address, &effect),
                    None => parsed.resolve(index, working, now),
                });
            }
            (items, vec![None; addresses.len()])
        }
    };

    // A request-shaped effect here replaces the answer the items formed; the log keeps the items
    // either way, which is what makes a landed-but-unanswered import visible.
    let mut answered_by_fault: Option<Answer> = None;
    let mut dropped = vec![false; addresses.len()];
    for stage in [Stage::AfterWrite, Stage::Respond] {
        if let Some(effect) = runner.request_stage(endpoint, stage, &addresses).await? {
            answered_by_fault = terminal(&effect);
        }
        for (index, address) in addresses.iter().enumerate() {
            let Some(effect) = runner.item_stage(endpoint, stage, address).await? else {
                continue;
            };
            if effect == Effect::DropItem {
                dropped[index] = true;
                continue;
            }
            let Some(item) = items.get_mut(index) else {
                continue;
            };
            let response = item_effect_response(endpoint, address, &effect);
            *item = match (&effect, &written[index]) {
                (Effect::ItemLevel { code, .. }, Some(submission_id)) if code == "sisuTimeout" => {
                    leave_unconfirmed(working, submission_id);
                    response.with_result(SubmittedAttainment::new(submission_id))
                }
                _ => response,
            };
        }
    }

    call.items = addresses
        .iter()
        .zip(items.iter())
        .zip(&dropped)
        .map(|((address, item), is_dropped)| RecordedItem {
            request_item_id: address.request_item_id.clone(),
            student_number: address.student_number.clone(),
            course_code: address.course_code.clone(),
            submitted_attainment_id: address.submitted_attainment_id.clone(),
            status: match (is_dropped, item.status) {
                (true, _) => "dropped".to_string(),
                (false, ItemStatus::Ok) => "ok".to_string(),
                (false, ItemStatus::Error) => "error".to_string(),
            },
            code: item.code.clone(),
        })
        .collect();

    Ok(answered_by_fault.unwrap_or_else(|| {
        let answered: Vec<&ResponseItem> = items
            .iter()
            .zip(&dropped)
            .filter(|(_, is_dropped)| !**is_dropped)
            .map(|(item, _)| item)
            .collect();
        Answer::json(200, &answered)
    }))
}

/// Resolves an import batch and writes what survived its checks, returning each item's answer and
/// the submission it wrote. `Err` is the request-level answer that replaces the whole batch.
async fn resolve_import_batch(
    requests: &[wire::ImportAttainmentRequestItem],
    addresses: &[ItemAddress],
    now: DateTime<Utc>,
    runner: &mut FaultRunner<'_>,
    working: &mut WorkingSet,
) -> anyhow::Result<Result<(Vec<ResponseItem>, Vec<Option<String>>), Answer>> {
    let endpoint = Endpoint::ImportAttainments;
    let mut slots: Vec<Option<ResponseItem>> = vec![None; addresses.len()];
    let mut to_write: Vec<(usize, MockSubmission)> = Vec::new();
    // Completion key to the submission written for it; a repeat of an item answered outright is
    // resolved on its own and reaches the same answer.
    let mut written_in_batch: HashMap<String, String> = HashMap::new();
    for (index, (address, request)) in addresses.iter().zip(requests).enumerate() {
        if let Some(effect) = runner.item_stage(endpoint, Stage::Resolve, address).await? {
            slots[index] = Some(item_effect_response(endpoint, address, &effect));
            continue;
        }
        let completion = completion_key(request);
        if let Some(first) = written_in_batch.get(&completion) {
            slots[index] = Some(
                ResponseItem::error(endpoint, &request.request_item_id, "duplicateRequestItem")
                    .with_result(SubmittedAttainment::new(first)),
            );
            continue;
        }
        match logic::resolve_import_item(request, working, now) {
            ImportResolution::Answered(item) => slots[index] = Some(item),
            ImportResolution::Write(submission) => {
                written_in_batch.insert(completion, submission.submitted_attainment_id.clone());
                to_write.push((index, *submission));
            }
        }
    }
    let submissions: Vec<MockSubmission> = to_write.iter().map(|(_, s)| s.clone()).collect();
    if logic::acceptor_lookup_fails(working, &submissions) {
        return Ok(Err(Answer::request_level(
            503,
            &RequestLevelError::new("serviceTemporarilyUnavailable"),
        )));
    }
    let mut written: Vec<Option<String>> = vec![None; addresses.len()];
    for (index, submission) in to_write {
        written[index] = Some(submission.submitted_attainment_id.clone());
        slots[index] = Some(logic::write_and_send(working, submission));
    }
    let items = addresses
        .iter()
        .zip(slots)
        .map(|(address, slot)| {
            slot.unwrap_or_else(|| {
                ResponseItem::error(endpoint, &address.request_item_id, "internalError")
            })
        })
        .collect();
    Ok(Ok((items, written)))
}

/// A send that never answered: the submission exists but Sisu's acceptance was never recorded.
fn leave_unconfirmed(working: &mut WorkingSet, submission_id: &str) {
    if let Some(submission) = working.submissions.get_mut(submission_id) {
        submission.send_state = SendState::Attempted;
        working
            .writes
            .push(WorldWrite::UpsertSubmission(submission_id.to_string()));
    }
}

/// Suotar's intra-batch duplicate key. The enrolment and the language are deliberately not in it.
fn completion_key(item: &wire::ImportAttainmentRequestItem) -> String {
    format!(
        "{}|{}|{}|{}|{}|{}",
        item.student_number,
        item.course_code,
        item.grade_scale_id,
        item.grade_id,
        item.credits,
        item.attainment_date
    )
}

async fn resolve_world(
    store: &MockSuotarStore,
    pool: &PgPool,
) -> anyhow::Result<(String, Preamble)> {
    if let Some(generation) = store.live_generation().await? {
        let preamble = store.preamble(&generation).await?;
        if preamble.defaults_present {
            return Ok((generation, preamble));
        }
    }
    let marker = default_world::db_generation_marker(pool).await;
    let generation = store
        .install_if_absent(&default_world::build(), marker.as_deref())
        .await?;
    let preamble = store.preamble(&generation).await?;
    Ok((generation, preamble))
}

fn authorized(req: &HttpRequest, preamble: &Preamble) -> bool {
    credential_accepted(
        req.headers()
            .get(actix_web::http::header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok()),
        &preamble.defaults.accepted_token,
    )
}

/// Exactly `Bearer <token>`: case-sensitive, one space, no other scheme.
fn credential_accepted(header: Option<&str>, expected: &str) -> bool {
    header
        .and_then(|header| header.strip_prefix("Bearer "))
        .is_some_and(|credential| !expected.is_empty() && credential == expected)
}

fn truncate(body: &[u8]) -> String {
    let text = String::from_utf8_lossy(body);
    if text.len() <= RAW_BODY_LIMIT {
        return text.into_owned();
    }
    let mut cut = RAW_BODY_LIMIT;
    while cut > 0 && !text.is_char_boundary(cut) {
        cut -= 1;
    }
    text[..cut].to_string()
}

struct FaultRunner<'a> {
    store: &'a MockSuotarStore,
    generation: &'a str,
    faults: &'a [Fault],
    preamble: &'a Preamble,
    log: RecordedFaults,
}

impl FaultRunner<'_> {
    /// First match in arm order wins; later matches are recorded as shadowed rather than applied.
    async fn request_stage(
        &mut self,
        endpoint: Endpoint,
        stage: Stage,
        items: &[ItemAddress],
    ) -> anyhow::Result<Option<Effect>> {
        let mut winner = None;
        for fault in self.faults {
            if !fault.then.is_request_shaped() {
                continue;
            }
            match matches_request(fault, endpoint, stage, items) {
                FaultMatch::Missed(predicate) => {
                    self.record_miss(fault, endpoint, stage, predicate)
                }
                FaultMatch::Fires => {
                    if winner.is_some() {
                        self.log.shadowed.push(fault.id.clone());
                        continue;
                    }
                    if self.draw(fault).await? {
                        self.log.applied.push(fault.id.clone());
                        winner = Some(fault.then.clone());
                    }
                }
            }
        }
        Ok(winner)
    }

    async fn item_stage(
        &mut self,
        endpoint: Endpoint,
        stage: Stage,
        item: &ItemAddress,
    ) -> anyhow::Result<Option<Effect>> {
        for fault in self.faults {
            if fault.then.is_request_shaped() {
                continue;
            }
            match matches_item(fault, endpoint, stage, item) {
                FaultMatch::Missed(predicate) => {
                    self.record_miss(fault, endpoint, stage, predicate)
                }
                FaultMatch::Fires => {
                    if self.draw(fault).await? {
                        self.log.applied.push(fault.id.clone());
                        return Ok(Some(fault.then.clone()));
                    }
                }
            }
        }
        Ok(None)
    }

    /// Only a fault that reached this endpoint and stage and then missed on one further predicate is
    /// worth reporting.
    fn record_miss(&mut self, fault: &Fault, endpoint: Endpoint, stage: Stage, predicate: &str) {
        if fault.endpoint() != Some(endpoint) || fault.stage() != Some(stage) {
            return;
        }
        let miss = MissedFault {
            fault_id: fault.id.clone(),
            predicate: predicate.to_string(),
        };
        if !self.log.missed.contains(&miss) {
            self.log.missed.push(miss);
        }
    }

    /// The decision is the value the draw returns: reading a counter and deciding on the read is how
    /// two concurrent requests both spend the last of one budget.
    async fn draw(&mut self, fault: &Fault) -> anyhow::Result<bool> {
        let Some(budget) = fault.lifetime.budget() else {
            return Ok(true);
        };
        if budget > 0
            && self
                .preamble
                .remaining
                .get(&fault.id)
                .is_some_and(|left| *left <= 0)
        {
            return Ok(false);
        }
        let left = self.store.draw(self.generation, &fault.id, -1).await?;
        if left < 0 {
            self.store.draw(self.generation, &fault.id, 1).await?;
            self.log.missed.push(MissedFault {
                fault_id: fault.id.clone(),
                predicate: "lifetime".to_string(),
            });
            return Ok(false);
        }
        Ok(true)
    }
}

fn item_effect_response(
    endpoint: Endpoint,
    address: &ItemAddress,
    effect: &Effect,
) -> ResponseItem {
    match effect {
        Effect::ItemLevel {
            code,
            message: Some(message),
        } => ResponseItem::error_with_message(&address.request_item_id, code, message.clone()),
        Effect::ItemLevel {
            code,
            message: None,
        } => ResponseItem::error(endpoint, &address.request_item_id, code),
        _ => ResponseItem::error(endpoint, &address.request_item_id, "internalError"),
    }
}

enum ParsedRequest {
    ResolvePersons(Vec<wire::ResolvePersonRequestItem>),
    ResolveEnrolments(Vec<wire::ResolveEnrolmentRequestItem>),
    Import(Vec<wire::ImportAttainmentRequestItem>),
    Verify(Vec<wire::VerifyAttainmentRequestItem>),
    ListByCourse(Vec<wire::CourseCodeRequestItem>),
    ValidateCourseCodes(Vec<wire::CourseCodeRequestItem>),
}

impl ParsedRequest {
    fn addresses(&self) -> Vec<ItemAddress> {
        let course_code_addresses = |items: &[wire::CourseCodeRequestItem]| {
            items
                .iter()
                .map(|item| ItemAddress {
                    request_item_id: item.request_item_id.clone(),
                    course_code: Some(item.course_code.clone()),
                    ..Default::default()
                })
                .collect()
        };
        match self {
            Self::ResolvePersons(items) => items
                .iter()
                .map(|item| ItemAddress {
                    request_item_id: item.request_item_id.clone(),
                    student_number: Some(item.student_number.clone()),
                    ..Default::default()
                })
                .collect(),
            Self::ResolveEnrolments(items) => items
                .iter()
                .map(|item| ItemAddress {
                    request_item_id: item.request_item_id.clone(),
                    student_number: Some(item.student_number.clone()),
                    course_code: Some(item.course_code.clone()),
                    ..Default::default()
                })
                .collect(),
            Self::Import(items) => items
                .iter()
                .map(|item| ItemAddress {
                    request_item_id: item.request_item_id.clone(),
                    student_number: Some(item.student_number.clone()),
                    course_code: Some(item.course_code.clone()),
                    ..Default::default()
                })
                .collect(),
            Self::Verify(items) => items
                .iter()
                .map(|item| ItemAddress {
                    request_item_id: item.request_item_id.clone(),
                    submitted_attainment_id: Some(item.submitted_attainment_id.clone()),
                    ..Default::default()
                })
                .collect(),
            Self::ListByCourse(items) | Self::ValidateCourseCodes(items) => {
                course_code_addresses(items)
            }
        }
    }

    /// Verify's body carries only a submitted attainment id; the person behind it is what a spec
    /// addresses a fault with.
    fn enrich_addresses(&self, addresses: &mut [ItemAddress], working: &WorkingSet) {
        if !matches!(self, Self::Verify(_)) {
            return;
        }
        for address in addresses.iter_mut() {
            let Some(id) = address.submitted_attainment_id.as_ref() else {
                continue;
            };
            let owner = working
                .submissions
                .get(id)
                .map(|s| (s.student_number.clone(), s.course_code.clone()))
                .or_else(|| {
                    working
                        .attainments
                        .get(id)
                        .map(|a| (a.student_number.clone(), a.course_code.clone()))
                });
            if let Some((student_number, course_code)) = owner {
                address.student_number = Some(student_number);
                address.course_code = Some(course_code);
            }
        }
    }

    /// Every endpoint but import, which resolves as a batch.
    fn resolve(&self, index: usize, working: &WorkingSet, now: DateTime<Utc>) -> ResponseItem {
        match self {
            Self::ResolvePersons(items) => logic::resolve_person_item(&items[index], working),
            Self::ResolveEnrolments(items) => {
                logic::resolve_enrolments_item(&items[index], working)
            }
            Self::Verify(items) => logic::verify_item(&items[index], working, now),
            Self::ListByCourse(items) => logic::list_by_course_item(&items[index], working, now),
            Self::ValidateCourseCodes(items) => {
                logic::validate_course_code_item(&items[index], working)
            }
            Self::Import(_) => unreachable!("import resolves as a batch"),
        }
    }
}

/// Collects the distinct values of one field across a request's items, in first-seen order.
fn unique_field<T>(items: &[T], field: impl Fn(&T) -> &str) -> Vec<String> {
    items
        .iter()
        .map(|item| field(item).to_string())
        .unique()
        .collect()
}

async fn load(
    store: &MockSuotarStore,
    generation: &str,
    parsed: &ParsedRequest,
    working: &mut WorkingSet,
) -> anyhow::Result<()> {
    let defaults = working.defaults.clone();
    let loaded = match parsed {
        ParsedRequest::ResolvePersons(items) => WorkingSet {
            persons: store
                .load_persons(generation, &unique_field(items, |i| &i.student_number))
                .await?,
            ..Default::default()
        },
        ParsedRequest::ResolveEnrolments(items) => {
            store
                .load_for_person_course(
                    generation,
                    &unique_field(items, |i| &i.student_number),
                    &unique_field(items, |i| &i.course_code),
                )
                .await?
        }
        ParsedRequest::Import(items) => {
            store
                .load_for_person_course(
                    generation,
                    &unique_field(items, |i| &i.student_number),
                    &unique_field(items, |i| &i.course_code),
                )
                .await?
        }
        ParsedRequest::Verify(items) => {
            store
                .load_for_verify(
                    generation,
                    &unique_field(items, |i| &i.submitted_attainment_id),
                )
                .await?
        }
        ParsedRequest::ListByCourse(items) => {
            store
                .load_for_list_by_course(generation, &unique_field(items, |i| &i.course_code))
                .await?
        }
        ParsedRequest::ValidateCourseCodes(items) => WorkingSet {
            course_units: store
                .load_course_units(generation, &unique_field(items, |i| &i.course_code))
                .await?,
            ..Default::default()
        },
    };
    *working = WorkingSet { defaults, ..loaded };
    Ok(())
}

/// Suotar's envelope checks in its order; `Ok(None)` is the empty batch, answered with `[]`.
fn parse_envelope(
    endpoint: Endpoint,
    body: Option<serde_json::Value>,
) -> Result<Option<ParsedRequest>, String> {
    let Some(serde_json::Value::Array(items)) = body else {
        return Err(NOT_AN_ARRAY.to_string());
    };
    if items.is_empty() {
        return Ok(None);
    }
    let max = endpoint.max_batch_size();
    if items.len() > max {
        return Err(format!("A batch may contain at most {max} request items."));
    }
    let mut ids = Vec::with_capacity(items.len());
    for (index, item) in items.iter().enumerate() {
        match non_empty_string(item, "requestItemId") {
            Some(id) => ids.push(id.to_string()),
            None => {
                return Err(format!(
                    "Request item at index {index} has no string requestItemId."
                ));
            }
        }
    }
    if ids.iter().collect::<BTreeSet<_>>().len() != ids.len() {
        return Err("Every requestItemId in a batch must be unique.".to_string());
    }
    for (item, id) in items.iter().zip(&ids) {
        if let Some(message) = item_problem(endpoint, item) {
            return Err(format!("Request item {id}: {message}"));
        }
    }

    Ok(Some(match endpoint {
        Endpoint::ResolvePersons => ParsedRequest::ResolvePersons(typed(items)?),
        Endpoint::ResolveEnrolments => ParsedRequest::ResolveEnrolments(typed(items)?),
        Endpoint::ImportAttainments => ParsedRequest::Import(typed(items)?),
        Endpoint::VerifyAttainments => ParsedRequest::Verify(typed(items)?),
        Endpoint::ListByCourse => ParsedRequest::ListByCourse(typed(items)?),
        Endpoint::ValidateCourseCodes => ParsedRequest::ValidateCourseCodes(typed(items)?),
    }))
}

/// The endpoint's own item check, worded and ordered as Suotar's.
fn item_problem(endpoint: Endpoint, item: &serde_json::Value) -> Option<String> {
    let first_blank = |fields: &[&str]| {
        fields
            .iter()
            .find(|field| non_empty_string(item, field).is_none())
            .map(|field| format!("{field} must be a non-empty string."))
    };
    match endpoint {
        Endpoint::ResolvePersons => first_blank(&["studentNumber"]),
        Endpoint::ResolveEnrolments => first_blank(&["studentNumber", "courseCode"]),
        Endpoint::VerifyAttainments => first_blank(&["submittedAttainmentId"]),
        Endpoint::ValidateCourseCodes => first_blank(&["courseCode"]),
        Endpoint::ListByCourse => first_blank(&["courseCode"]).or_else(|| {
            item.get("courseUnitRealisationId").is_some().then(|| {
                "courseUnitRealisationId is not accepted; every person comes with the realisation they are enrolled on."
                    .to_string()
            })
        }),
        Endpoint::ImportAttainments => first_blank(&IMPORT_STRING_FIELDS)
            .or_else(|| {
                (!item.get("credits").is_some_and(serde_json::Value::is_number))
                    .then(|| "credits must be a number.".to_string())
            })
            .or_else(|| {
                (!non_empty_string(item, "attainmentDate").is_some_and(is_strict_date))
                    .then(|| "attainmentDate must be a date in YYYY-MM-DD format.".to_string())
            }),
    }
}

fn non_empty_string<'a>(item: &'a serde_json::Value, field: &str) -> Option<&'a str> {
    item.get(field)
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
}

/// Moment's strict `YYYY-MM-DD`: that exact shape, and a day the calendar has.
fn is_strict_date(value: &str) -> bool {
    let shape_matches = value.len() == 10
        && value.char_indices().all(|(index, c)| match index {
            4 | 7 => c == '-',
            _ => c.is_ascii_digit(),
        });
    shape_matches && chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
}

/// Cannot fail on an item that passed `item_problem`; the message is for the day the two drift.
fn typed<T: DeserializeOwned>(items: Vec<serde_json::Value>) -> Result<Vec<T>, String> {
    items
        .into_iter()
        .enumerate()
        .map(|(index, item)| {
            serde_json::from_value(item)
                .map_err(|error| format!("Request item at index {index} is unreadable: {error}"))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_exact_bearer_form_of_the_credential_is_accepted() {
        let expected = "mock-suotar-token";
        assert!(credential_accepted(
            Some(&format!("Bearer {expected}")),
            expected
        ));
        for header in [
            format!("Basic {expected}"),
            format!("bearer {expected}"),
            format!("Bearer  {expected}"),
            expected.to_string(),
            "Bearer wrong-token".to_string(),
        ] {
            assert!(
                !credential_accepted(Some(&header), expected),
                "accepted {header}"
            );
        }
        assert!(!credential_accepted(None, expected));
    }
}
