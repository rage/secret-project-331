use anyhow::Error;

use crate::prelude::ChatbotResult;

pub async fn generate_suggested_messages() -> Result<Vec<String>, Error> {
    Ok(Vec::from([
        "What's up?".to_string(),
        "How can I pass this course?".to_string(),
        "When will I receive my certificate?".to_string(),
    ]))
}
