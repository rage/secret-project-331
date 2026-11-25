//! Admin-written rules over account form submissions, with their version history. A rule matches
//! by a CEL expression over the submission's signals or by a list of entries. Rules are only ever
//! soft-deleted, and their versions are never deleted.

use utoipa::ToSchema;

use crate::account_form_decisions::AccountFormOutcome;
use crate::prelude::*;

/// What the entries of a list rule are matched against.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Hash, Clone, Copy, sqlx::Type, ToSchema)]
#[sqlx(type_name = "account_form_list_kind", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AccountFormListKind {
    /// The exact address, ignoring case.
    Address,
    /// The mailbox, ignoring case, tags and provider aliases.
    Mailbox,
    /// The account id.
    Account,
    /// The address's domain or any of its subdomains.
    Domain,
}

/// A rule as it is now. Matches by `expression` or by the list, never both.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountFormRule {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub description: String,
    /// `None` for a list rule.
    pub expression: Option<String>,
    /// `None` for an expression rule.
    pub list_kind: Option<AccountFormListKind>,
    pub list_entries: Vec<String>,
    /// [`AccountFormOutcome::Allow`] or [`AccountFormOutcome::Drop`].
    pub outcome: AccountFormOutcome,
    pub enabled: bool,
    pub log_only: bool,
}

/// A rule as an admin saves it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountFormRuleUpdate {
    pub name: String,
    pub description: String,
    /// `None` for a list rule.
    pub expression: Option<String>,
    /// `None` for an expression rule.
    pub list_kind: Option<AccountFormListKind>,
    pub list_entries: Vec<String>,
    /// [`AccountFormOutcome::Allow`] or [`AccountFormOutcome::Drop`].
    pub outcome: AccountFormOutcome,
    pub enabled: bool,
    pub log_only: bool,
}

/// One saved version of a rule.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountFormRuleVersion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub changed_by_user_id: Uuid,
    pub name: String,
    pub description: String,
    /// `None` for a list rule.
    pub expression: Option<String>,
    /// `None` for an expression rule.
    pub list_kind: Option<AccountFormListKind>,
    pub list_entries: Vec<String>,
    /// [`AccountFormOutcome::Allow`] or [`AccountFormOutcome::Drop`].
    pub outcome: AccountFormOutcome,
    pub enabled: bool,
    pub log_only: bool,
    /// Whether this save deleted the rule.
    pub deleted: bool,
}

/// The rules that are not deleted, oldest first.
pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<AccountFormRule>> {
    let rules = sqlx::query_as!(
        AccountFormRule,
        r#"
SELECT id,
  created_at,
  updated_at,
  name,
  description,
  expression,
  list_kind,
  list_entries,
  outcome,
  enabled,
  log_only
FROM account_form_rules
WHERE deleted_at IS NULL
ORDER BY created_at
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(rules)
}

/// The rules to evaluate on a submission, oldest first.
pub async fn get_enabled(conn: &mut PgConnection) -> ModelResult<Vec<AccountFormRule>> {
    let rules = sqlx::query_as!(
        AccountFormRule,
        r#"
SELECT id,
  created_at,
  updated_at,
  name,
  description,
  expression,
  list_kind,
  list_entries,
  outcome,
  enabled,
  log_only
FROM account_form_rules
WHERE deleted_at IS NULL
  AND enabled
ORDER BY created_at
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(rules)
}

/// Creates a rule and records its first version.
pub async fn insert(
    conn: &mut PgConnection,
    rule: &AccountFormRuleUpdate,
    changed_by: Uuid,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO account_form_rules (
    name,
    description,
    expression,
    list_kind,
    list_entries,
    outcome,
    enabled,
    log_only
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
"#,
        rule.name,
        rule.description,
        rule.expression,
        rule.list_kind as Option<AccountFormListKind>,
        &rule.list_entries,
        rule.outcome as AccountFormOutcome,
        rule.enabled,
        rule.log_only,
    )
    .fetch_one(&mut *tx)
    .await?;
    insert_version(&mut tx, id, rule, changed_by, false).await?;
    tx.commit().await?;
    Ok(id)
}

/// Saves a rule and records the version. Errors with `NotFound` for a deleted or unknown rule.
pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    rule: &AccountFormRuleUpdate,
    changed_by: Uuid,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    sqlx::query_scalar!(
        r#"
UPDATE account_form_rules
SET name = $2,
  description = $3,
  expression = $4,
  list_kind = $5,
  list_entries = $6,
  outcome = $7,
  enabled = $8,
  log_only = $9
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id
"#,
        id,
        rule.name,
        rule.description,
        rule.expression,
        rule.list_kind as Option<AccountFormListKind>,
        &rule.list_entries,
        rule.outcome as AccountFormOutcome,
        rule.enabled,
        rule.log_only,
    )
    .fetch_one(&mut *tx)
    .await?;
    insert_version(&mut tx, id, rule, changed_by, false).await?;
    tx.commit().await?;
    Ok(())
}

/// Soft-deletes a rule and records the deletion as a version.
pub async fn delete(conn: &mut PgConnection, id: Uuid, changed_by: Uuid) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    let rule = sqlx::query_as!(
        AccountFormRuleUpdate,
        r#"
UPDATE account_form_rules
SET deleted_at = now()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING name,
  description,
  expression,
  list_kind,
  list_entries,
  outcome,
  enabled,
  log_only
"#,
        id,
    )
    .fetch_one(&mut *tx)
    .await?;
    insert_version(&mut tx, id, &rule, changed_by, true).await?;
    tx.commit().await?;
    Ok(())
}

async fn insert_version(
    conn: &mut PgConnection,
    rule_id: Uuid,
    rule: &AccountFormRuleUpdate,
    changed_by: Uuid,
    deleted: bool,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO account_form_rule_versions (
    account_form_rule_id,
    changed_by_user_id,
    name,
    description,
    expression,
    list_kind,
    list_entries,
    outcome,
    enabled,
    log_only,
    deleted
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
"#,
        rule_id,
        changed_by,
        rule.name,
        rule.description,
        rule.expression,
        rule.list_kind as Option<AccountFormListKind>,
        &rule.list_entries,
        rule.outcome as AccountFormOutcome,
        rule.enabled,
        rule.log_only,
        deleted,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Every saved version of the rule, deleted rules included, newest first.
pub async fn get_versions(
    conn: &mut PgConnection,
    rule_id: Uuid,
) -> ModelResult<Vec<AccountFormRuleVersion>> {
    let versions = sqlx::query_as!(
        AccountFormRuleVersion,
        r#"
SELECT id,
  created_at,
  changed_by_user_id,
  name,
  description,
  expression,
  list_kind,
  list_entries,
  outcome,
  enabled,
  log_only,
  deleted
FROM account_form_rule_versions
WHERE account_form_rule_id = $1
ORDER BY created_at DESC,
  id DESC
"#,
        rule_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(versions)
}
