//! Removing personal data from the pipeline's own error messages before they are stored. Suotar's
//! request and response bodies are stored as sent and received.

pub use headless_lms_utils::text_scrub::scrub_text;
