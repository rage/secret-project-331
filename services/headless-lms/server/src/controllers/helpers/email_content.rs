use headless_lms_utils::email_processor::EmailGutenbergBlock;

use crate::prelude::*;

/// Parses an email body the way the sender will, so a body it cannot send is rejected on save.
pub fn parse_email_content(
    content: &serde_json::Value,
) -> Result<Vec<EmailGutenbergBlock>, ControllerError> {
    serde_json::from_value(content.clone()).map_err(|err| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            format!("The email content cannot be sent: {err}"),
            None,
        )
    })
}
