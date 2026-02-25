use crate::azure_chatbot::{LLMRequest, LLMRequestParams, NonThinkingParams, ThinkingParams};
use crate::llm_utils::{
    APIMessage, APIMessageKind, APIMessageText, estimate_tokens, make_blocking_llm_request,
};
use crate::prelude::*;
use anyhow::Error;
use headless_lms_models::application_task_default_language_models::TaskLMSpec;
use headless_lms_models::chatbot_conversation_messages::MessageRole;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::Value;
use tracing::{debug, error, info, instrument, warn};

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
* If you encounter blocks that don't have any visible text in the JSON but are likely still user-visible (placeholder blocks) — e.g. `glossary`, `exercises-in-this-chapter`, `course-progress` — generate a fake heading representing the expected content (e.g. `## Glossary`).
* Do not generate headings for placeholder blocks that are not user-visible — e.g. `conditionally-visible-content`, `spacer`, `divider`.
* Exclude all purely stylistic attributes (e.g. colors, alignment, font sizes).
* Do not include any metadata, HTML tags (other than for formatting), or non-visible fields.
* Output **only the Markdown content**, and nothing else.
"#;

/// User prompt for converting course material to markdown
const USER_PROMPT_START: &str =
    "Convert this JSON content to clean markdown. Output only the markdown, nothing else.";

/// Cleans content by converting the material blocks to clean markdown using an LLM
#[instrument(skip(blocks, app_config, task_lm), fields(num_blocks = blocks.len()))]
pub async fn convert_material_blocks_to_markdown_with_llm(
    blocks: &[GutenbergBlock],
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
) -> anyhow::Result<String> {
    debug!("Starting content conversion with {} blocks", blocks.len());
    let system_message = APIMessage {
        role: MessageRole::System,
        fields: APIMessageKind::Text(APIMessageText {
            content: SYSTEM_PROMPT.to_string(),
        }),
    };

    let system_message_tokens = estimate_tokens(SYSTEM_PROMPT);
    let safe_token_limit =
        calculate_safe_token_limit(task_lm.context_size, task_lm.context_utilization);
    let max_content_tokens = (safe_token_limit - system_message_tokens).max(1);

    debug!(
        "Token limits - system: {}, safe: {}, max content: {}",
        system_message_tokens, safe_token_limit, max_content_tokens
    );

    let chunks = split_blocks_into_chunks(blocks, max_content_tokens)?;
    debug!("Split content into {} chunks", chunks.len());
    process_chunks(&chunks, &system_message, app_config, task_lm).await
}

/// Calculate the safe token limit based on context window and utilization
pub fn calculate_safe_token_limit(context_window: i32, utilization: f32) -> i32 {
    (context_window as f32 * utilization) as i32
}

/// Recursively removes all fields named "private_spec" from a JSON value
fn remove_private_spec_recursive(value: &mut Value) {
    match value {
        Value::Object(map) => {
            map.remove("private_spec");
            for (_, v) in map.iter_mut() {
                remove_private_spec_recursive(v);
            }
        }
        Value::Array(arr) => {
            for item in arr.iter_mut() {
                remove_private_spec_recursive(item);
            }
        }
        _ => {}
    }
}

/// Converts a block to JSON string, removing any private_spec fields recursively
fn block_to_json_string(block: &GutenbergBlock) -> anyhow::Result<String> {
    let mut json_value = serde_json::to_value(block)?;
    remove_private_spec_recursive(&mut json_value);
    Ok(serde_json::to_string(&json_value)?)
}

/// Converts a vector of blocks to JSON string, removing any private_spec fields recursively
fn blocks_to_json_string(blocks: &[GutenbergBlock]) -> anyhow::Result<String> {
    let mut json_value = serde_json::to_value(blocks)?;
    remove_private_spec_recursive(&mut json_value);
    Ok(serde_json::to_string(&json_value)?)
}

/// Split blocks into chunks that fit within token limits
#[instrument(skip(blocks), fields(max_content_tokens))]
pub fn split_blocks_into_chunks(
    blocks: &[GutenbergBlock],
    max_content_tokens: i32,
) -> anyhow::Result<Vec<String>> {
    debug!("Starting to split {} blocks into chunks", blocks.len());
    let mut chunks: Vec<String> = Vec::new();
    let mut current_chunk: Vec<GutenbergBlock> = Vec::new();
    let mut current_chunk_tokens = 0;

    for block in blocks {
        let block_json = block_to_json_string(block)?;
        let block_tokens = estimate_tokens(&block_json);
        debug!(
            "Processing block {} with {} tokens",
            block.client_id, block_tokens
        );

        // If this block alone exceeds the limit, split it into smaller chunks
        if block_tokens > max_content_tokens {
            warn!(
                "Block {} exceeds max token limit ({} > {})",
                block.client_id, block_tokens, max_content_tokens
            );
            // Add any accumulated blocks as a chunk
            if !current_chunk.is_empty() {
                chunks.push(blocks_to_json_string(&current_chunk)?);
                current_chunk = Vec::new();
                current_chunk_tokens = 0;
            }

            // Then we do some crude splitting for the oversized block
            split_oversized_block(&block_json, max_content_tokens, &mut chunks)?;
            continue;
        }

        if current_chunk_tokens + block_tokens > max_content_tokens {
            debug!(
                "Creating new chunk after {} blocks ({} tokens)",
                current_chunk.len(),
                current_chunk_tokens
            );
            chunks.push(blocks_to_json_string(&current_chunk)?);
            current_chunk = Vec::new();
            current_chunk_tokens = 0;
        }

        current_chunk.push(block.clone());
        current_chunk_tokens += block_tokens;
    }

    if !current_chunk.is_empty() {
        debug!(
            "Adding final chunk with {} blocks ({} tokens)",
            current_chunk.len(),
            current_chunk_tokens
        );
        chunks.push(blocks_to_json_string(&current_chunk)?);
    }

    Ok(chunks)
}

/// Splits an oversized block into smaller string chunks
#[instrument(skip(block_json, chunks), fields(max_tokens))]
fn split_oversized_block(
    block_json: &str,
    max_tokens: i32,
    chunks: &mut Vec<String>,
) -> anyhow::Result<()> {
    let total_tokens = estimate_tokens(block_json);
    debug!(
        "Splitting oversized block with {} tokens into chunks of max {} tokens",
        total_tokens, max_tokens
    );

    // Make a very conservative estimate of the number of chunks we need
    // Ensure max_tokens is at least 1 to avoid division by zero
    let max_tokens_safe = max_tokens.max(1);
    let num_chunks = (total_tokens as f32 / (max_tokens_safe as f32 * 0.5)).ceil() as usize;

    if num_chunks <= 1 || num_chunks == 0 {
        chunks.push(block_json.to_string());
        return Ok(());
    }

    // Split by byte length (not character count) for efficiency,
    // but ensure we only slice at UTF-8 character boundaries
    let bytes_per_chunk = (block_json.len() / num_chunks).max(1);
    debug!(
        "Splitting into {} chunks of approximately {} bytes each",
        num_chunks, bytes_per_chunk
    );

    let mut start = 0;
    let mut iterations = 0;
    const MAX_ITERATIONS: usize = 100;
    while start < block_json.len() {
        iterations += 1;
        if iterations > MAX_ITERATIONS {
            return Err(anyhow::anyhow!(
                "Infinite loop protection: exceeded {} iterations in split_oversized_block",
                MAX_ITERATIONS
            ));
        }

        // Use checked arithmetic to prevent overflow
        let end_candidate = start
            .checked_add(bytes_per_chunk)
            .unwrap_or(block_json.len())
            .min(block_json.len());

        let mut end = if end_candidate >= block_json.len() {
            block_json.len()
        } else {
            end_candidate
        };

        // Adjust end backwards to the nearest UTF-8 character boundary
        while !block_json.is_char_boundary(end) && end > start {
            end -= 1;
        }

        // If backtracking resulted in end == start, advance forward to next boundary
        if end == start {
            // Find the next character boundary after start
            let mut next_boundary = start
                .checked_add(1)
                .unwrap_or(block_json.len())
                .min(block_json.len());

            let mut boundary_iterations = 0;
            const MAX_BOUNDARY_ITERATIONS: usize = 100;
            while next_boundary < block_json.len() && !block_json.is_char_boundary(next_boundary) {
                boundary_iterations += 1;
                if boundary_iterations > MAX_BOUNDARY_ITERATIONS {
                    return Err(anyhow::anyhow!(
                        "Infinite loop protection: exceeded {} iterations finding character boundary",
                        MAX_BOUNDARY_ITERATIONS
                    ));
                }
                next_boundary = next_boundary
                    .checked_add(1)
                    .unwrap_or(block_json.len())
                    .min(block_json.len());
            }
            end = next_boundary.min(block_json.len());
        }

        // Ensure we have a non-empty slice and valid bounds
        if end > start && end <= block_json.len() && start < block_json.len() {
            // Double-check bounds before slicing
            let chunk = block_json.get(start..end).ok_or_else(|| {
                anyhow::anyhow!("Invalid string slice bounds: {}..{}", start, end)
            })?;
            chunks.push(chunk.to_string());
            let new_start = end;
            // Safety check: ensure start always advances
            if new_start <= start {
                return Err(anyhow::anyhow!(
                    "Infinite loop protection: start did not advance ({} -> {})",
                    start,
                    new_start
                ));
            }
            start = new_start;
        } else {
            // Safety: if we can't make progress, break to avoid infinite loop
            // Push remaining content if any
            if start < block_json.len()
                && let Some(remaining) = block_json.get(start..)
                && !remaining.is_empty()
            {
                chunks.push(remaining.to_string());
            }
            break;
        }
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
#[instrument(skip(chunks, system_message, app_config, task_lm), fields(num_chunks = chunks.len()))]
async fn process_chunks(
    chunks: &[String],
    system_message: &APIMessage,
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
) -> anyhow::Result<String> {
    debug!("Processing {} chunks", chunks.len());
    let mut result = String::new();

    for (i, chunk) in chunks.iter().enumerate() {
        debug!("Processing chunk {}/{}", i + 1, chunks.len());
        let chunk_markdown =
            process_block_chunk(chunk, system_message, app_config, task_lm).await?;
        append_markdown_with_separator(&mut result, &chunk_markdown);
    }

    info!("Successfully cleaned content with LLM");
    Ok(result)
}

/// Process a subset of blocks in a single LLM request
#[instrument(skip(chunk, system_message, app_config, task_lm), fields(chunk_tokens = estimate_tokens(chunk)))]
async fn process_block_chunk(
    chunk: &str,
    system_message: &APIMessage,
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
) -> anyhow::Result<String> {
    let messages = prepare_llm_messages(chunk, system_message)?;
    let params = if task_lm.thinking {
        LLMRequestParams::Thinking(ThinkingParams {
            max_completion_tokens: None,
            verbosity: None,
            reasoning_effort: None,
            tools: vec![],
            tool_choice: None,
        })
    } else {
        LLMRequestParams::NonThinking(NonThinkingParams {
            temperature: Some(REQUEST_TEMPERATURE),
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
            max_tokens: None,
        })
    };
    let llm_base_request: LLMRequest = LLMRequest {
        messages,
        data_sources: vec![],
        params,
        response_format: None,
        stop: None,
    };
    info!(
        "Processing chunk of approximately {} tokens",
        estimate_tokens(chunk)
    );

    let completion = match make_blocking_llm_request(llm_base_request, app_config, task_lm).await {
        Ok(completion) => completion,
        Err(e) => {
            error!("Failed to process chunk: {}", e);
            return Err(e);
        }
    };

    match &completion //parse_text_completion
        .choices
        .first()
        .ok_or_else(|| {
            error!("No content returned from LLM");
            anyhow::anyhow!("No content returned from LLM")
        })?
        .message
        .fields
    {
        APIMessageKind::Text(msg) => Ok(msg.content.clone()),
        _ => Err(Error::msg(
            "Didn't receive a text LLM response in content cleaner, this shouldn't happen!",
        )),
    }
}

/// Prepare messages for the LLM request
pub fn prepare_llm_messages(
    chunk: &str,
    system_message: &APIMessage,
) -> anyhow::Result<Vec<APIMessage>> {
    let messages = vec![
        system_message.clone(),
        APIMessage {
            role: MessageRole::User,
            fields: APIMessageKind::Text(APIMessageText {
                content: format!(
                    "{}\n\n{}{}\n{}",
                    USER_PROMPT_START, JSON_BEGIN_MARKER, chunk, JSON_END_MARKER
                ),
            }),
        },
    ];

    Ok(messages)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm_utils::{APIMessageKind, APIMessageText};
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
        let t1 = estimate_tokens(&block_to_json_string(&block1)?);
        let t2 = estimate_tokens(&block_to_json_string(&block2)?);
        let t3 = estimate_tokens(&block_to_json_string(&block3)?);

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
        let blocks_json = blocks_to_json_string(&blocks)?;
        let system_message = APIMessage {
            role: MessageRole::System,
            fields: APIMessageKind::Text(APIMessageText {
                content: "System prompt".to_string(),
            }),
        };

        let messages = prepare_llm_messages(&blocks_json, &system_message)?;

        assert_eq!(messages.len(), 2);
        let msg1_content = match &messages[0].fields {
            APIMessageKind::Text(msg) => &msg.content,
            _ => "",
        };
        let msg2_content = match &messages[1].fields {
            APIMessageKind::Text(msg) => &msg.content,
            _ => "",
        };
        assert_eq!(messages[0].role, MessageRole::System);
        assert_eq!(msg1_content, "System prompt");
        assert_eq!(messages[1].role, MessageRole::User);
        assert!(msg2_content.contains(JSON_BEGIN_MARKER));
        assert!(msg2_content.contains("Test content"));

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
