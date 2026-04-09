/*!
Macro utilities for creating error types more ergonomically.

This module provides helper macros that simplify error construction
for types implementing `BackendError`.
*/

/// Internal helper macro that defines an error creation macro.
///
/// This avoids using the `paste` crate and keeps the implementation simple.
/// Each error module should use this to define their own specialized macro.
///
/// # Examples
///
/// ```ignore
/// // In models/src/error.rs:
/// define_err_macro!(
///     model_err,
///     ModelError,
///     ModelErrorType,
///     "Create a ModelError."
/// );
/// ```
#[macro_export]
macro_rules! define_err_macro {
    ($macro_name:ident, $error:ty, $error_type:ty, $doc:expr) => {
        #[doc = $doc]
        ///
        /// # Examples
        ///
        /// ```ignore
        /// // Without source
        /// let err = macro_name!(Generic, "message".to_string());
        ///
        /// // With source
        /// let err = macro_name!(Generic, "message".to_string(), source_err);
        ///
        /// // With format!
        /// let err = macro_name!(Generic, format!("Failed: {}", detail));
        /// ```
        #[macro_export]
        macro_rules! $macro_name {
            // Without source: model_err!(Generic, "message")
            ($variant:ident, $msg:expr) => {
                <$error>::new(<$error_type>::$variant, $msg, None)
            };
            // With source: model_err!(Generic, "message", source_err)
            ($variant:ident, $msg:expr, $src:expr) => {
                <$error>::new(<$error_type>::$variant, $msg, Some($src.into()))
            };
        }
    };
}
