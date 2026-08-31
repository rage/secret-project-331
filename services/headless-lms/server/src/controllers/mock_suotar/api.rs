//! The six contract endpoints, one stage boundary at a time.
//!
//! Order per request: credential, parse, item-keyed load, the `auth`/`requestGate`/`parse` faults,
//! `resolve` request-level then per item, then `afterWrite` and `respond`. The write-back commits
//! before the response — or its deliberate absence — leaves the process, which is what makes a
//! timeout that landed distinguishable from one that did not.

use std::collections::BTreeSet;

use base64::Engine;
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use itertools::Itertools;
use serde::de::DeserializeOwned;
use sqlx::PgPool;

use crate::prelude::*;

use super::default_world;
use super::faults::{Effect, Fault, FaultMatch, ItemAddress, Stage, matches_item, matches_request};
use super::logic;
use super::store::{MockSuotarStore, Preamble};
use super::wire::{self, ItemStatus, RequestLevelError, ResponseItem};
use super::world::{MissedFault, RecordedCall, RecordedFaults, RecordedItem, WorkingSet};

const RAW_BODY_LIMIT: usize = 8 * 1024;

pub async fn resolve_persons(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    endpoint(
        SuotarEndpoint::ResolvePersons,
        app_conf,
        store,
        pool,
        req,
        body,
    )
    .await
}

pub async fn resolve_enrolments(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    endpoint(
        SuotarEndpoint::ResolveEnrolments,
        app_conf,
        store,
        pool,
        req,
        body,
    )
    .await
}

pub async fn list_by_course(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    endpoint(
        SuotarEndpoint::ListByCourse,
        app_conf,
        store,
        pool,
        req,
        body,
    )
    .await
}

pub async fn import_attainments(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    endpoint(
        SuotarEndpoint::ImportAttainments,
        app_conf,
        store,
        pool,
        req,
        body,
    )
    .await
}

pub async fn verify_attainments(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    endpoint(
        SuotarEndpoint::VerifyAttainments,
        app_conf,
        store,
        pool,
        req,
        body,
    )
    .await
}

pub async fn resolve_product_access_tokens(
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    endpoint(
        SuotarEndpoint::ProductAccessTokens,
        app_conf,
        store,
        pool,
        req,
        body,
    )
    .await
}

async fn endpoint(
    endpoint: SuotarEndpoint,
    app_conf: web::Data<ApplicationConfiguration>,
    store: web::Data<MockSuotarStore>,
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Bytes,
) -> ControllerResult<HttpResponse> {
    super::assert_enabled(&app_conf);
    let token = skip_authorize();
    let delivery = match run(endpoint, &store, &pool, &req, &body).await {
        Ok(delivery) => delivery,
        Err(error) => {
            // A store failure is loud: silent degradation is wrong for something tests assert against.
            error!("mock Suotar failed to serve a request: {error:?}");
            return token.authorized_ok(HttpResponse::InternalServerError().json(
                RequestLevelError::with_message("internalError", error.to_string()),
            ));
        }
    };
    token.authorized_ok(deliver(delivery))
}

fn deliver(delivery: Delivery) -> HttpResponse {
    match delivery {
        Delivery::Json { status, body } => HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status)
                .unwrap_or(actix_web::http::StatusCode::OK),
        )
        .content_type("application/json")
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
    Json { status: u16, body: String },
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

/// What a request-shaped effect answers with instead of the per-item array.
struct Terminal {
    delivery: Delivery,
    status: u16,
    request_level_code: Option<String>,
    effect: String,
}

/// `None` for an item-level effect, which shapes one item rather than the whole answer.
fn terminal(endpoint: SuotarEndpoint, effect: &Effect) -> Option<Terminal> {
    let kind = effect.kind().to_string();
    match effect {
        Effect::ConnectionReset => Some(Terminal {
            delivery: Delivery::ConnectionReset,
            status: 200,
            request_level_code: None,
            effect: kind,
        }),
        Effect::RequestLevel {
            status,
            code,
            message,
        } => {
            let error = match message {
                Some(message) => RequestLevelError::with_message(code, message.clone()),
                None => RequestLevelError::new(endpoint, code),
            };
            Some(Terminal {
                delivery: Delivery::json(*status, &error),
                status: *status,
                request_level_code: Some(code.clone()),
                effect: kind,
            })
        }
        Effect::ItemLevel { .. } => None,
    }
}

async fn run(
    endpoint: SuotarEndpoint,
    store: &MockSuotarStore,
    pool: &PgPool,
    req: &HttpRequest,
    body: &[u8],
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
        authorized: true,
        http_status: 200,
        request_level_code: None,
        effect: None,
        raw_body_truncated: truncate(body),
        faults: RecordedFaults::default(),
        items: Vec::new(),
    };
    let mut working = WorkingSet {
        defaults: preamble.defaults.clone(),
        ..Default::default()
    };

    // The real credential, which no fault takes part in.
    if !authorized(req, &preamble) {
        call.authorized = false;
        return finish(
            store,
            &generation,
            &working,
            call,
            runner.log,
            Delivery::json(401, &RequestLevelError::new(endpoint, "unauthorized")),
            401,
            Some("unauthorized".to_string()),
            None,
        )
        .await;
    }

    let parsed = match parse(endpoint, body, &preamble) {
        Ok(parsed) => parsed,
        Err((code, message)) => {
            return finish(
                store,
                &generation,
                &working,
                call,
                runner.log,
                Delivery::json(400, &RequestLevelError::with_message(&code, message)),
                400,
                Some(code),
                None,
            )
            .await;
        }
    };

    let mut addresses = parsed.addresses();
    load(store, &generation, &parsed, &mut working).await?;
    parsed.enrich_addresses(&mut addresses, &working);

    // A real Suotar decides these before reading the body; evaluated after it here because narrowing
    // a fault to the rows one spec owns costs the parse. Nothing is written yet either way.
    for stage in [Stage::Auth, Stage::RequestGate, Stage::Parse] {
        if let Some(effect) = runner.request_stage(endpoint, stage, &addresses).await?
            && let Some(terminal) = terminal(endpoint, &effect)
        {
            call.authorized = stage != Stage::Auth;
            return finish(
                store,
                &generation,
                &working,
                call,
                runner.log,
                terminal.delivery,
                terminal.status,
                terminal.request_level_code,
                Some(terminal.effect),
            )
            .await;
        }
    }

    if let Some(effect) = runner
        .request_stage(endpoint, Stage::Resolve, &addresses)
        .await?
        && let Some(terminal) = terminal(endpoint, &effect)
    {
        call.authorized = true;
        return finish(
            store,
            &generation,
            &working,
            call,
            runner.log,
            terminal.delivery,
            terminal.status,
            terminal.request_level_code,
            Some(terminal.effect),
        )
        .await;
    }

    let mut items = Vec::with_capacity(addresses.len());
    for (index, address) in addresses.iter().enumerate() {
        let fault = runner.item_stage(endpoint, Stage::Resolve, address).await?;
        match fault {
            Some(effect) => items.push(item_effect_response(endpoint, address, &effect, None)),
            None => items.push(parsed.resolve(index, &mut working, now)),
        }
    }

    // A request-shaped effect here replaces the answer the items formed; the log keeps the items
    // either way, which is what makes a landed-but-unanswered import visible.
    let mut answered_by_fault: Option<Terminal> = None;
    for stage in [Stage::AfterWrite, Stage::Respond] {
        if let Some(effect) = runner.request_stage(endpoint, stage, &addresses).await? {
            answered_by_fault = terminal(endpoint, &effect);
        }
        for (index, address) in addresses.iter().enumerate() {
            if let Some(effect) = runner.item_stage(endpoint, stage, address).await?
                && let Some(item) = items.get_mut(index)
            {
                *item = item_effect_response(endpoint, address, &effect, Some(item));
            }
        }
    }

    call.items = addresses
        .iter()
        .zip(items.iter())
        .map(|(address, item)| RecordedItem {
            request_item_id: address.request_item_id.clone(),
            student_number: address.student_number.clone(),
            course_code: address.course_code.clone(),
            submitted_attainment_id: address.submitted_attainment_id.clone(),
            product_id: address.product_id.clone(),
            status: match item.status {
                ItemStatus::Ok => "ok".to_string(),
                ItemStatus::Error => "error".to_string(),
            },
            code: item.code.clone(),
        })
        .collect();

    let (delivery, status, code, effect) = match answered_by_fault {
        Some(terminal) => (
            terminal.delivery,
            terminal.status,
            terminal.request_level_code,
            Some(terminal.effect),
        ),
        None => (Delivery::json(200, &items), 200, None, None),
    };
    finish(
        store,
        &generation,
        &working,
        call,
        runner.log,
        delivery,
        status,
        code,
        effect,
    )
    .await
}

/// Commits, then hands back what to send.
#[allow(clippy::too_many_arguments)]
async fn finish(
    store: &MockSuotarStore,
    generation: &str,
    working: &WorkingSet,
    mut call: RecordedCall,
    log: RecordedFaults,
    delivery: Delivery,
    status: u16,
    request_level_code: Option<String>,
    effect: Option<String>,
) -> anyhow::Result<Delivery> {
    call.faults = log;
    call.effect = effect;
    call.http_status = status;
    call.request_level_code = request_level_code;
    let capacity = working.defaults.call_log_capacity.max(1);
    store.commit(generation, working, &call, capacity).await?;
    Ok(delivery)
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

/// Scheme-agnostic: whatever word the client puts in front, the credential after it is what is
/// checked.
fn credential_accepted(header: Option<&str>, expected: &str) -> bool {
    let Some(header) = header else {
        return false;
    };
    let credential = header.split_whitespace().next_back().unwrap_or_default();
    if credential == expected {
        return true;
    }
    // `reqwest`'s `basic_auth()` base64-encodes, so which way the client builds the header must not
    // matter.
    base64::engine::general_purpose::STANDARD
        .decode(credential)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .is_some_and(|decoded| {
            decoded == expected
                || decoded == format!("{expected}:")
                || decoded.rsplit(':').next() == Some(expected)
        })
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
        endpoint: SuotarEndpoint,
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
        endpoint: SuotarEndpoint,
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
    fn record_miss(
        &mut self,
        fault: &Fault,
        endpoint: SuotarEndpoint,
        stage: Stage,
        predicate: &str,
    ) {
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

/// A disclosed id is taken from the outcome the item already had, which is what makes "timed out, but
/// it landed" expressible.
fn item_effect_response(
    endpoint: SuotarEndpoint,
    address: &ItemAddress,
    effect: &Effect,
    resolved: Option<&ResponseItem>,
) -> ResponseItem {
    let Effect::ItemLevel {
        code,
        message,
        disclose_submitted_attainment_id,
    } = effect
    else {
        return resolved.cloned().unwrap_or_else(|| {
            ResponseItem::error(endpoint, &address.request_item_id, "internalError")
        });
    };
    let mut item = match message {
        Some(message) => {
            ResponseItem::error_with_message(&address.request_item_id, code, message.clone())
        }
        None => ResponseItem::error(endpoint, &address.request_item_id, code),
    };
    if *disclose_submitted_attainment_id
        && let Some(id) = resolved
            .and_then(|resolved| resolved.result.as_ref())
            .and_then(|result| result.get("submittedAttainmentId"))
            .and_then(|value| value.as_str())
        && let Some(error) = item.error.as_mut()
    {
        error.submitted_attainment_id = Some(id.to_string());
    }
    item
}

enum ParsedRequest {
    ResolvePersons(Vec<wire::ResolvePersonsItem>),
    ResolveEnrolments(Vec<wire::ResolveEnrolmentsItem>),
    Import(Vec<wire::ImportItem>),
    Verify(Vec<wire::VerifyItem>),
    ProductAccessTokens(Vec<wire::ProductAccessTokenItem>),
    ListByCourse(Vec<wire::ListByCourseItem>),
}

impl ParsedRequest {
    fn addresses(&self) -> Vec<ItemAddress> {
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
            Self::ProductAccessTokens(items) => items
                .iter()
                .map(|item| ItemAddress {
                    request_item_id: item.request_item_id.clone(),
                    product_id: Some(item.open_university_product_id.clone()),
                    ..Default::default()
                })
                .collect(),
            Self::ListByCourse(items) => items
                .iter()
                .map(|item| ItemAddress {
                    request_item_id: item.request_item_id.clone(),
                    course_code: Some(item.course_code.clone()),
                    ..Default::default()
                })
                .collect(),
        }
    }

    /// Verify's body carries only a submitted attainment id; the person behind it is what a spec
    /// addresses a fault with.
    fn enrich_addresses(&self, addresses: &mut [ItemAddress], working: &WorkingSet) {
        if !matches!(self, Self::Verify(_)) {
            return;
        }
        for address in addresses.iter_mut() {
            if let Some(submission) = address
                .submitted_attainment_id
                .as_ref()
                .and_then(|id| working.submissions.get(id))
            {
                address.student_number = Some(submission.student_number.clone());
                address.course_code = Some(submission.course_code.clone());
            }
        }
    }

    fn resolve(&self, index: usize, working: &mut WorkingSet, now: DateTime<Utc>) -> ResponseItem {
        match self {
            Self::ResolvePersons(items) => logic::resolve_person_item(&items[index], working),
            Self::ResolveEnrolments(items) => {
                logic::resolve_enrolments_item(&items[index], working, now)
            }
            Self::Import(items) => logic::import_item(&items[index], working, now),
            Self::Verify(items) => logic::verify_item(&items[index], working, now),
            Self::ProductAccessTokens(items) => {
                logic::product_access_token_item(&items[index], working)
            }
            Self::ListByCourse(items) => logic::list_by_course_item(&items[index], working),
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
        ParsedRequest::ResolvePersons(items) => {
            let persons = store
                .load_persons(generation, &unique_field(items, |i| &i.student_number))
                .await?;
            WorkingSet {
                persons,
                ..Default::default()
            }
        }
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
        ParsedRequest::ProductAccessTokens(items) => {
            let product_tokens = store
                .load_product_tokens(
                    generation,
                    &unique_field(items, |i| &i.open_university_product_id),
                )
                .await?;
            WorkingSet {
                product_tokens,
                ..Default::default()
            }
        }
        ParsedRequest::ListByCourse(items) => {
            store
                .load_for_list_by_course(generation, &unique_field(items, |i| &i.course_code))
                .await?
        }
    };
    *working = WorkingSet { defaults, ..loaded };
    Ok(())
}

/// The error half is the request-level code and its message.
type ParseFailure = (String, String);

fn parse(
    endpoint: SuotarEndpoint,
    body: &[u8],
    preamble: &Preamble,
) -> Result<ParsedRequest, ParseFailure> {
    let parsed = match endpoint {
        SuotarEndpoint::ResolvePersons => ParsedRequest::ResolvePersons(parse_items(body)?),
        SuotarEndpoint::ResolveEnrolments => ParsedRequest::ResolveEnrolments(parse_items(body)?),
        SuotarEndpoint::ImportAttainments => ParsedRequest::Import(parse_items(body)?),
        SuotarEndpoint::VerifyAttainments => ParsedRequest::Verify(parse_items(body)?),
        SuotarEndpoint::ProductAccessTokens => {
            ParsedRequest::ProductAccessTokens(parse_items(body)?)
        }
        SuotarEndpoint::ListByCourse => ParsedRequest::ListByCourse(parse_items(body)?),
    };

    let ids: Vec<String> = parsed
        .addresses()
        .into_iter()
        .map(|address| address.request_item_id)
        .collect();
    let mut seen = BTreeSet::new();
    for (index, id) in ids.iter().enumerate() {
        if !seen.insert(id.clone()) {
            return Err(malformed(format!(
                "Item {index} repeats requestItemId `{id}`."
            )));
        }
    }

    if let ParsedRequest::Import(items) = &parsed {
        // A statically unknown grade id is a request-level error, so one poisoned item rejects the
        // whole batch. Suotar has not named a code for it; the default is the escape hatch for the
        // day it does.
        let grade_code = preamble
            .defaults
            .static_grade_error_code
            .clone()
            .unwrap_or_else(|| "malformedRequest".to_string());
        for (index, item) in items.iter().enumerate() {
            if preamble.defaults.scale(&item.grade_scale_id).is_none() {
                return Err((
                    grade_code,
                    format!(
                        "Item {index} has an unknown gradeScaleId `{}`.",
                        item.grade_scale_id
                    ),
                ));
            }
            if !preamble.defaults.any_scale_has_grade(&item.grade_id) {
                return Err((
                    grade_code,
                    format!(
                        "Item {index} has a gradeId `{}` that is in no known grade scale.",
                        item.grade_id
                    ),
                ));
            }
            if item.attainment_language.chars().count() != 2 {
                return Err(malformed(format!(
                    "Item {index} has an attainmentLanguage that is not a two-letter code."
                )));
            }
            if item.credits < 0.0 || !item.credits.is_finite() {
                return Err(malformed(format!(
                    "Item {index} has credits that are not a positive number."
                )));
            }
        }
    }

    if preamble.defaults.realisation_id_required
        && let ParsedRequest::ListByCourse(items) = &parsed
        && let Some(index) = items
            .iter()
            .position(|item| item.course_unit_realisation_id.is_none())
    {
        return Err(malformed(format!(
            "Item {index} is missing courseUnitRealisationId."
        )));
    }

    Ok(parsed)
}

/// Parses per element so the message can name the offending index, which serde's line and column
/// cannot.
fn parse_items<T: DeserializeOwned>(body: &[u8]) -> Result<Vec<T>, ParseFailure> {
    let values: Vec<serde_json::Value> = serde_json::from_slice(body)
        .map_err(|error| malformed(format!("Request body is not a JSON array: {error}")))?;
    if values.is_empty() {
        return Err(malformed("Request body is an empty array.".to_string()));
    }
    values
        .into_iter()
        .enumerate()
        .map(|(index, value)| {
            serde_json::from_value(value)
                .map_err(|error| malformed(format!("Item {index} is invalid: {error}")))
        })
        .collect()
}

fn malformed(message: String) -> ParseFailure {
    ("malformedRequest".to_string(), message)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encoded(value: &str) -> String {
        base64::engine::general_purpose::STANDARD.encode(value)
    }

    #[test]
    fn every_shape_of_the_configured_credential_is_accepted() {
        let expected = "mock-suotar-token";
        for header in [
            format!("Basic {expected}"),
            format!("Bearer {expected}"),
            format!("Basic {}", encoded(expected)),
            format!("Basic {}", encoded(&format!("{expected}:"))),
            format!("Basic {}", encoded(&format!("suotar:{expected}"))),
        ] {
            assert!(
                credential_accepted(Some(&header), expected),
                "rejected {header}"
            );
        }
        assert!(!credential_accepted(None, expected));
        assert!(!credential_accepted(Some("Basic wrong-token"), expected));
        assert!(!credential_accepted(
            Some(&format!("Basic {}", encoded("suotar:wrong-token"))),
            expected
        ));
    }
}
