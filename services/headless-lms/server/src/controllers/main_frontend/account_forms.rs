//! Controllers for requests starting with `/api/v0/main-frontend/account-forms/`: the account form
//! log, the rules over it and their settings. Admins only.

use models::{
    account_form_decisions::{self, AccountFormDecision},
    account_form_rules::{
        self, AccountFormListKind, AccountFormRule, AccountFormRuleUpdate, AccountFormRuleVersion,
    },
    account_form_settings::{self, AccountFormSettings},
};
use utoipa::{IntoParams, OpenApi, ToSchema};

use crate::domain::account_form_checks::{
    self,
    rules::{self, RuleSubject},
    signals::Signals,
};
use crate::prelude::*;

const DECISION_PAGE_SIZE: i64 = 100;
const ADDRESS_DECISION_LIMIT: i64 = 200;
const DRY_RUN_DECISION_LIMIT: i64 = 5000;
const DRY_RUN_EXAMPLE_LIMIT: usize = 50;
const MAX_EXPRESSION_LENGTH: usize = 4000;
const MAX_LIST_ENTRIES: usize = 10_000;

#[derive(OpenApi)]
#[openapi(paths(
    get_settings,
    update_settings,
    get_decisions,
    lookup_decisions,
    get_rules,
    create_rule,
    update_rule,
    delete_rule,
    get_rule_versions,
    dry_run_rule
))]
pub(crate) struct MainFrontendAccountFormsApiDoc;

/**
GET `/api/v0/main-frontend/account-forms/settings`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/settings",
    operation_id = "getAccountFormSettings",
    tag = "account_forms",
    responses((status = 200, description = "Settings", body = AccountFormSettings))
)]
async fn get_settings(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<AccountFormSettings>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    token.authorized_ok(web::Json(account_form_settings::get(&mut conn).await?))
}

/**
PUT `/api/v0/main-frontend/account-forms/settings`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/settings",
    operation_id = "updateAccountFormSettings",
    tag = "account_forms",
    request_body = AccountFormSettings,
    responses((status = 200, description = "Saved"))
)]
async fn update_settings(
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<AccountFormSettings>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    account_form_settings::upsert(&mut conn, &payload).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/// Paging of the log.
#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct DecisionsQuery {
    /// Only submissions logged before this time, for paging back.
    pub before: Option<DateTime<Utc>>,
}

/**
GET `/api/v0/main-frontend/account-forms/decisions` The latest logged submissions, newest first.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/decisions",
    operation_id = "getAccountFormDecisions",
    tag = "account_forms",
    params(DecisionsQuery),
    responses((status = 200, description = "Logged submissions", body = Vec<AccountFormDecision>))
)]
async fn get_decisions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<DecisionsQuery>,
) -> ControllerResult<web::Json<Vec<AccountFormDecision>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let decisions =
        account_form_decisions::list(&mut conn, query.before, DECISION_PAGE_SIZE).await?;
    token.authorized_ok(web::Json(decisions))
}

/// The address whose logged submissions to list.
#[derive(Debug, Deserialize, ToSchema)]
pub struct DecisionLookupRequest {
    pub email: String,
}

/**
POST `/api/v0/main-frontend/account-forms/decisions/lookup` The logged submissions about one
address, for helping a person who did not get their mail.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/decisions/lookup",
    operation_id = "lookupAccountFormDecisions",
    tag = "account_forms",
    request_body = DecisionLookupRequest,
    responses((status = 200, description = "Logged submissions about the address", body = Vec<AccountFormDecision>))
)]
async fn lookup_decisions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<DecisionLookupRequest>,
) -> ControllerResult<web::Json<Vec<AccountFormDecision>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let digest = account_form_checks::address_digest(&payload.email);
    let decisions =
        account_form_decisions::list_for_address(&mut conn, &digest, ADDRESS_DECISION_LIMIT)
            .await?;
    token.authorized_ok(web::Json(decisions))
}

/**
GET `/api/v0/main-frontend/account-forms/rules`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/rules",
    operation_id = "getAccountFormRules",
    tag = "account_forms",
    responses((status = 200, description = "Rules", body = Vec<AccountFormRule>))
)]
async fn get_rules(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<AccountFormRule>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    token.authorized_ok(web::Json(account_form_rules::get_all(&mut conn).await?))
}

fn compile_expression(expression: &str) -> Result<cel::Program, ControllerError> {
    if expression.chars().count() > MAX_EXPRESSION_LENGTH {
        return Err(controller_err!(
            BadRequest,
            format!("The expression may be at most {MAX_EXPRESSION_LENGTH} characters long.")
        ));
    }
    rules::compile(expression)
        .map_err(|e| controller_err!(BadRequest, format!("The expression does not parse: {e}")))
}

/// The entries normalised and deduplicated. Errors naming the first entry that is not valid.
fn normalized_entries(
    kind: AccountFormListKind,
    entries: &[String],
) -> Result<Vec<String>, ControllerError> {
    let mut normalized = Vec::new();
    for entry in entries.iter().filter(|entry| !entry.trim().is_empty()) {
        let value = rules::normalize_list_entry(kind, entry).ok_or_else(|| {
            controller_err!(BadRequest, format!("Not a valid entry: {}", entry.trim()))
        })?;
        if !normalized.contains(&value) {
            normalized.push(value);
        }
    }
    if normalized.is_empty() || normalized.len() > MAX_LIST_ENTRIES {
        return Err(controller_err!(
            BadRequest,
            format!("A list needs between 1 and {MAX_LIST_ENTRIES} entries.")
        ));
    }
    Ok(normalized)
}

fn validated_rule(rule: AccountFormRuleUpdate) -> Result<AccountFormRuleUpdate, ControllerError> {
    let name = rule.name.trim().to_string();
    if name.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "The rule needs a name.".to_string()
        ));
    }
    let (expression, list_kind, list_entries) = match (rule.expression, rule.list_kind) {
        (Some(expression), None) => {
            compile_expression(&expression)?;
            (Some(expression), None, Vec::new())
        }
        (None, Some(kind)) => (
            None,
            Some(kind),
            normalized_entries(kind, &rule.list_entries)?,
        ),
        _ => {
            return Err(controller_err!(
                BadRequest,
                "A rule has either an expression or a list.".to_string()
            ));
        }
    };
    Ok(AccountFormRuleUpdate {
        name,
        expression,
        list_kind,
        list_entries,
        ..rule
    })
}

/**
POST `/api/v0/main-frontend/account-forms/rules` Creates a rule.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/rules",
    operation_id = "createAccountFormRule",
    tag = "account_forms",
    request_body = AccountFormRuleUpdate,
    responses((status = 200, description = "The new rule's id", body = Uuid))
)]
async fn create_rule(
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<AccountFormRuleUpdate>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let rule = validated_rule(payload.into_inner())?;
    let id = account_form_rules::insert(&mut conn, &rule, user.id).await?;
    token.authorized_ok(web::Json(id))
}

/**
PUT `/api/v0/main-frontend/account-forms/rules/{id}`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/rules/{id}",
    operation_id = "updateAccountFormRule",
    tag = "account_forms",
    params(("id" = Uuid, Path, description = "Rule id")),
    request_body = AccountFormRuleUpdate,
    responses((status = 200, description = "Saved"))
)]
async fn update_rule(
    pool: web::Data<PgPool>,
    user: AuthUser,
    id: web::Path<Uuid>,
    payload: web::Json<AccountFormRuleUpdate>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let rule = validated_rule(payload.into_inner())?;
    account_form_rules::update(&mut conn, *id, &rule, user.id).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
DELETE `/api/v0/main-frontend/account-forms/rules/{id}` Deletes a rule; its versions stay.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    delete,
    path = "/rules/{id}",
    operation_id = "deleteAccountFormRule",
    tag = "account_forms",
    params(("id" = Uuid, Path, description = "Rule id")),
    responses((status = 200, description = "Deleted"))
)]
async fn delete_rule(
    pool: web::Data<PgPool>,
    user: AuthUser,
    id: web::Path<Uuid>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    account_form_rules::delete(&mut conn, *id, user.id).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
GET `/api/v0/main-frontend/account-forms/rules/{id}/versions` Every saved version of a rule, newest
first.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/rules/{id}/versions",
    operation_id = "getAccountFormRuleVersions",
    tag = "account_forms",
    params(("id" = Uuid, Path, description = "Rule id")),
    responses((status = 200, description = "Versions", body = Vec<AccountFormRuleVersion>))
)]
async fn get_rule_versions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<AccountFormRuleVersion>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let versions = account_form_rules::get_versions(&mut conn, *id).await?;
    token.authorized_ok(web::Json(versions))
}

/// A rule's matcher to try: an expression, or a list kind with its entries.
#[derive(Debug, Deserialize, ToSchema)]
pub struct RuleDryRunRequest {
    pub expression: Option<String>,
    pub list_kind: Option<AccountFormListKind>,
    #[serde(default)]
    pub list_entries: Vec<String>,
}

/// How a rule would have matched the latest logged submissions.
#[derive(Debug, Serialize, ToSchema)]
pub struct RuleDryRunResult {
    pub evaluated: i64,
    pub matched: i64,
    /// Submissions the expression could not be evaluated on, e.g. for lacking a signal.
    pub errors: i64,
    pub first_error: Option<String>,
    /// The latest matched submissions, at most a few dozen.
    pub examples: Vec<AccountFormDecision>,
}

/**
POST `/api/v0/main-frontend/account-forms/rules/dry-run` Evaluates a rule's matcher on the latest
logged submissions without saving anything.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/rules/dry-run",
    operation_id = "dryRunAccountFormRule",
    tag = "account_forms",
    request_body = RuleDryRunRequest,
    responses((status = 200, description = "How the rule would have matched", body = RuleDryRunResult))
)]
async fn dry_run_rule(
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<RuleDryRunRequest>,
) -> ControllerResult<web::Json<RuleDryRunResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let matcher = match (&payload.expression, payload.list_kind) {
        (Some(expression), None) => Ok(compile_expression(expression)?),
        (None, Some(kind)) => Err(rules::ListMatcher::new(
            kind,
            &normalized_entries(kind, &payload.list_entries)?,
        )),
        _ => {
            return Err(controller_err!(
                BadRequest,
                "A rule has either an expression or a list.".to_string()
            ));
        }
    };
    let decisions = account_form_decisions::list(&mut conn, None, DRY_RUN_DECISION_LIMIT).await?;
    let mut result = RuleDryRunResult {
        evaluated: 0,
        matched: 0,
        errors: 0,
        first_error: None,
        examples: Vec::new(),
    };
    for decision in decisions {
        result.evaluated += 1;
        let matched = match &matcher {
            Ok(program) => rules::evaluate(
                program,
                decision.action,
                &Signals::from_json(&decision.signals),
            ),
            Err(list) => Ok(list.matches(&RuleSubject {
                address_digest: decision.address_digest.clone(),
                mailbox_digest: decision.mailbox_digest.clone(),
                user_id: decision.user_id,
                domain: decision.recipient_domain.clone(),
            })),
        };
        match matched {
            Ok(true) => {
                result.matched += 1;
                if result.examples.len() < DRY_RUN_EXAMPLE_LIMIT {
                    result.examples.push(decision);
                }
            }
            Ok(false) => {}
            Err(e) => {
                result.errors += 1;
                result.first_error.get_or_insert(e);
            }
        }
    }
    token.authorized_ok(web::Json(result))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/settings", web::get().to(get_settings))
        .route("/settings", web::put().to(update_settings))
        .route("/decisions", web::get().to(get_decisions))
        .route("/decisions/lookup", web::post().to(lookup_decisions))
        .route("/rules", web::get().to(get_rules))
        .route("/rules", web::post().to(create_rule))
        .route("/rules/dry-run", web::post().to(dry_run_rule))
        .route("/rules/{id}", web::put().to(update_rule))
        .route("/rules/{id}", web::delete().to(delete_rule))
        .route("/rules/{id}/versions", web::get().to(get_rule_versions));
}
