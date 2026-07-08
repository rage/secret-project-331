/*!
Stack-frame extraction, classification and rendering for the clean error formatter.

The goal is a stack that shows only *our* code: the line where the error was raised
(taken from the captured [`std::panic::Location`] when it is meaningful, otherwise from
the backtrace) followed by our-code caller frames, with runs of third-party / runtime
frames collapsed into a single "N framework frames hidden" marker.

Everything here is split into small pure functions operating on [`FrameView`] so the
classification and rendering can be unit-tested without capturing a real backtrace.
*/

use core::fmt;

use backtrace::Backtrace;

use super::color::dim;

/// A single stack frame reduced to the fields we care about.
#[derive(Debug, Clone)]
pub struct FrameView {
    /// Cleaned, human-friendly function name (last path segment, closures stripped).
    pub function: String,
    /// The full demangled symbol, kept for classification.
    pub raw_symbol: String,
    /// Source file path, cleaned to a workspace-relative form when possible.
    pub file: Option<String>,
    /// Source line number.
    pub line: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    /// Error-construction / conversion machinery — always hidden.
    Infra,
    /// Third-party crate or the standard library / async runtime — collapsed.
    Foreign,
    /// Our own code — shown.
    Ours,
}

/// Path fragments that identify error-infrastructure source files.
///
/// Note: `macros.rs` is deliberately absent — the `*_err!` expansion attributes the
/// raise call site to `.../error/macros.rs`, and that frame is the one we want to keep
/// (relabelled with the real [`Location`]).
const INFRA_FILE_FRAGMENTS: &[&str] = &[
    "backend_error.rs",
    "/clean_format/",
    "chatbot_error.rs",
    "util_error.rs",
    "/domain/error.rs",
    "/models/src/error.rs",
];

/// Symbol substrings that mark a frame as error-construction / conversion machinery.
const INFRA_SYMBOL_FRAGMENTS: &[&str] = &[
    "BackendError",
    "convert::From<",
    "backtrace::Backtrace",
    "SpanTrace",
    "clean_format",
];

/// True if a source path belongs to error infrastructure (so a `Location` pointing
/// there — e.g. a `From` impl body — should be treated as not meaningful).
pub fn is_infra_path(path: &str) -> bool {
    INFRA_FILE_FRAGMENTS.iter().any(|frag| path.contains(frag))
}

fn is_infra(symbol: &str, file: Option<&str>) -> bool {
    if INFRA_SYMBOL_FRAGMENTS
        .iter()
        .any(|frag| symbol.contains(frag))
    {
        return true;
    }
    matches!(file, Some(f) if is_infra_path(f))
}

fn is_ours(symbol: &str) -> bool {
    symbol.contains("headless_lms")
}

fn classify(symbol: &str, file: Option<&str>) -> Kind {
    if is_infra(symbol, file) {
        Kind::Infra
    } else if is_ours(symbol) {
        Kind::Ours
    } else {
        Kind::Foreign
    }
}

/// Reduce a full demangled symbol to a readable function name: drop the `::hXXXX`
/// hash suffix and `::{{closure}}` wrappers, then keep the last `::` segment.
pub fn clean_function(symbol: &str) -> String {
    if symbol.is_empty() {
        return "<unknown>".to_string();
    }
    let mut s = symbol;
    // Strip repeated `::{{closure}}` suffixes.
    while let Some(stripped) = s.strip_suffix("::{{closure}}") {
        s = stripped;
    }
    // Strip a trailing `::h<hex>` disambiguator.
    if let Some(idx) = s.rfind("::h") {
        let tail = &s[idx + 3..];
        if !tail.is_empty() && tail.bytes().all(|b| b.is_ascii_hexdigit()) {
            s = &s[..idx];
        }
    }
    // Keep the last path segment.
    match s.rsplit_once("::") {
        Some((_, last)) if !last.is_empty() => last.to_string(),
        _ => s.to_string(),
    }
}

/// Clean a source path to a workspace-relative form for display.
pub fn clean_path(path: &str) -> String {
    if let Some(idx) = path.find("headless-lms/") {
        return path[idx + "headless-lms/".len()..].to_string();
    }
    if let Ok(cwd) = std::env::current_dir()
        && let Ok(stripped) = std::path::Path::new(path).strip_prefix(&cwd)
    {
        return stripped.display().to_string();
    }
    path.to_string()
}

/// Extract the frames of a backtrace as [`FrameView`]s. Resolves a clone so that a
/// backtrace captured unresolved (cheap) is symbolized only when actually formatted.
pub fn extract_frames(backtrace: &Backtrace) -> Vec<FrameView> {
    let mut backtrace = backtrace.clone();
    backtrace.resolve();
    backtrace
        .frames()
        .iter()
        .map(|frame| {
            let symbol = frame.symbols().first();
            let raw_symbol = symbol
                .and_then(|s| s.name())
                .map(|n| format!("{n}"))
                .unwrap_or_default();
            let file = symbol
                .and_then(|s| s.filename())
                .map(|p| clean_path(&p.display().to_string()));
            let line = symbol.and_then(|s| s.lineno());
            FrameView {
                function: clean_function(&raw_symbol),
                raw_symbol,
                file,
                line,
            }
        })
        .collect()
}

fn hidden_marker(n: usize) -> String {
    let word = if n == 1 { "frame" } else { "frames" };
    format!("⋯ {n} framework {word} hidden ⋯")
}

fn format_frame(file: &str, line: Option<u32>, function: &str) -> String {
    match line {
        Some(line) => format!("{file}:{line}  {function}"),
        None => format!("{file}  {function}"),
    }
}

/// Render the merged raise-site + caller stack for one error node.
///
/// - `frames` are the node's backtrace frames (innermost first).
/// - `raise_override` is the `(file, line)` from the captured `Location` to use for the
///   raise line when it is meaningful; the caller decides meaningfulness (see
///   [`is_infra_path`]). When `None`, the raise frame's own file:line is used.
/// - `indent` is the leading indentation for the raise line; caller frames are indented
///   three spaces further.
pub fn render_stack(
    out: &mut dyn fmt::Write,
    frames: &[FrameView],
    raise_override: Option<(&str, u32)>,
    indent: &str,
    colored: bool,
) -> fmt::Result {
    let raise_idx = frames
        .iter()
        .position(|f| classify(&f.raw_symbol, f.file.as_deref()) == Kind::Ours);

    match (raise_idx, raise_override) {
        (Some(i), over) => {
            let frame = &frames[i];
            let (file, line) = match over {
                Some((file, line)) => (clean_path(file), Some(line)),
                None => (
                    frame
                        .file
                        .clone()
                        .unwrap_or_else(|| "<unknown>".to_string()),
                    frame.line,
                ),
            };
            writeln!(
                out,
                "{indent}{} {}",
                dim("at", colored),
                format_frame(&file, line, &frame.function)
            )?;
            render_callers(out, &frames[i + 1..], indent, colored)?;
        }
        (None, Some((file, line))) => {
            writeln!(
                out,
                "{indent}{} {}:{}",
                dim("at", colored),
                clean_path(file),
                line
            )?;
        }
        (None, None) => {}
    }
    Ok(())
}

fn render_callers(
    out: &mut dyn fmt::Write,
    frames: &[FrameView],
    indent: &str,
    colored: bool,
) -> fmt::Result {
    let caller_indent = format!("{indent}   ");
    let mut hidden = 0usize;
    for frame in frames {
        match classify(&frame.raw_symbol, frame.file.as_deref()) {
            Kind::Ours => {
                if hidden > 0 {
                    writeln!(
                        out,
                        "{caller_indent}{}",
                        dim(&hidden_marker(hidden), colored)
                    )?;
                    hidden = 0;
                }
                let file = frame.file.as_deref().unwrap_or("<unknown>");
                writeln!(
                    out,
                    "{caller_indent}{}",
                    format_frame(file, frame.line, &frame.function)
                )?;
            }
            Kind::Foreign | Kind::Infra => hidden += 1,
        }
    }
    if hidden > 0 {
        writeln!(
            out,
            "{caller_indent}{}",
            dim(&hidden_marker(hidden), colored)
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(symbol: &str, file: Option<&str>, line: Option<u32>) -> FrameView {
        FrameView {
            function: clean_function(symbol),
            raw_symbol: symbol.to_string(),
            file: file.map(|f| f.to_string()),
            line,
        }
    }

    #[test]
    fn clean_function_strips_closures_hashes_and_path() {
        assert_eq!(
            clean_function(
                "headless_lms_chatbot::azure_chatbot::send_msg::{{closure}}::{{closure}}"
            ),
            "send_msg"
        );
        assert_eq!(
            clean_function("headless_lms_server::foo::bar::h1a2b3c4d"),
            "bar"
        );
        assert_eq!(clean_function(""), "<unknown>");
    }

    #[test]
    fn classify_recognises_ours_infra_and_foreign() {
        // Our code, even though the file is the macro definition.
        assert_eq!(
            classify(
                "headless_lms_chatbot::azure_chatbot::send_msg",
                Some("utils/src/error/macros.rs")
            ),
            Kind::Ours
        );
        // Construction machinery by symbol.
        assert_eq!(
            classify(
                "<headless_lms_chatbot::chatbot_error::ChatbotError as headless_lms_base::error::backend_error::BackendError>::new",
                Some("chatbot/src/chatbot_error.rs")
            ),
            Kind::Infra
        );
        // Third-party / runtime.
        assert_eq!(
            classify(
                "tokio::runtime::task::poll",
                Some("/root/.cargo/registry/tokio/task.rs")
            ),
            Kind::Foreign
        );
    }

    #[test]
    fn is_infra_path_matches_error_files_but_not_macros() {
        assert!(is_infra_path(
            "services/headless-lms/base/src/error/backend_error.rs"
        ));
        assert!(is_infra_path("chatbot/src/chatbot_error.rs"));
        assert!(is_infra_path("server/src/domain/error.rs"));
        assert!(!is_infra_path("utils/src/error/macros.rs"));
        assert!(!is_infra_path("chatbot/src/azure_chatbot.rs"));
    }

    fn render(frames: &[FrameView], raise_override: Option<(&str, u32)>) -> String {
        let mut s = String::new();
        render_stack(&mut s, frames, raise_override, "  ", false).unwrap();
        s
    }

    #[test]
    fn raise_line_uses_location_and_our_frames_function() {
        // Frame 0 = construction (hidden), frame 1 = our raise frame attributed to
        // macros.rs, frame 2 = runtime (hidden), frame 3 = our caller.
        let frames = vec![
            frame(
                "<ChatbotError as headless_lms_base::error::backend_error::BackendError>::new",
                Some("chatbot/src/chatbot_error.rs"),
                Some(131),
            ),
            frame(
                "headless_lms_chatbot::azure_chatbot::send_chat_request::{{closure}}",
                Some("utils/src/error/macros.rs"),
                Some(141),
            ),
            frame(
                "async_stream::poll",
                Some("/root/.cargo/registry/async-stream/x.rs"),
                Some(56),
            ),
            frame(
                "headless_lms_server::controllers::chatbot::send_message",
                Some("server/src/controllers/chatbot.rs"),
                Some(120),
            ),
        ];
        // A meaningful location overrides the raise frame's (macros.rs) file:line.
        let out = render(&frames, Some(("chatbot/src/azure_chatbot.rs", 824)));

        // Raise line shows the real function name and the location, NOT the macro path.
        assert!(out.contains("send_chat_request"), "got: {out}");
        assert!(out.contains("azure_chatbot.rs:824"), "got: {out}");
        assert!(!out.contains("macros.rs"), "got: {out}");
        assert!(out.contains("at "), "got: {out}");
        // The caller is shown and the runtime frame between is collapsed.
        assert!(out.contains("send_message"), "got: {out}");
        assert!(out.contains("1 framework frame hidden"), "got: {out}");
    }

    #[test]
    fn trailing_foreign_frames_collapse_into_one_marker() {
        let frames = vec![
            frame(
                "headless_lms_server::foo::handler",
                Some("server/src/foo.rs"),
                Some(10),
            ),
            frame(
                "tokio::a",
                Some("/root/.cargo/registry/tokio/a.rs"),
                Some(1),
            ),
            frame(
                "tokio::b",
                Some("/root/.cargo/registry/tokio/b.rs"),
                Some(2),
            ),
            frame("std::rt", Some("/rustc/lib.rs"), Some(3)),
        ];
        let out = render(&frames, None);
        assert!(out.contains("3 framework frames hidden"), "got: {out}");
    }
}
