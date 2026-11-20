//! The language-version repair tool: detects and fixes wrong links between the language versions
//! of a course and their pages and exercises.

pub mod counterpart;
mod counterpart_index;
pub mod detection;
pub mod dismissals;
pub mod join_candidates;
pub mod linking;
pub mod membership;
pub mod operation_logs;
pub mod snapshot;
pub mod structure;
pub mod suggestions;
pub mod types;

use crate::prelude::*;

/// A request the tool refuses before changing anything.
pub(crate) fn invalid_request(message: &str) -> ModelError {
    model_err!(InvalidRequest, message.to_string())
}

/// `base` if it is free, otherwise the first free one of `base-2`, `base-3`, ...
pub(crate) fn first_free_suffixed(base: &str, is_taken: impl Fn(&str) -> bool) -> String {
    let mut candidate = base.to_string();
    let mut suffix = 2;
    while is_taken(&candidate) {
        candidate = format!("{base}-{suffix}");
        suffix += 1;
    }
    candidate
}
