pub mod mock_azure;
pub mod prelude;
pub mod controllers {
    pub use headless_lms_mock_chatbot_documents::mock_document_storage;
}
#[macro_use]
extern crate tracing;
mod error_macros {
    use headless_lms_use_cases::domain::error::{ControllerError, ControllerErrorType};
    headless_lms_utils::define_err_macro!(
        controller_err,
        ControllerError,
        ControllerErrorType,
        ControllerErrorType,
        "Create a mock Azure controller error."
    );
}
