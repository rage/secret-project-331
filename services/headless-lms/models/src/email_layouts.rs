//! The HTML shells outgoing emails are wrapped in. See `email_processor::wrap_in_layout`.

use crate::prelude::*;

/// A configured shell, as opposed to the default bundled in the code.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailLayout {
    pub id: Uuid,
    /// `None` for the fallback shell.
    pub language: Option<String>,
    pub html: String,
    /// `#RRGGBB`.
    pub button_background_color: String,
    /// `#RRGGBB`.
    pub button_text_color: String,
}

/// Every live shell, at most one per language. Pick one for an email with `find_for_language`.
pub async fn get_all_live(conn: &mut PgConnection) -> ModelResult<Vec<EmailLayout>> {
    let res = sqlx::query_as!(
        EmailLayout,
        r#"
SELECT id,
  language,
  html,
  button_background_color,
  button_text_color
FROM email_layouts
WHERE deleted_at IS NULL
        "#
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The shell for an email in `language` (a BCP 47 tag such as "fi" or "fi-FI"): the exact match,
/// else the match on its primary subtag, else the language-less shell. Case-insensitive. `None`
/// means the bundled default applies.
pub fn find_for_language<'a>(
    layouts: &'a [EmailLayout],
    language: Option<&str>,
) -> Option<&'a EmailLayout> {
    let with_language = |wanted: &str| {
        layouts.iter().find(|layout| {
            layout
                .language
                .as_deref()
                .is_some_and(|language| language.eq_ignore_ascii_case(wanted))
        })
    };
    let language = language
        .map(str::trim)
        .filter(|language| !language.is_empty());
    language
        .and_then(|language| {
            with_language(language).or_else(|| {
                let (primary, _) = language.split_once(['-', '_'])?;
                with_language(primary)
            })
        })
        .or_else(|| layouts.iter().find(|layout| layout.language.is_none()))
}
