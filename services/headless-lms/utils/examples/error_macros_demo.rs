//! Demonstration of the error creation macros and helper functions.
//!
//! Run with: cargo run --example error_macros_demo

use headless_lms_utils::error::{
    backend_error::BackendError,
    util_error::{UtilError, UtilErrorType, as_util_error, missing_util_error},
};
// Import the generated macro
use headless_lms_utils::util_err;

fn main() {
    println!("=== Error Macros Demo ===\n");

    // Example 1: Creating errors with the macro (without source)
    println!("1. Creating error without source:");
    let err = util_err!(Other, "This is a simple error".to_string());
    println!("   Error message: {}", err.message());
    println!("   Error type: {:?}\n", err.error_type());

    // Example 2: Creating errors with the macro (with source)
    println!("2. Creating error with source:");
    let source = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
    let err = util_err!(TokioIo, "Failed to read file".to_string(), source);
    println!("   Error message: {}", err.message());
    println!("   Error type: {:?}\n", err.error_type());

    // Example 3: Using with format!
    println!("3. Using with format! macro:");
    let filename = "test.txt";
    let err = util_err!(Other, format!("Could not process file: {}", filename));
    println!("   Error message: {}\n", err.message());

    // Example 4: Using helper in map_err
    println!("4. Using as_util_error helper:");
    let result: Result<(), std::io::Error> = Err(std::io::Error::new(
        std::io::ErrorKind::PermissionDenied,
        "access denied",
    ));
    let wrapped = result.map_err(as_util_error(
        UtilErrorType::TokioIo,
        "Failed to access resource".to_string(),
    ));
    if let Err(e) = wrapped {
        println!("   Wrapped error: {}\n", e.message());
    }

    // Example 5: Using helper in ok_or_else
    println!("5. Using missing_util_error helper:");
    let option: Option<String> = None;
    let result = option.ok_or_else(missing_util_error(
        UtilErrorType::Other,
        "Value not found".to_string(),
    ));
    if let Err(e) = result {
        println!("   Error from None: {}\n", e.message());
    }

    println!("=== Before vs After Comparison ===\n");

    println!("BEFORE (verbose):");
    println!("  UtilError::new(");
    println!("      UtilErrorType::Other,");
    println!("      \"Error message\".to_string(),");
    println!("      None,");
    println!("  )\n");

    println!("AFTER (concise):");
    println!("  util_err!(Other, \"Error message\".to_string())\n");

    println!("✓ Error creation is now ~60% shorter and more readable!");
}
