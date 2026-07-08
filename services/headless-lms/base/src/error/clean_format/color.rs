/*!
Color handling for the clean error formatter.

Coloring is intentionally minimal: only the error type line and section labels are
emphasised. The decision to emit ANSI escapes is centralised here so that `Debug`
output (consumed by the DB error report, `{:?}` in arbitrary logs, and log
aggregators) stays plain, while the interactive console log can opt into color when
stderr is a TTY.
*/

use std::io::IsTerminal;
use std::sync::OnceLock;

/// Whether the process-wide "auto" color decision resolved to enabled. Set once at
/// startup via [`init_auto`]; defaults to disabled (plain) until then, which keeps
/// every code path safe by default.
static AUTO_ENABLED: OnceLock<bool> = OnceLock::new();

/// How the clean formatter should decide whether to emit ANSI color.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ColorChoice {
    /// Follow the process-wide decision set by [`init_auto`] (TTY + env based).
    Auto,
    /// Always emit color.
    Always,
    /// Never emit color. Used for `Debug`, the DB report and other non-TTY sinks.
    Never,
}

impl ColorChoice {
    /// Resolve this choice to a concrete on/off decision.
    pub fn enabled(self) -> bool {
        match self {
            ColorChoice::Always => true,
            ColorChoice::Never => false,
            ColorChoice::Auto => AUTO_ENABLED.get().copied().unwrap_or(false),
        }
    }
}

/// Resolve the process-wide "auto" color decision once, at startup.
///
/// Enabled only when stderr is a terminal and `NO_COLOR` is unset; `FORCE_COLOR`
/// forces it on. Safe to call more than once (only the first call takes effect).
pub fn init_auto() {
    let _ = AUTO_ENABLED.set(compute_auto());
}

fn compute_auto() -> bool {
    if std::env::var_os("NO_COLOR").is_some() {
        return false;
    }
    if std::env::var_os("FORCE_COLOR").is_some() {
        return true;
    }
    std::io::stderr().is_terminal()
}

/// Wrap `text` in the dim/faint SGR sequence when `colored`, otherwise return it as-is.
pub fn dim(text: &str, colored: bool) -> String {
    if colored {
        format!("\x1b[2m{text}\x1b[0m")
    } else {
        text.to_string()
    }
}

/// Wrap `text` in the bold SGR sequence when `colored`, otherwise return it as-is.
pub fn bold(text: &str, colored: bool) -> String {
    if colored {
        format!("\x1b[1m{text}\x1b[0m")
    } else {
        text.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn never_and_always_are_unconditional() {
        assert!(!ColorChoice::Never.enabled());
        assert!(ColorChoice::Always.enabled());
    }

    #[test]
    fn dim_and_bold_are_plain_when_not_colored() {
        assert_eq!(dim("hi", false), "hi");
        assert_eq!(bold("hi", false), "hi");
        assert!(!dim("hi", false).contains('\x1b'));
    }

    #[test]
    fn dim_and_bold_emit_escapes_when_colored() {
        assert!(dim("hi", true).contains("\x1b["));
        assert!(bold("hi", true).contains("\x1b["));
    }
}
