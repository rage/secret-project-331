//! Admin settings of the [account form rules](crate::account_form_rules). One row at most; without
//! it the defaults apply.

use utoipa::ToSchema;

use crate::prelude::*;

#[derive(Debug, Default, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountFormSettings {
    /// Makes every account form rule log-only.
    pub rules_log_only: bool,
}

/// The settings, or the defaults when no admin has saved any.
pub async fn get(conn: &mut PgConnection) -> ModelResult<AccountFormSettings> {
    let settings = sqlx::query_as!(
        AccountFormSettings,
        r#"
SELECT rules_log_only
FROM account_form_settings
"#
    )
    .fetch_optional(conn)
    .await?;
    Ok(settings.unwrap_or_default())
}

pub async fn upsert(conn: &mut PgConnection, settings: &AccountFormSettings) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO account_form_settings (id, rules_log_only)
VALUES (TRUE, $1)
ON CONFLICT (id) DO UPDATE
SET rules_log_only = excluded.rules_log_only
"#,
        settings.rules_log_only,
    )
    .execute(conn)
    .await?;
    Ok(())
}
