//! Bounds on how much a tool call may hand back, so that no tool can produce an output the
//! conversation cannot store.
//!
//! `chatbot_conversation_message_tool_outputs.output` is `VARCHAR(131072)`, and `record_tool_call`
//! writes the call and its output in one transaction: an oversized output does not degrade the
//! answer, it rolls the call back and ends the turn. [truncate_tool_output] is the backstop that
//! makes that unreachable; [CappedList] is what tools use so the backstop rarely has to fire.

use serde::Serialize;
use std::borrow::Cow;

use headless_lms_utils::strings::truncate_utf8_at_boundary;

/// The most a single tool output may carry, wrapper and instructions included.
///
/// Postgres counts `VARCHAR(131072)` in characters and this is a byte budget, so staying under the
/// column is guaranteed rather than merely likely. The gap to the column is also the headroom that
/// keeps one result from eating a turn's whole context window.
const MAX_TOOL_OUTPUT_BYTES: usize = 100_000;

/// What a truncated tool output leaves out, phrased for the model rather than for a log.
const TRUNCATION_INSTRUCTION: &str = "This result was too large to return in full and was cut off \
    mid-way, so it may end in the middle of a value. Treat it as a partial view: say so before \
    answering from it, do not claim anything about what a complete result would have contained, \
    and prefer narrowing the call (a single id, fewer facets) over reasoning from the fragment.";

/// Cuts `output` down to what a tool output row can hold, returning the text to send and, when it
/// had to cut, the instruction telling the model what it is looking at.
///
/// The notice is returned separately rather than appended so the caller can put it in the
/// instructions block: inside the output delimiters it would read as part of the data it is
/// warning about.
pub(crate) fn truncate_tool_output(output: &str) -> (Cow<'_, str>, Option<&'static str>) {
    if output.len() <= MAX_TOOL_OUTPUT_BYTES {
        return (Cow::Borrowed(output), None);
    }
    (
        Cow::Borrowed(truncate_utf8_at_boundary(output, MAX_TOOL_OUTPUT_BYTES)),
        Some(TRUNCATION_INSTRUCTION),
    )
}

/// How much of a list was left out of a tool output.
#[derive(Serialize)]
pub(crate) struct ListTruncation {
    shown: usize,
    total: usize,
}

/// A list a tool caps before serializing it, so one long list cannot crowd out the fields beside
/// it and so the model is never handed a partial list that looks complete.
///
/// Prefer aggregating over capping where the rows are repetitive: a cap answers "what are the
/// first N" when the question was usually "how many".
#[derive(Serialize)]
pub(crate) struct CappedList<T> {
    items: Vec<T>,
    /// Absent when everything fit, which is the common case and the one where an extra field
    /// would only invite the model to comment on it.
    #[serde(skip_serializing_if = "Option::is_none")]
    truncated: Option<ListTruncation>,
}

impl<T> CappedList<T> {
    /// Keeps at most `max_items` of `items`, recording what that left out.
    pub(crate) fn new(mut items: Vec<T>, max_items: usize) -> Self {
        let total = items.len();
        if total <= max_items {
            return Self {
                items,
                truncated: None,
            };
        }
        items.truncate(max_items);
        Self {
            items,
            truncated: Some(ListTruncation {
                shown: max_items,
                total,
            }),
        }
    }

    /// Whether anything was left out, for a tool that wants to say so in its instructions as well
    /// as in its data.
    pub(crate) fn is_truncated(&self) -> bool {
        self.truncated.is_some()
    }
}

/// Reads as the rows that survived the cap, so a tool can inspect them to word its instructions
/// without the truncation bookkeeping getting in the way.
impl<T> std::ops::Deref for CappedList<T> {
    type Target = [T];

    fn deref(&self) -> &Self::Target {
        &self.items
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_output_within_the_budget_is_returned_untouched() {
        let (output, notice) = truncate_tool_output("small");
        assert_eq!(output, "small");
        assert!(notice.is_none());
    }

    /// The budget is in bytes and the cut has to land on a char boundary, so a multi-byte
    /// character straddling the limit must not be split into invalid UTF-8.
    #[test]
    fn an_oversized_output_is_cut_to_the_budget_on_a_char_boundary() {
        let output = "ä".repeat(MAX_TOOL_OUTPUT_BYTES);
        let (truncated, notice) = truncate_tool_output(&output);
        assert!(truncated.len() <= MAX_TOOL_OUTPUT_BYTES);
        assert!(truncated.chars().all(|c| c == 'ä'));
        assert!(notice.is_some());
    }

    #[test]
    fn a_capped_list_reports_only_what_it_left_out() {
        let untruncated = CappedList::new(vec![1, 2, 3], 3);
        assert!(!untruncated.is_truncated());
        assert_eq!(
            serde_json::to_string(&untruncated).unwrap(),
            r#"{"items":[1,2,3]}"#
        );

        let truncated = CappedList::new(vec![1, 2, 3, 4], 2);
        assert!(truncated.is_truncated());
        assert_eq!(
            serde_json::to_string(&truncated).unwrap(),
            r#"{"items":[1,2],"truncated":{"shown":2,"total":4}}"#
        );
    }
}
