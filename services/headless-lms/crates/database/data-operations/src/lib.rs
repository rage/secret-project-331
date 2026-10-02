//! Operations spanning several database tables.
pub use headless_lms_models::*;
pub mod library;
#[macro_use]
extern crate tracing;
mod error_macros {
    use headless_lms_models::{ModelError, ModelErrorType};
    headless_lms_utils::define_err_macro!(
        model_err,
        ModelError,
        ModelErrorType,
        ModelErrorType,
        "Create a model error in cross-table operations."
    );
}
