/*!
Renders the tracing span trace as a single compact breadcrumb.

Unlike the OS backtrace, the span trace carries the instrumented business-logic spans
that were active when the error was created, together with their runtime field values
(request_id, course_id, user_id, …). Rendered root-first as
`http_request{request_id=…} › send_message{course_id=…}` it gives the request context
at a glance.
*/

use tracing_error::SpanTrace;

/// Only include spans from our own instrumentation; runtime/library spans add noise.
const OUR_TARGET_PREFIX: &str = "headless_lms";

/// Maximum length of a single span's rendered field string before truncation.
const MAX_FIELDS_LEN: usize = 80;

/// One captured span reduced to its name and formatted fields.
#[derive(Debug, Clone)]
pub struct SpanEntry {
    pub name: String,
    pub fields: String,
}

/// Build the breadcrumb string from ordered (root-first) span entries, or `None` when
/// there is nothing worth showing.
pub fn render_breadcrumb(entries: &[SpanEntry]) -> Option<String> {
    if entries.is_empty() {
        return None;
    }
    let parts: Vec<String> = entries
        .iter()
        .map(|entry| {
            if entry.fields.is_empty() {
                entry.name.clone()
            } else {
                format!("{}{{{}}}", entry.name, truncate(&entry.fields))
            }
        })
        .collect();
    Some(parts.join(" › "))
}

fn truncate(fields: &str) -> String {
    if fields.chars().count() <= MAX_FIELDS_LEN {
        return fields.to_string();
    }
    let cut: String = fields.chars().take(MAX_FIELDS_LEN).collect();
    format!("{cut}…")
}

/// Extract our-instrumentation spans from a [`SpanTrace`], ordered root-first.
pub fn extract_spans(span_trace: &SpanTrace) -> Vec<SpanEntry> {
    let mut entries = Vec::new();
    span_trace.with_spans(|metadata, fields| {
        if metadata.target().starts_with(OUR_TARGET_PREFIX) {
            entries.push(SpanEntry {
                name: metadata.name().to_string(),
                fields: fields.to_string(),
            });
        }
        true
    });
    // `with_spans` visits innermost-first; we want root-first for the breadcrumb.
    entries.reverse();
    entries
}

/// Convenience: extract and render a span trace's breadcrumb in one step.
pub fn breadcrumb(span_trace: &SpanTrace) -> Option<String> {
    render_breadcrumb(&extract_spans(span_trace))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(name: &str, fields: &str) -> SpanEntry {
        SpanEntry {
            name: name.to_string(),
            fields: fields.to_string(),
        }
    }

    #[test]
    fn empty_yields_none() {
        assert_eq!(render_breadcrumb(&[]), None);
    }

    #[test]
    fn joins_root_first_with_fields() {
        let entries = vec![
            entry("http_request", "request_id=aea0"),
            entry("send_message", "course_id=5d79"),
        ];
        assert_eq!(
            render_breadcrumb(&entries).unwrap(),
            "http_request{request_id=aea0} › send_message{course_id=5d79}"
        );
    }

    #[test]
    fn span_without_fields_shows_bare_name() {
        assert_eq!(render_breadcrumb(&[entry("root", "")]).unwrap(), "root");
    }

    #[test]
    fn long_fields_are_truncated() {
        let long = "x".repeat(MAX_FIELDS_LEN + 20);
        let rendered = render_breadcrumb(&[entry("s", &long)]).unwrap();
        // The ellipsis sits inside the `{…}` wrapper, so the whole string ends with `}`.
        assert!(rendered.contains('…'), "got: {rendered}");
        assert!(rendered.ends_with("…}"), "got: {rendered}");
        assert!(rendered.chars().count() < long.chars().count() + "s{}".len());
    }
}
