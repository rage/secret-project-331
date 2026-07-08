/*!
Clean, human-readable rendering of backend errors for developers.

This module turns one of our errors — plus its whole cause chain — into a sectioned,
plain-text (never JSON) form that shows, for every error in the chain, its type, message,
the real source location it was raised at, and a simplified stack of *our* code only.
Third-party causes are shown message-only and tagged `(external)`. A one-line breadcrumb
of the active tracing spans (with runtime field values) is appended.

Example output:

```text
ChatbotError · StreamingError: Stream ended unexpectedly: rate limit for gpt-5.5
  at chatbot/src/azure_chatbot.rs:824  send_chat_request_and_parse_stream
     server/src/controllers/chatbot.rs:120  send_message
     ⋯ 12 framework frames hidden ⋯

caused by:
  1. ModelError · Database: connection pool timed out
     at models/src/chatbot/conversations.rs:45  get_conversation
        ⋯ 9 framework frames hidden ⋯
  2. pool timed out while waiting for connection  (external)

spans
  http_request{request_id=aea0…} › send_message{course_id=5d79…}
```

## Design

The four error types (`ControllerError`, `ChatbotError`, `ModelError`, `UtilError`) live
in crates that depend on `base`, so `base` cannot name them. Instead they expose their
data through the object-safe [`ErrorTrace`] trait (blanket-implemented for every
[`BackendError`]), and each type's generated `Debug`/`clean_string` passes a small
crate-local downcast *resolver* — see [`crate::impl_clean_debug`]. Because the cause
chain only ever contains error types "below" a given error in the dependency graph, a
per-crate resolver covers every reachable cause with no runtime registry.
*/

pub mod color;
pub mod frames;
pub mod spans;

use core::fmt;
use std::panic::Location;

use backtrace::Backtrace;
use tracing_error::SpanTrace;

pub use color::ColorChoice;

use crate::error::backend_error::BackendError;
use color::{bold, dim};

/// Object-safe view over one of our errors, used by the clean formatter so that `base`
/// can render error types defined in dependent crates.
pub trait ErrorTrace {
    /// Short type name, e.g. `"ChatbotError"`.
    fn type_name(&self) -> &'static str;
    /// The error-type variant, formatted via its `Debug`.
    fn variant(&self) -> String;
    /// The human-facing message.
    fn message(&self) -> &str;
    /// The captured OS backtrace, if any.
    fn backtrace(&self) -> Option<&Backtrace>;
    /// The captured raise location, if any.
    fn location(&self) -> Option<&'static Location<'static>>;
    /// The captured tracing span trace.
    fn span_trace(&self) -> &SpanTrace;
}

/// Every [`BackendError`] is an [`ErrorTrace`]. The type name is derived from
/// [`std::any::type_name`] and reduced to its last path segment.
impl<T: BackendError> ErrorTrace for T {
    fn type_name(&self) -> &'static str {
        let full = std::any::type_name::<T>();
        full.rsplit("::").next().unwrap_or(full)
    }

    fn variant(&self) -> String {
        format!("{:?}", BackendError::error_type(self))
    }

    fn message(&self) -> &str {
        BackendError::message(self)
    }

    fn backtrace(&self) -> Option<&Backtrace> {
        BackendError::backtrace(self)
    }

    fn location(&self) -> Option<&'static Location<'static>> {
        BackendError::location(self)
    }

    fn span_trace(&self) -> &SpanTrace {
        BackendError::span_trace(self)
    }
}

/// A resolver turns a type-erased cause into an [`ErrorTrace`] if it is one of our
/// errors. Generated per crate by [`crate::impl_clean_debug`].
pub type Resolver<'a> =
    dyn for<'e> Fn(&'e (dyn std::error::Error + 'static)) -> Option<&'e dyn ErrorTrace> + 'a;

/// Guard against pathological / cyclic cause chains.
const MAX_CHAIN: usize = 64;

/// Render `head` and its whole cause chain in the clean developer format.
pub fn render(
    out: &mut dyn fmt::Write,
    head: &dyn ErrorTrace,
    head_source: Option<&(dyn std::error::Error + 'static)>,
    resolve: &Resolver<'_>,
    color: ColorChoice,
) -> fmt::Result {
    let colored = color.enabled();

    write_node(out, head, "  ", colored)?;

    let mut current = head_source;
    let mut index = 1usize;
    let mut started_chain = false;
    while let Some(err) = current {
        if index > MAX_CHAIN {
            break;
        }
        if !started_chain {
            writeln!(out)?;
            writeln!(out, "{}", bold("caused by:", colored))?;
            started_chain = true;
        }
        match resolve(err) {
            Some(trace) => write_cause_node(out, index, trace, colored)?,
            None => writeln!(out, "  {index}. {err}  {}", dim("(external)", colored))?,
        }
        index += 1;
        current = err.source();
    }

    if let Some(breadcrumb) = spans::breadcrumb(head.span_trace()) {
        writeln!(out)?;
        writeln!(out, "{}", bold("spans", colored))?;
        writeln!(out, "  {breadcrumb}")?;
    }

    Ok(())
}

fn header_line(trace: &dyn ErrorTrace, colored: bool) -> String {
    format!(
        "{} · {}: {}",
        bold(trace.type_name(), colored),
        trace.variant(),
        trace.message()
    )
}

fn write_node(
    out: &mut dyn fmt::Write,
    trace: &dyn ErrorTrace,
    indent: &str,
    colored: bool,
) -> fmt::Result {
    writeln!(out, "{}", header_line(trace, colored))?;
    write_stack(out, trace, indent, colored)
}

fn write_cause_node(
    out: &mut dyn fmt::Write,
    index: usize,
    trace: &dyn ErrorTrace,
    colored: bool,
) -> fmt::Result {
    writeln!(out, "  {index}. {}", header_line(trace, colored))?;
    write_stack(out, trace, "     ", colored)
}

fn write_stack(
    out: &mut dyn fmt::Write,
    trace: &dyn ErrorTrace,
    indent: &str,
    colored: bool,
) -> fmt::Result {
    // Use the captured location for the raise line only when it is meaningful, i.e. not
    // itself inside error infrastructure (e.g. a `From` impl body).
    let raise_override = trace
        .location()
        .filter(|location| !frames::is_infra_path(location.file()))
        .map(|location| (location.file(), location.line()));

    match trace.backtrace() {
        Some(backtrace) => {
            let extracted = frames::extract_frames(backtrace);
            frames::render_stack(out, &extracted, raise_override, indent, colored)
        }
        None => {
            if let Some((file, line)) = raise_override {
                writeln!(
                    out,
                    "{indent}{} {}:{}",
                    dim("at", colored),
                    frames::clean_path(file),
                    line
                )?;
            }
            Ok(())
        }
    }
}

/// Generate the clean `Debug` implementation, a `clean_string` helper and a crate-local
/// cause resolver for an error type.
///
/// `causes` lists the error types that can appear in this error's cause chain (itself
/// plus every `BackendError` it can wrap). Ordering does not matter.
///
/// ```ignore
/// headless_lms_base::impl_clean_debug!(ChatbotError, [ChatbotError, ModelError, UtilError]);
/// ```
#[macro_export]
macro_rules! impl_clean_debug {
    ($error:ty, [ $( $cause:ty ),* $(,)? ]) => {
        impl $error {
            fn render_clean_error(
                &self,
                out: &mut dyn ::core::fmt::Write,
                color: $crate::error::clean_format::ColorChoice,
            ) -> ::core::fmt::Result {
                fn resolve<'err>(
                    err: &'err (dyn ::std::error::Error + 'static),
                ) -> ::core::option::Option<&'err dyn $crate::error::clean_format::ErrorTrace> {
                    $(
                        if let ::core::option::Option::Some(matched) =
                            err.downcast_ref::<$cause>()
                        {
                            return ::core::option::Option::Some(
                                matched as &dyn $crate::error::clean_format::ErrorTrace,
                            );
                        }
                    )*
                    ::core::option::Option::None
                }
                $crate::error::clean_format::render(
                    out,
                    self as &dyn $crate::error::clean_format::ErrorTrace,
                    ::std::error::Error::source(self),
                    &resolve,
                    color,
                )
            }

            /// Render this error in the clean, human-readable developer format.
            pub fn clean_string(
                &self,
                color: $crate::error::clean_format::ColorChoice,
            ) -> ::std::string::String {
                let mut buffer = ::std::string::String::new();
                let _ = self.render_clean_error(&mut buffer, color);
                buffer
            }
        }

        impl ::core::fmt::Debug for $error {
            fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
                self.render_clean_error(f, $crate::error::clean_format::ColorChoice::Never)
            }
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal `ErrorTrace` that is deliberately NOT a `BackendError`, so we can build
    /// cause chains in tests without a real error type.
    struct FakeError {
        type_name: &'static str,
        variant: &'static str,
        message: String,
        source: Option<Box<dyn std::error::Error + 'static>>,
        span_trace: SpanTrace,
    }

    impl std::fmt::Display for FakeError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }
    impl std::fmt::Debug for FakeError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }
    impl std::error::Error for FakeError {
        fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
            self.source.as_deref()
        }
    }
    impl ErrorTrace for FakeError {
        fn type_name(&self) -> &'static str {
            self.type_name
        }
        fn variant(&self) -> String {
            self.variant.to_string()
        }
        fn message(&self) -> &str {
            &self.message
        }
        fn backtrace(&self) -> Option<&Backtrace> {
            None
        }
        fn location(&self) -> Option<&'static Location<'static>> {
            None
        }
        fn span_trace(&self) -> &SpanTrace {
            &self.span_trace
        }
    }

    fn resolver<'err>(
        err: &'err (dyn std::error::Error + 'static),
    ) -> Option<&'err dyn ErrorTrace> {
        err.downcast_ref::<FakeError>()
            .map(|e| e as &dyn ErrorTrace)
    }

    fn render_to_string(head: &FakeError) -> String {
        let mut out = String::new();
        render(
            &mut out,
            head,
            std::error::Error::source(head),
            &resolver,
            ColorChoice::Never,
        )
        .unwrap();
        out
    }

    #[test]
    fn renders_header_and_full_chain_without_skipping_levels() {
        // external leaf <- ModelError <- ChatbotError (head)
        let leaf = FakeError {
            type_name: "io::Error",
            variant: "",
            message: "pool timed out".to_string(),
            source: None,
            span_trace: SpanTrace::capture(),
        };
        // Wrap the leaf in a plain (non-FakeError) error to exercise the (external) path.
        let external: Box<dyn std::error::Error + 'static> =
            Box::new(std::io::Error::other(leaf.message.clone()));
        let model = FakeError {
            type_name: "ModelError",
            variant: "Database",
            message: "database call failed".to_string(),
            source: Some(external),
            span_trace: SpanTrace::capture(),
        };
        let head = FakeError {
            type_name: "ChatbotError",
            variant: "StreamingError",
            message: "stream ended".to_string(),
            source: Some(Box::new(model)),
            span_trace: SpanTrace::capture(),
        };

        let out = render_to_string(&head);

        assert!(
            out.contains("ChatbotError · StreamingError: stream ended"),
            "{out}"
        );
        assert!(out.contains("caused by:"), "{out}");
        assert!(
            out.contains("1. ModelError · Database: database call failed"),
            "{out}"
        );
        // The leaf is not a FakeError → external, and it must still appear (no skipped level).
        assert!(out.contains("2. pool timed out  (external)"), "{out}");
    }

    #[test]
    fn no_chain_section_without_a_source() {
        let head = FakeError {
            type_name: "UtilError",
            variant: "Other",
            message: "boom".to_string(),
            source: None,
            span_trace: SpanTrace::capture(),
        };
        let out = render_to_string(&head);
        assert!(out.contains("UtilError · Other: boom"), "{out}");
        assert!(!out.contains("caused by:"), "{out}");
    }
}
