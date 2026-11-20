//! Evaluating the admin-written [rules](headless_lms_models::account_form_rules) on a submission.
//! An expression sees each signal namespace as a variable, such as `header.language`, and the
//! submission's action as `action`, e.g. `"signup"`. A list rule matches the address, mailbox,
//! account or domain the submission is about.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};
use std::time::Duration;

use cel::{Context, Deadline, Env, Program, RuntimeOptions, Value as CelValue};
use headless_lms_models::account_form_decisions::{AccountFormAction, AccountFormOutcome};
use headless_lms_models::account_form_rules::{AccountFormListKind, AccountFormRule};

use super::signals::Signals;
use super::{address_digest, mailbox_digest};
use crate::prelude::*;

const MAX_ITERATIONS: u64 = 10_000;
const EVALUATION_TIMEOUT: Duration = Duration::from_millis(50);

static ENV: LazyLock<Arc<Env>> = LazyLock::new(|| {
    let mut env = Env::stdlib();
    env.set_options(RuntimeOptions::default().with_max_iterations(MAX_ITERATIONS));
    Arc::new(env)
});

/// Parses `expression`, with the parser's message on failure.
pub fn compile(expression: &str) -> Result<Program, String> {
    ENV.compile(expression).map_err(|e| e.to_string())
}

/// Whether `program` matches the submission. Errors when the expression fails, e.g. on a signal
/// the submission lacks, or yields no boolean.
pub fn evaluate(
    program: &Program,
    action: AccountFormAction,
    signals: &Signals,
) -> Result<bool, String> {
    let deadline = Deadline::after(EVALUATION_TIMEOUT);
    let mut context = Context::with_env(ENV.clone());
    for (namespace, values) in signals.namespaces() {
        let value = cel::to_value(values).map_err(|e| e.to_string())?;
        context.add_variable_from_value(namespace.clone(), value);
    }
    let action = serde_json::to_value(action).map_err(|e| e.to_string())?;
    context.add_variable_from_value("action", cel::to_value(&action).map_err(|e| e.to_string())?);
    context.set_interrupt(&deadline);
    match program.execute(&context).map_err(|e| e.to_string())? {
        CelValue::Bool(matched) => Ok(matched),
        other => Err(format!("expected a boolean, got {other:?}")),
    }
}

/// What a submission is about, in the forms the log keeps, so a list rule matches logged
/// submissions the same way as live ones.
#[derive(Debug, Default, Clone)]
pub struct RuleSubject {
    pub address_digest: Option<Vec<u8>>,
    pub mailbox_digest: Option<Vec<u8>>,
    pub user_id: Option<Uuid>,
    /// Lowercased.
    pub domain: Option<String>,
}

/// A list rule's entries in the forms [`RuleSubject`] holds. Build it once per evaluation of many
/// subjects: address and mailbox entries are hashed when it is built.
pub enum ListMatcher {
    Digests {
        is_mailbox: bool,
        digests: HashSet<Vec<u8>>,
    },
    Accounts(HashSet<Uuid>),
    /// Matched with their subdomains.
    Domains(Vec<String>),
}

impl ListMatcher {
    /// `entries` must be stored normalised; see [`normalize_list_entry`].
    pub fn new(kind: AccountFormListKind, entries: &[String]) -> Self {
        match kind {
            AccountFormListKind::Address => Self::Digests {
                is_mailbox: false,
                digests: entries.iter().map(|entry| address_digest(entry)).collect(),
            },
            AccountFormListKind::Mailbox => Self::Digests {
                is_mailbox: true,
                digests: entries.iter().map(|entry| mailbox_digest(entry)).collect(),
            },
            AccountFormListKind::Account => Self::Accounts(
                entries
                    .iter()
                    .filter_map(|entry| Uuid::parse_str(entry).ok())
                    .collect(),
            ),
            AccountFormListKind::Domain => Self::Domains(entries.to_vec()),
        }
    }

    /// Whether any entry names the subject.
    pub fn matches(&self, subject: &RuleSubject) -> bool {
        match self {
            Self::Digests {
                is_mailbox,
                digests,
            } => {
                let digest = if *is_mailbox {
                    &subject.mailbox_digest
                } else {
                    &subject.address_digest
                };
                digest
                    .as_ref()
                    .is_some_and(|digest| digests.contains(digest))
            }
            Self::Accounts(ids) => subject.user_id.is_some_and(|id| ids.contains(&id)),
            Self::Domains(domains) => subject.domain.as_deref().is_some_and(|domain| {
                domains.iter().any(|entry| {
                    domain == entry
                        || domain
                            .strip_suffix(entry.as_str())
                            .is_some_and(|rest| rest.ends_with('.'))
                })
            }),
        }
    }
}

/// `entry` as stored, or `None` when it cannot name anything of `kind`.
pub fn normalize_list_entry(kind: AccountFormListKind, entry: &str) -> Option<String> {
    let entry = entry.trim();
    match kind {
        AccountFormListKind::Account => Uuid::parse_str(entry).ok().map(|id| id.to_string()),
        AccountFormListKind::Address | AccountFormListKind::Mailbox => {
            entry.contains('@').then(|| entry.to_lowercase())
        }
        AccountFormListKind::Domain => {
            let domain = entry
                .trim_start_matches('@')
                .trim_matches('.')
                .to_lowercase();
            (!domain.is_empty() && !domain.contains('@')).then_some(domain)
        }
    }
}

/// Whether `rule` matches. Errors when its expression cannot be evaluated.
pub fn rule_matches(
    rule: &AccountFormRule,
    action: AccountFormAction,
    signals: &Signals,
    subject: &RuleSubject,
) -> Result<bool, String> {
    match (&rule.expression, rule.list_kind) {
        (Some(expression), _) => evaluate(&compile(expression)?, action, signals),
        (None, Some(kind)) => Ok(ListMatcher::new(kind, &rule.list_entries).matches(subject)),
        (None, None) => Err("the rule has neither an expression nor a list".to_string()),
    }
}

/// What the rules decided for a submission.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Decision {
    pub outcome: AccountFormOutcome,
    /// Every rule that matched, log-only ones included.
    pub matched_rule_ids: Vec<Uuid>,
}

/// Evaluates the enabled `rules` on a submission. Only enforced rules, those not log-only while
/// `rules_log_only` is off, decide the outcome, and an allow among them wins. A rule that fails to
/// evaluate does not match.
pub fn decide(
    rules: &[AccountFormRule],
    action: AccountFormAction,
    signals: &Signals,
    subject: &RuleSubject,
    rules_log_only: bool,
) -> Decision {
    let mut matched_rule_ids = Vec::new();
    let mut enforced = Vec::new();
    for rule in rules.iter().filter(|rule| rule.enabled) {
        match rule_matches(rule, action, signals, subject) {
            Ok(true) => {
                matched_rule_ids.push(rule.id);
                if !rule.log_only && !rules_log_only {
                    enforced.push(rule.outcome);
                }
            }
            Ok(false) => {}
            Err(e) => warn!("Account form rule {} could not be evaluated: {e}", rule.id),
        }
    }
    let outcome = if !enforced.contains(&AccountFormOutcome::Allow)
        && enforced.contains(&AccountFormOutcome::Drop)
    {
        AccountFormOutcome::Drop
    } else {
        AccountFormOutcome::Allow
    };
    Decision {
        outcome,
        matched_rule_ids,
    }
}
