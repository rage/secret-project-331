//! The admin-only log of the account forms, which also answers how many similar submissions came
//! recently.

use utoipa::ToSchema;

use crate::prelude::*;

/// Which account form a submission was for. Each of them mails an address.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Hash, Clone, Copy, sqlx::Type, ToSchema)]
#[sqlx(type_name = "account_form_action", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AccountFormAction {
    Signup,
    SignupCodeResend,
    PasswordReset,
    EmailChange,
}

/// What the account form rules decided for a submission, and the handler did.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Hash, Clone, Copy, sqlx::Type, ToSchema)]
#[sqlx(type_name = "account_form_outcome", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AccountFormOutcome {
    Allow,
    /// Answered as if it succeeded, while nothing was mailed.
    Drop,
}

/// A row to log.
#[derive(Debug, Clone)]
pub struct NewAccountFormDecision {
    pub action: AccountFormAction,
    pub outcome: AccountFormOutcome,
    /// Every enabled rule that matched, log-only ones included.
    pub matched_rule_ids: Vec<Uuid>,
    /// Must hold only coarse values, never addresses, names or raw headers.
    pub signals: serde_json::Value,
    pub address_digest: Option<Vec<u8>>,
    pub mailbox_digest: Option<Vec<u8>>,
    pub user_id: Option<Uuid>,
    pub recipient_domain: Option<String>,
    pub profile_digest: Option<Vec<u8>>,
    /// A network in CIDR notation, such as `192.0.2.0/24`.
    pub network_prefix: Option<String>,
}

/// A logged submission, as the admin page shows it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountFormDecision {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub action: AccountFormAction,
    pub outcome: AccountFormOutcome,
    pub matched_rule_ids: Vec<Uuid>,
    pub signals: serde_json::Value,
    pub user_id: Option<Uuid>,
    pub recipient_domain: Option<String>,
    pub network_prefix: Option<String>,
    /// For matching list rules in a dry run; not sent to the browser.
    #[serde(skip)]
    pub address_digest: Option<Vec<u8>>,
    #[serde(skip)]
    pub mailbox_digest: Option<Vec<u8>>,
}

/// Logs a submission and returns the row's id.
pub async fn insert(
    conn: &mut PgConnection,
    decision: &NewAccountFormDecision,
) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO account_form_decisions (
    action,
    outcome,
    matched_rule_ids,
    signals,
    address_digest,
    mailbox_digest,
    user_id,
    recipient_domain,
    profile_digest,
    network_prefix
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text::cidr)
RETURNING id
"#,
        decision.action as AccountFormAction,
        decision.outcome as AccountFormOutcome,
        &decision.matched_rule_ids,
        decision.signals,
        decision.address_digest,
        decision.mailbox_digest,
        decision.user_id,
        decision.recipient_domain,
        decision.profile_digest,
        decision.network_prefix,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// What [`count_recent`] counts logged submissions by.
#[derive(Debug, Clone, Copy)]
pub enum DecisionKey<'a> {
    /// A network in CIDR notation.
    NetworkPrefix(&'a str),
    AddressDigest(&'a [u8]),
    RecipientDomain(&'a str),
    /// Signups only.
    SignupProfileDigest(&'a [u8]),
}

/// Logged submissions counted over two windows that end now.
#[derive(Debug, Clone, Copy)]
pub struct RecentCounts {
    pub total: i64,
    pub recent: i64,
}

/// How many logged submissions with `key` came after `since`, and how many of those after
/// `recent_since`, which must not be earlier than `since`.
pub async fn count_recent(
    conn: &mut PgConnection,
    key: DecisionKey<'_>,
    since: DateTime<Utc>,
    recent_since: DateTime<Utc>,
) -> ModelResult<RecentCounts> {
    let counts = match key {
        DecisionKey::NetworkPrefix(network_prefix) => {
            sqlx::query_as!(
                RecentCounts,
                r#"
SELECT count(*) AS "total!",
  count(*) FILTER (
    WHERE created_at > $3
  ) AS "recent!"
FROM account_form_decisions
WHERE network_prefix = $1::text::cidr
  AND created_at > $2
"#,
                network_prefix,
                since,
                recent_since,
            )
            .fetch_one(conn)
            .await?
        }
        DecisionKey::AddressDigest(address_digest) => {
            sqlx::query_as!(
                RecentCounts,
                r#"
SELECT count(*) AS "total!",
  count(*) FILTER (
    WHERE created_at > $3
  ) AS "recent!"
FROM account_form_decisions
WHERE address_digest = $1
  AND created_at > $2
"#,
                address_digest,
                since,
                recent_since,
            )
            .fetch_one(conn)
            .await?
        }
        DecisionKey::RecipientDomain(recipient_domain) => {
            sqlx::query_as!(
                RecentCounts,
                r#"
SELECT count(*) AS "total!",
  count(*) FILTER (
    WHERE created_at > $3
  ) AS "recent!"
FROM account_form_decisions
WHERE recipient_domain = $1
  AND created_at > $2
"#,
                recipient_domain,
                since,
                recent_since,
            )
            .fetch_one(conn)
            .await?
        }
        DecisionKey::SignupProfileDigest(profile_digest) => {
            sqlx::query_as!(
                RecentCounts,
                r#"
SELECT count(*) AS "total!",
  count(*) FILTER (
    WHERE created_at > $3
  ) AS "recent!"
FROM account_form_decisions
WHERE profile_digest = $1
  AND action = 'signup'
  AND created_at > $2
"#,
                profile_digest,
                since,
                recent_since,
            )
            .fetch_one(conn)
            .await?
        }
    };
    Ok(counts)
}

/// When the latest `action` about the address was logged, if since `since`.
pub async fn latest_for_address(
    conn: &mut PgConnection,
    address_digest: &[u8],
    action: AccountFormAction,
    since: DateTime<Utc>,
) -> ModelResult<Option<DateTime<Utc>>> {
    let latest = sqlx::query_scalar!(
        r#"
SELECT max(created_at)
FROM account_form_decisions
WHERE address_digest = $1
  AND action = $2
  AND created_at > $3
"#,
        address_digest,
        action as AccountFormAction,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(latest)
}

/// The latest logged submissions, newest first. `before` is the `(created_at, id)` of the last row
/// of the previous page.
pub async fn list(
    conn: &mut PgConnection,
    before: Option<(DateTime<Utc>, Uuid)>,
    limit: i64,
) -> ModelResult<Vec<AccountFormDecision>> {
    let rows = sqlx::query_as!(
        AccountFormDecision,
        r#"
SELECT id,
  created_at,
  action,
  outcome,
  matched_rule_ids,
  signals,
  user_id,
  recipient_domain,
  network_prefix::text AS network_prefix,
  address_digest,
  mailbox_digest
FROM account_form_decisions
WHERE (
    $1::timestamptz IS NULL
    OR (created_at, id) < ($1, $2::uuid)
  )
ORDER BY created_at DESC,
  id DESC
LIMIT $3
"#,
        before.map(|(created_at, _)| created_at),
        before.map(|(_, id)| id),
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// The latest logged submissions about one address, newest first.
pub async fn list_for_address(
    conn: &mut PgConnection,
    address_digest: &[u8],
    limit: i64,
) -> ModelResult<Vec<AccountFormDecision>> {
    let rows = sqlx::query_as!(
        AccountFormDecision,
        r#"
SELECT id,
  created_at,
  action,
  outcome,
  matched_rule_ids,
  signals,
  user_id,
  recipient_domain,
  network_prefix::text AS network_prefix,
  address_digest,
  mailbox_digest
FROM account_form_decisions
WHERE address_digest = $1
ORDER BY created_at DESC,
  id DESC
LIMIT $2
"#,
        address_digest,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// Hard-deletes rows logged before `before`. Returns how many went.
pub async fn delete_older_than(conn: &mut PgConnection, before: DateTime<Utc>) -> ModelResult<u64> {
    let result = sqlx::query!(
        r#"
DELETE FROM account_form_decisions
WHERE created_at < $1
"#,
        before,
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected())
}
