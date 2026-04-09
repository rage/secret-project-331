/*!
Macro utilities for creating error types more ergonomically.

This module provides a meta-macro `define_error_macros!` that generates
specialized error creation macros for any type implementing `BackendError`.
*/

/// Generates specialized error creation macros for BackendError types.
///
/// This macro creates a new macro named `{prefix}_err!` that simplifies
/// error construction. The generated macro supports two forms:
///
/// 1. Without source: `{prefix}_err!(ErrorVariant, "message")`
/// 2. With source: `{prefix}_err!(ErrorVariant, "message", source_error)`
///
/// # Examples
///
/// ```ignore
/// // Define macros for ModelError
/// define_error_macros!(model, ModelError, ModelErrorType);
///
/// // Now you can use:
/// let err = model_err!(Generic, "Something went wrong".to_string());
/// let err_with_src = model_err!(Generic, format!("Failed: {}", e), e);
/// ```
///
/// # Parameters
///
/// - `$prefix`: The prefix for the generated macro name (e.g., `model` generates `model_err!`)
/// - `$error`: The error type (e.g., `ModelError`)
/// - `$error_type`: The error type enum (e.g., `ModelErrorType`)
#[macro_export]
macro_rules! define_error_macros {
    ($prefix:ident, $error:ty, $error_type:ty) => {
        paste::paste! {
            /// Create an error without a source error.
            ///
            /// # Examples
            ///
            /// ```ignore
            #[doc = "let err = " $prefix "_err!(Generic, \"message\".to_string());"]
            /// ```
            #[macro_export]
            macro_rules! [<$prefix _err>] {
                // Without source: {prefix}_err!(Generic, "message")
                ($variant:ident, $msg:expr) => {
                    <$error>::new(
                        <$error_type>::$variant,
                        $msg,
                        None,
                    )
                };
                // With source: {prefix}_err!(Generic, "message", source_err)
                ($variant:ident, $msg:expr, $src:expr) => {
                    <$error>::new(
                        <$error_type>::$variant,
                        $msg,
                        Some($src.into()),
                    )
                };
            }

            // Re-export the generated macro for external use
            #[doc = "Re-export of the `" $prefix "_err!` macro for external use."]
            pub use [<$prefix _err>];
        }
    };
}
