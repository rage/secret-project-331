//! The checks on the account forms that mail an address: signup, password reset and email change.
//! [`may_send_mail`] evaluates the admin-written [rules] on a submission and logs it in
//! [`headless_lms_models::account_form_decisions`]. The handler then mails only when it returns
//! true, and otherwise answers exactly as if it had.

pub mod client_report;
pub mod headers;
pub mod rules;
pub mod signals;

use std::sync::LazyLock;

use chrono::Duration;
use headless_lms_models::{
    account_form_decisions::{
        self, AccountFormAction, AccountFormOutcome, DecisionKey, NewAccountFormDecision,
    },
    account_form_rules, account_form_settings, email_address_mail_budgets,
};
use headless_lms_utils::ip_to_country::IpToCountryMapper;
use regex::Regex;
use secrecy::ExposeSecret;
use serde_json::Value;

use crate::config::server_runtime_config;
use crate::domain::request_network::{keyed_digest, prefix};
use crate::domain::session_verification::client_ip;
use crate::prelude::*;
use rules::RuleSubject;
use signals::{Signals, count};

/// How long logged submissions are kept.
pub const RETENTION_DAYS: i64 = 90;

static LINK_LIKE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(://|www\.|[a-z0-9-]+\.[a-z]{2,}(/|\b))").expect("valid regex")
});

/// What a signup typed about the person.
pub struct Profile<'a> {
    pub first_name: &'a str,
    pub last_name: &'a str,
    pub country: &'a str,
}

/// One submitted form to check.
pub struct Submission<'a> {
    pub action: AccountFormAction,
    pub request: &'a HttpRequest,
    /// The form's opaque `client_info` field.
    pub client_report: Option<&'a str>,
    /// The address the form would mail.
    pub email: Option<&'a str>,
    /// The account the form is about, or `None` when `email` has none.
    pub user_id: Option<Uuid>,
    pub profile: Option<Profile<'a>>,
}

/// Evaluates the rules on the submission, logs it and returns whether it may mail. When it may not,
/// the handler must answer as if it succeeded. Never fails the request: on an error it may mail.
pub async fn may_send_mail(
    conn: &mut PgConnection,
    ip_to_country: &IpToCountryMapper,
    submission: &Submission<'_>,
) -> bool {
    match try_assess(conn, ip_to_country, submission).await {
        Ok(outcome) => outcome == AccountFormOutcome::Allow,
        Err(e) => {
            error!("Failed to check an account form submission: {e:#}");
            true
        }
    }
}

async fn try_assess(
    conn: &mut PgConnection,
    ip_to_country: &IpToCountryMapper,
    submission: &Submission<'_>,
) -> anyhow::Result<AccountFormOutcome> {
    let settings = account_form_settings::get(conn).await?;
    let enabled_rules = account_form_rules::get_enabled(conn).await?;
    let subject = RuleSubject::new(submission.email, submission.user_id);
    let mut signals = Signals::default();
    let profile_digest =
        add_signals(conn, ip_to_country, submission, &subject, &mut signals).await?;
    let decision = rules::decide(
        &enabled_rules,
        submission.action,
        &signals,
        &subject,
        settings.rules_log_only,
    );
    account_form_decisions::insert(
        conn,
        &NewAccountFormDecision {
            action: submission.action,
            outcome: decision.outcome,
            matched_rule_ids: decision.matched_rule_ids,
            signals: signals.as_json(),
            address_digest: subject.address_digest,
            mailbox_digest: subject.mailbox_digest,
            user_id: subject.user_id,
            recipient_domain: subject.domain,
            profile_digest,
            network_prefix: client_ip(submission.request).map(prefix),
        },
    )
    .await?;
    Ok(decision.outcome)
}

/// Adds the request's, the recipient's and the profile's signals. Returns the profile digest.
async fn add_signals(
    conn: &mut PgConnection,
    ip_to_country: &IpToCountryMapper,
    submission: &Submission<'_>,
    subject: &RuleSubject,
    signals: &mut Signals,
) -> anyhow::Result<Option<Vec<u8>>> {
    let request = submission.request;
    let ip = client_ip(request);
    let header = |name: &str| headers::header(request, name);
    headers::add_signals(signals, request, &EXPECTED_HOST);
    client_report::add_signals(
        signals,
        submission.client_report,
        &client_report::RequestFacts {
            user_agent: header("user-agent").unwrap_or_default(),
            accept_language: header("accept-language"),
            client_hints_platform: header("sec-ch-ua-platform"),
        },
    );

    let since_day = Utc::now() - Duration::days(1);

    let country = ip.and_then(|ip| ip_to_country.map_ip_to_country(&ip).map(str::to_string));
    signals.set("network", "country", country.clone().map(Value::from));
    if let Some(ip) = ip {
        let network = prefix(ip);
        set_request_counts(
            conn,
            signals,
            "network",
            "prefix_requests",
            DecisionKey::NetworkPrefix(&network),
            false,
        )
        .await?;
        signals.set("network", "prefix", Value::from(network));
    }

    if let (Some(domain), Some(digest)) = (&subject.domain, &subject.address_digest) {
        signals.set("recipient", "domain", Value::from(domain.clone()));
        signals.set(
            "recipient",
            "has_account",
            Value::from(subject.user_id.is_some()),
        );
        set_request_counts(
            conn,
            signals,
            "recipient",
            "address_requests",
            DecisionKey::AddressDigest(digest),
            true,
        )
        .await?;
        set_request_counts(
            conn,
            signals,
            "recipient",
            "domain_requests",
            DecisionKey::RecipientDomain(domain),
            false,
        )
        .await?;
        if submission.action != AccountFormAction::Signup {
            let last_signup = account_form_decisions::latest_for_address(
                conn,
                digest,
                AccountFormAction::Signup,
                since_day,
            )
            .await?;
            signals.set(
                "sequence",
                "seconds_since_signup",
                last_signup.and_then(|at| count((Utc::now() - at).num_seconds())),
            );
        }
    }

    let Some(profile) = &submission.profile else {
        return Ok(None);
    };
    let digest = keyed_digest(
        "form-log-profile",
        &format!(
            "{}\n{}",
            normalized(profile.first_name),
            normalized(profile.last_name)
        ),
    );
    let name = format!("{} {}", profile.first_name, profile.last_name);
    signals.set("profile", "name_length", count(name.chars().count()));
    signals.set(
        "profile",
        "name_has_link",
        Value::from(LINK_LIKE.is_match(&name)),
    );
    signals.set(
        "profile",
        "name_has_digit",
        Value::from(name.chars().any(|c| c.is_ascii_digit())),
    );
    signals.set("profile", "country", Value::from(profile.country));
    signals.set(
        "profile",
        "country_matches_network",
        country
            .as_deref()
            .map(|country| Value::from(country.eq_ignore_ascii_case(profile.country))),
    );
    set_request_counts(
        conn,
        signals,
        "profile",
        "same_values",
        DecisionKey::SignupProfileDigest(&digest),
        true,
    )
    .await?;
    Ok(Some(digest))
}

/// Sets the signal `{namespace}.{name}_1h` to how many logged submissions in the last hour share
/// `key`, and with `with_day` also `{name}_24h` for the last day.
async fn set_request_counts(
    conn: &mut PgConnection,
    signals: &mut Signals,
    namespace: &str,
    name: &str,
    key: DecisionKey<'_>,
    with_day: bool,
) -> ModelResult<()> {
    let now = Utc::now();
    let since_hour = now - Duration::hours(1);
    let since = if with_day {
        now - Duration::days(1)
    } else {
        since_hour
    };
    let counts = account_form_decisions::count_recent(conn, key, since, since_hour).await?;
    signals.set(namespace, &format!("{name}_1h"), count(counts.recent));
    if with_day {
        signals.set(namespace, &format!("{name}_24h"), count(counts.total));
    }
    Ok(())
}

/// The key the log stores `email` under.
pub fn address_digest(email: &str) -> Vec<u8> {
    keyed_digest("form-log-address", &normalized(email))
}

/// The key of `email`'s mailbox, shared by its variants: tags, dots and provider aliases.
pub fn mailbox_digest(email: &str) -> Vec<u8> {
    email_address_mail_budgets::inbox_key(
        email,
        server_runtime_config()
            .form_context_secret
            .expose_secret()
            .as_bytes(),
    )
}

/// The lowercased domain of `email`.
fn domain_of(email: &str) -> Option<String> {
    let (_, domain) = email.trim().rsplit_once('@')?;
    let domain = domain.trim_end_matches('.').to_lowercase();
    (!domain.is_empty()).then_some(domain)
}

/// The host the forms are served from, which a same-site request's `Origin` names.
static EXPECTED_HOST: LazyLock<String> = LazyLock::new(|| {
    url::Url::parse(&server_runtime_config().app_conf.base_url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_default()
});

fn normalized(value: &str) -> String {
    value.trim().to_lowercase()
}
