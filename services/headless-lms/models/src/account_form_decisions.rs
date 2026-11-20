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

/// Which logged submissions [`count_since`] counts. Unset fields match anything.
#[derive(Debug, Default, Clone)]
pub struct DecisionFilter<'a> {
    pub action: Option<AccountFormAction>,
    pub address_digest: Option<&'a [u8]>,
    pub recipient_domain: Option<&'a str>,
    pub profile_digest: Option<&'a [u8]>,
    /// A network in CIDR notation.
    pub network_prefix: Option<&'a str>,
}

/// How many logged submissions since `since` match `filter`.
pub async fn count_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
    filter: &DecisionFilter<'_>,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT count(*) AS "count!"
FROM account_form_decisions
WHERE created_at > $1
  AND (
    $2::account_form_action IS NULL
    OR action = $2
  )
  AND (
    $3::bytea IS NULL
    OR address_digest = $3
  )
  AND (
    $4::text IS NULL
    OR recipient_domain = $4
  )
  AND (
    $5::bytea IS NULL
    OR profile_digest = $5
  )
  AND (
    $6::text IS NULL
    OR network_prefix = $6::text::cidr
  )
"#,
        since,
        filter.action as Option<AccountFormAction>,
        filter.address_digest,
        filter.recipient_domain,
        filter.profile_digest,
        filter.network_prefix,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
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

/// The latest logged submissions, newest first, optionally only those before `before`.
pub async fn list(
    conn: &mut PgConnection,
    before: Option<DateTime<Utc>>,
    limit: i64,
) -> ModelResult<Vec<AccountFormDecision>> {
    let rows = sqlx::query_as!(
        AccountFormDecision,
        r#"
SELECT id,
  created_at,
  action AS "action: AccountFormAction",
  outcome AS "outcome: AccountFormOutcome",
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
    OR created_at < $1
  )
ORDER BY created_at DESC
LIMIT $2
"#,
        before,
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
  action AS "action: AccountFormAction",
  outcome AS "outcome: AccountFormOutcome",
  matched_rule_ids,
  signals,
  user_id,
  recipient_domain,
  network_prefix::text AS network_prefix,
  address_digest,
  mailbox_digest
FROM account_form_decisions
WHERE address_digest = $1
ORDER BY created_at DESC
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
