use headless_lms_utils::document_schema_processor::{GutenbergBlock, replace_duplicate_client_ids};
use uuid::Uuid;

use crate::{
    ModelResult, pages::CmsPageUpdate,
    peer_or_self_review_questions::normalize_cms_peer_or_self_review_questions,
};

use super::{
    content::extract_top_level_exercise_ids, exercise_forking::dedupe_fork_duplicate_exercises,
};

/// Context from the previously saved page used to keep stable IDs during save.
pub struct OldPageSaveContext {
    pub old_exercise_ids: Vec<Uuid>,
}

/// Preprocesses an incoming CMS page update for persistence.
pub fn preprocess_cms_page_update(
    update: &mut CmsPageUpdate,
    old: &OldPageSaveContext,
) -> ModelResult<Vec<GutenbergBlock>> {
    dedupe_fork_duplicate_exercises(update, &old.old_exercise_ids)?;

    for exercise in update.exercises.iter_mut() {
        if let Some(peer_or_self_review_questions) = exercise.peer_or_self_review_questions.as_mut()
        {
            normalize_cms_peer_or_self_review_questions(peer_or_self_review_questions);
        }
    }

    let content = replace_duplicate_client_ids(update.content.clone());
    update.content = content.clone();

    Ok(content)
}

/// Builds save context from old persisted blocks.
pub fn old_context_from_blocks(blocks: &[GutenbergBlock]) -> OldPageSaveContext {
    OldPageSaveContext {
        old_exercise_ids: extract_top_level_exercise_ids(blocks),
    }
}
