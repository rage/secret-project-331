/*!
Color handling for the clean error formatter.

Centralised so `Debug` output (DB report, `{:?}`, aggregators) stays plain while the
console log can use color on a TTY. Only the type line and section labels are colored.
*/

use std::io::IsTerminal;
use std::sync::OnceLock;

/// The process-wide "auto" decision, set once by [`init_auto`]. Defaults to off (plain).
static AUTO_ENABLED: OnceLock<bool> = OnceLock::new();

/// How to decide whether to emit ANSI color.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ColorChoice {
    /// Follow the process-wide [`init_auto`] decision.
    Auto,
    /// Always color.
    Always,
    /// Never color. Used by `Debug` and other non-TTY sinks.
    Never,
}

impl ColorChoice {
    /// Resolve to on/off.
    pub fn enabled(self) -> bool {
        match self {
            ColorChoice::Always => true,
            ColorChoice::Never => false,
            ColorChoice::Auto => AUTO_ENABLED.get().copied().unwrap_or(false),
        }
    }
}

/// Resolve the "auto" decision once at startup: on when stderr is a TTY and `NO_COLOR`
/// is unset; `FORCE_COLOR` forces it on. Only the first call takes effect.
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

/// Dim `text` when `colored`, else return it unchanged.
pub fn dim(text: &str, colored: bool) -> String {
    if colored {
        format!("\x1b[2m{text}\x1b[0m")
    } else {
        text.to_string()
    }
}

/// Bold `text` when `colored`, else return it unchanged.
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
