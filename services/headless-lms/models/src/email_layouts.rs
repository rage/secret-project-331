//! The HTML shell outgoing emails are wrapped in. See `email_processor::wrap_in_layout`.

use crate::prelude::*;

/// The configured shell's HTML, or `None` when the sender should fall back to the bundled default.
pub async fn get_live_html(conn: &mut PgConnection) -> ModelResult<Option<String>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT html
FROM email_layouts
WHERE deleted_at IS NULL
        "#
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}
