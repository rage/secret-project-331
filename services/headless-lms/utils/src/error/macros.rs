/*!
Macro utilities for creating error types more ergonomically.

This module provides helper macros that simplify error construction
for types implementing `BackendError`.
*/

/// Defines a crate-local error creation macro that can be re-exported from a module.
///
/// This avoids using the `paste` crate and keeps the implementation simple.
/// Each error module should use this to define their own specialized macro.
///
/// This helper macro (`define_err_macro!`) is `#[macro_export]` so it can be
/// invoked from sibling crates. The generated macro itself is crate-local, so
/// callers can re-export it through a crate prelude without creating a
/// root-level exported macro and without triggering
/// `macro_expanded_macro_exports_accessed_by_absolute_paths`.
///
/// # Examples
///
/// ```ignore
/// // In models/src/error.rs:
/// define_err_macro!(
///     model_err,
///     ModelError,
///     ModelErrorType,
///     ModelErrorType,
///     "Create a ModelError."
/// );
/// ```
#[macro_export]
macro_rules! define_err_macro {
    ($macro_name:ident, $error:ty, $error_type:ty, $error_type_ident:ident, $doc:expr) => {
        #[doc = concat!(
                    $doc,
                    "\n\n# Examples\n\n",
                    "```ignore\n",
                    "// Without source\n",
                    "let err = ",
                    stringify!($macro_name),
                    "!(Generic, \"message\".to_string());\n\n",
                    "// With source\n",
                    "let err = ",
                    stringify!($macro_name),
                    "!(Generic, \"message\".to_string(), source_err);\n\n",
                    "// With format!\n",
                    "let err = ",
                    stringify!($macro_name),
                    "!(Generic, format!(\"Failed: {}\", detail));\n\n",
                    "// With tuple variant payload\n",
                    "let err = ",
                    stringify!($macro_name),
                    "!(UnauthorizedWithReason(reason), \"message\".to_string());\n\n",
                    "// With struct variant payload\n",
                    "let err = ",
                    stringify!($macro_name),
                    "!(BadRequestWithData { code: \"x\" }, \"message\".to_string());\n",
                    "```\n"
                )]
        #[allow(unused_macros)]
        macro_rules! $macro_name {
                    // Reject fully-qualified enum paths: model_err!(ModelErrorType::NotFound, ...)
                    ($error_type_ident::$variant:ident, $msg:expr) => {
                        compile_error!(concat!(
                            stringify!($macro_name),
                            "! expects short variant syntax.\n",
                            "Use `",
                            stringify!($macro_name),
                            "!(",
                            stringify!($variant),
                            ", msg)` instead of `",
                            stringify!($macro_name),
                            "!(",
                            stringify!($error_type_ident),
                            "::",
                            stringify!($variant),
                            ", msg)`."
                        ))
                    };
                    ($error_type_ident::$variant:ident, $msg:expr, $src:expr) => {
                        compile_error!(concat!(
                            stringify!($macro_name),
                            "! expects short variant syntax.\n",
                            "Use `",
                            stringify!($macro_name),
                            "!(",
                            stringify!($variant),
                            ", msg, src)` instead of `",
                            stringify!($macro_name),
                            "!(",
                            stringify!($error_type_ident),
                            "::",
                            stringify!($variant),
                            ", msg, src)`."
                        ))
                    };
                    ($error_type_ident::$variant:ident $payload:tt, $msg:expr) => {
                        compile_error!(concat!(
                            stringify!($macro_name),
                            "! expects short variant syntax.\n",
                            "Use `",
                            stringify!($macro_name),
                            "!(",
                            stringify!($variant),
                            "..., msg)` instead of `",
                            stringify!($macro_name),
                            "!(",
                            stringify!($error_type_ident),
                            "::",
                            stringify!($variant),
                            "..., msg)`."
                        ))
                    };
                    ($error_type_ident::$variant:ident $payload:tt, $msg:expr, $src:expr) => {
                        compile_error!(concat!(
                            stringify!($macro_name),
                            "! expects short variant syntax.\n",
                            "Use `",
                            stringify!($macro_name),
                            "!(",
                            stringify!($variant),
                            "..., msg, src)` instead of `",
                            stringify!($macro_name),
                            "!(",
                            stringify!($error_type_ident),
                            "::",
                            stringify!($variant),
                            "..., msg, src)`."
                        ))
                    };
                    // Payload variant without source: tuple or struct payload.
                    ($variant:ident $payload:tt, $msg:expr) => {
                        <$error>::new($error_type_ident::$variant $payload, $msg, None)
                    };
                    // Payload variant with source: tuple or struct payload.
                    ($variant:ident $payload:tt, $msg:expr, $src:expr) => {
                        <$error>::new($error_type_ident::$variant $payload, $msg, Some($src.into()))
                    };
                    // Without source: model_err!(Generic, "message")
                    ($variant:ident, $msg:expr) => {
                        <$error>::new($error_type_ident::$variant, $msg, None)
                    };
                    // With source: model_err!(Generic, "message", source_err)
                    ($variant:ident, $msg:expr, $src:expr) => {
                        <$error>::new($error_type_ident::$variant, $msg, Some($src.into()))
                    };
                }

        // Re-export into module namespace so crate preludes can expose it.
        #[allow(unused_imports)]
        pub(crate) use $macro_name;
    };
}
