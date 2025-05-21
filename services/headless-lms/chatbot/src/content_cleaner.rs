use crate::llm_utils::{estimate_tokens, make_blocking_llm_request, Message, MessageRole};
use crate::prelude::*;
use headless_lms_utils::document_schema_processor::GutenbergBlock;

/// Maximum context window size for LLM in tokens
pub const MAX_CONTEXT_WINDOW: i32 = 16000;
/// Maximum percentage of context window to use in a single request
pub const MAX_CONTEXT_UTILIZATION: f32 = 0.75;
/// Temperature for requests, low for deterministic results
pub const REQUEST_TEMPERATURE: f32 = 0.1;

/// JSON markers for LLM prompt
const JSON_BEGIN_MARKER: &str = "---BEGIN COURSE MATERIAL JSON---";
const JSON_END_MARKER: &str = "---END COURSE MATERIAL JSON---";

/// System prompt for converting course material to markdown
const SYSTEM_PROMPT: &str = r#"You are given course material in an abstract JSON format from a headless CMS. Convert this into clean, semantic Markdown that includes all user-visible content to support full-text search.

* Extract and include all meaningful text content: paragraphs, headings, list items, image captions, and similar.
* Retain any inline formatting (like bold or italic text), converting HTML tags (`<strong>`, `<em>`, etc.) into equivalent Markdown formatting.
* For images, use the standard Markdown format: `![caption](url)`, including a caption if available.
* Preserve heading levels (e.g., level 2 → `##`, level 3 → `###`).
* Include text content from any block type, even non-standard ones, if it appears user-visible.
* For exercise blocks, include the exercise name, and assignment instructions. You may also include text from the exercise specification (public spec), if it can be formatted into markdown.
* Exclude all purely stylistic attributes (e.g. colors, alignment, font sizes).
* Do not include any metadata, HTML tags (other than for formatting), or non-visible fields.
* Output **only the Markdown content**, and nothing else.
"#;

/// User prompt for converting course material to markdown
const USER_PROMPT_START: &str =
    "Convert this JSON content to clean markdown. Output only the markdown, nothing else.";

/// Cleans content by converting the material blocks to clean markdown using an LLM
pub async fn convert_material_blocks_to_markdown_with_llm(
    blocks: &[GutenbergBlock],
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<String> {
    let system_message = Message {
        role: MessageRole::System,
        content: SYSTEM_PROMPT.to_string(),
    };

    let system_message_tokens = estimate_tokens(&system_message.content);
    let safe_token_limit = calculate_safe_token_limit(MAX_CONTEXT_WINDOW, MAX_CONTEXT_UTILIZATION);
    let max_content_tokens = safe_token_limit - system_message_tokens;

    let chunks = split_blocks_into_chunks(blocks, max_content_tokens)?;
    process_chunks(&chunks, &system_message, app_config).await
}

/// Calculate the safe token limit based on context window and utilization
pub fn calculate_safe_token_limit(context_window: i32, utilization: f32) -> i32 {
    (context_window as f32 * utilization) as i32
}

/// Split blocks into chunks that fit within token limits
pub fn split_blocks_into_chunks(
    blocks: &[GutenbergBlock],
    max_content_tokens: i32,
) -> anyhow::Result<Vec<String>> {
    let mut chunks: Vec<String> = Vec::new();
    let mut current_chunk: Vec<GutenbergBlock> = Vec::new();
    let mut current_chunk_tokens = 0;

    for block in blocks {
        let block_json = serde_json::to_string(block)?;
        let block_tokens = estimate_tokens(&block_json);

        // If this block alone exceeds the limit, split it into smaller chunks
        if block_tokens > max_content_tokens {
            // Add any accumulated blocks as a chunk
            if !current_chunk.is_empty() {
                chunks.push(serde_json::to_string(&current_chunk)?);
                current_chunk = Vec::new();
                current_chunk_tokens = 0;
            }

            // Then we do some crude splitting for the oversized block
            split_oversized_block(&block_json, max_content_tokens, &mut chunks)?;
            continue;
        }

        if current_chunk_tokens + block_tokens > max_content_tokens {
            chunks.push(serde_json::to_string(&current_chunk)?);
            current_chunk = Vec::new();
            current_chunk_tokens = 0;
        }

        current_chunk.push(block.clone());
        current_chunk_tokens += block_tokens;
    }

    if !current_chunk.is_empty() {
        chunks.push(serde_json::to_string(&current_chunk)?);
    }

    Ok(chunks)
}

/// Splits an oversized block into smaller string chunks
fn split_oversized_block(
    block_json: &str,
    max_tokens: i32,
    chunks: &mut Vec<String>,
) -> anyhow::Result<()> {
    let total_tokens = estimate_tokens(block_json);
    // Make a very conservative estimate of the number of chunks we need
    let num_chunks = (total_tokens as f32 / (max_tokens as f32 * 0.5)).ceil() as usize;

    if num_chunks <= 1 {
        chunks.push(block_json.to_string());
        return Ok(());
    }

    let chars_per_chunk = block_json.len() / num_chunks;

    let mut start = 0;
    while start < block_json.len() {
        let end = if start + chars_per_chunk >= block_json.len() {
            block_json.len()
        } else {
            start + chars_per_chunk
        };

        let chunk = &block_json[start..end];
        chunks.push(chunk.to_string());

        start = end;
    }

    Ok(())
}

/// Appends markdown content to a result string with proper newline separators
pub fn append_markdown_with_separator(result: &mut String, new_content: &str) {
    if !result.is_empty() && !result.ends_with("\n\n") {
        if result.ends_with('\n') {
            result.push('\n');
        } else {
            result.push_str("\n\n");
        }
    }

    result.push_str(new_content);
}

/// Process all chunks and combine the results
async fn process_chunks(
    chunks: &[String],
    system_message: &Message,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<String> {
    let mut result = String::new();

    for chunk in chunks {
        let chunk_markdown = process_block_chunk(chunk, system_message, app_config).await?;
        append_markdown_with_separator(&mut result, &chunk_markdown);
    }

    info!("Successfully cleaned content with LLM");
    Ok(result)
}

/// Process a subset of blocks in a single LLM request
async fn process_block_chunk(
    chunk: &str,
    system_message: &Message,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<String> {
    let messages = prepare_llm_messages(chunk, system_message)?;

    info!(
        "Processing chunk of approximately {} tokens",
        estimate_tokens(chunk)
    );

    let completion =
        make_blocking_llm_request(messages, REQUEST_TEMPERATURE, None, app_config).await?;

    let cleaned_content = completion
        .choices
        .first()
        .ok_or_else(|| anyhow::anyhow!("No content returned from LLM"))?
        .message
        .content
        .clone();

    Ok(cleaned_content)
}

/// Prepare messages for the LLM request
pub fn prepare_llm_messages(chunk: &str, system_message: &Message) -> anyhow::Result<Vec<Message>> {
    let messages = vec![
        system_message.clone(),
        Message {
            role: MessageRole::User,
            content: format!(
                "{}\n\n{}{}\n{}",
                USER_PROMPT_START, JSON_BEGIN_MARKER, chunk, JSON_END_MARKER
            ),
        },
    ];

    Ok(messages)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const TEST_BLOCK_NAME: &str = "test/block";

    #[test]
    fn test_calculate_safe_token_limit() {
        assert_eq!(calculate_safe_token_limit(1000, 0.75), 750);
        assert_eq!(calculate_safe_token_limit(16000, 0.75), 12000);
        assert_eq!(calculate_safe_token_limit(8000, 0.5), 4000);
    }

    #[test]
    fn test_append_markdown_with_separator() {
        let mut result = String::new();
        append_markdown_with_separator(&mut result, "New content");
        assert_eq!(result, "New content");

        let mut result = String::from("Existing content");
        append_markdown_with_separator(&mut result, "New content");
        assert_eq!(result, "Existing content\n\nNew content");

        let mut result = String::from("Existing content\n");
        append_markdown_with_separator(&mut result, "New content");
        assert_eq!(result, "Existing content\n\nNew content");

        let mut result = String::from("Existing content\n\n");
        append_markdown_with_separator(&mut result, "New content");
        assert_eq!(result, "Existing content\n\nNew content");
    }

    #[test]
    fn test_split_blocks_into_chunks() -> anyhow::Result<()> {
        // Use content strings of different lengths to influence token estimation
        let block1 = create_test_block("a "); // short
        let block2 = create_test_block("b b b b b b b b b b b b b b b b b b b b "); // longer
        let block3 = create_test_block("c c c c c c c c c c c c c c c "); // medium

        let blocks = vec![block1.clone(), block2.clone(), block3.clone()];

        // Estimate tokens for each block
        let t1 = estimate_tokens(&serde_json::to_string(&block1)?);
        let t2 = estimate_tokens(&serde_json::to_string(&block2)?);
        let t3 = estimate_tokens(&serde_json::to_string(&block3)?);

        // Test with a limit that fits all blocks
        let chunks = split_blocks_into_chunks(&blocks, t1 + t2 + t3 + 10)?;
        assert_eq!(chunks.len(), 1);

        let deserialized_chunk: Vec<GutenbergBlock> = serde_json::from_str(&chunks[0])?;
        assert_eq!(deserialized_chunk.len(), 3);

        // Test with a limit that requires splitting after the first block
        let chunks = split_blocks_into_chunks(&blocks, t1 + 1)?;

        // First chunk should be a valid JSON array with one block
        let first_chunk: Vec<GutenbergBlock> = serde_json::from_str(&chunks[0])?;
        assert_eq!(first_chunk.len(), 1);
        assert_eq!(first_chunk[0].client_id, block1.client_id);

        // Remaining chunks might be split JSON strings, so we can't deserialize them
        // Just verify they're not empty
        for chunk in &chunks[1..] {
            assert!(!chunk.is_empty());
        }

        Ok(())
    }

    #[test]
    fn test_prepare_llm_messages() -> anyhow::Result<()> {
        let blocks = vec![create_test_block("Test content")];
        let blocks_json = serde_json::to_string(&blocks)?;
        let system_message = Message {
            role: MessageRole::System,
            content: "System prompt".to_string(),
        };

        let messages = prepare_llm_messages(&blocks_json, &system_message)?;

        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, MessageRole::System);
        assert_eq!(messages[0].content, "System prompt");
        assert_eq!(messages[1].role, MessageRole::User);
        assert!(messages[1].content.contains(JSON_BEGIN_MARKER));
        assert!(messages[1].content.contains("Test content"));

        Ok(())
    }

    fn create_test_block(content: &str) -> GutenbergBlock {
        let client_id = uuid::Uuid::new_v4();
        GutenbergBlock {
            client_id,
            name: TEST_BLOCK_NAME.to_string(),
            is_valid: true,
            attributes: {
                let mut map = serde_json::Map::new();
                map.insert("content".to_string(), json!(content));
                map
            },
            inner_blocks: vec![],
        }
    }
}
