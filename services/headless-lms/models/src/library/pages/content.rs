use headless_lms_utils::document_schema_processor::GutenbergBlock;
use uuid::Uuid;

/// Extracts the ordered list of exercise ids from top-level `moocfi/exercise` blocks.
pub fn extract_top_level_exercise_ids(content: &[GutenbergBlock]) -> Vec<Uuid> {
    content
        .iter()
        .filter(|block| block.name == "moocfi/exercise")
        .filter_map(|block| block.attributes.get("id"))
        .filter_map(|value| value.as_str())
        .filter_map(|id| Uuid::parse_str(id).ok())
        .collect()
}
