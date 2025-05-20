use crate::llm_utils::{make_blocking_llm_request, Message};
use crate::prelude::*;

/// Cleans content by converting the material JSON to clean markdown using an LLM
pub async fn convert_material_blocks_to_markdown_with_llm(
    content_json: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<String> {
    let messages = vec![
        // System message for instructions
        Message {
        role: "system".to_string(),
        content: r#"You are given course material in an abstract JSON format from a headless CMS. Convert this into clean, semantic Markdown that includes all user-visible content to support full-text search.

* Extract and include all meaningful text content: paragraphs, headings, list items, image captions, and similar.
* Retain any inline formatting (like bold or italic text), converting HTML tags (`<strong>`, `<em>`, etc.) into equivalent Markdown formatting.
* For images, use the standard Markdown format: `![caption](url)`, including a caption if available.
* Preserve heading levels (e.g., level 2 → `##`, level 3 → `###`).
* Include text content from any block type, even non-standard ones, if it appears user-visible.
* For exercise blocks, include the exercise name, and assignment instructions. You may also include text from the exercise specification (public spec), if it can be formatted into markdown.
* Exclude all purely stylistic attributes (e.g. colors, alignment, font sizes).
* Do not include any metadata, HTML tags (other than for formatting), or non-visible fields.
* Output **only the Markdown content**, and nothing else.
"#.to_string(),
    },
    // User message with the course material to convert
    Message {
        role: "user".to_string(),
        content: format!(
            "Convert this JSON content to clean markdown. Output only the markdown, nothing else.\n\n---BEGIN COURSE MATERIAL JSON---\n{}\n---END COURSE MATERIAL JSON---",
            content_json
        ),
    }];

    let completion = make_blocking_llm_request(
        messages, 0.1, // Low temperature for deterministic results
        800000, app_config,
    )
    .await?;

    let cleaned_content = completion
        .choices
        .first()
        .ok_or_else(|| anyhow::anyhow!("No content returned from LLM"))?
        .message
        .content
        .clone();

    info!("Successfully cleaned content with LLM");
    Ok(cleaned_content)
}
