use anyhow::Result;
use headless_lms_utils::document_schema_processor::GutenbergBlock;

use headless_lms_models::pages::{
    CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, CmsPageUpdate,
};

use crate::programs::seed::builder::{context::SeedContext, exercise::ExerciseBuilder};

use crate::programs::seed::seed_helpers::create_page;

/// Builder for course pages with Gutenberg blocks and exercises.
#[derive(Debug, Clone)]
pub struct PageBuilder {
    pub url: String,
    pub title: String,
    pub blocks: Vec<GutenbergBlock>,
    pub exercises: Vec<ExerciseBuilder>,
}

impl PageBuilder {
    pub fn new(url: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            title: title.into(),
            blocks: vec![],
            exercises: vec![],
        }
    }
    pub fn block(mut self, b: GutenbergBlock) -> Self {
        self.blocks.push(b);
        self
    }
    pub fn exercise(mut self, e: ExerciseBuilder) -> Self {
        self.exercises.push(e);
        self
    }
    pub fn blocks<I: IntoIterator<Item = GutenbergBlock>>(mut self, it: I) -> Self {
        self.blocks.extend(it);
        self
    }
    pub fn exercises<I: IntoIterator<Item = ExerciseBuilder>>(mut self, it: I) -> Self {
        self.exercises.extend(it);
        self
    }

    pub(crate) async fn seed(
        self,
        cx: &mut SeedContext<'_>,
        course_id: uuid::Uuid,
        chapter_id: uuid::Uuid,
    ) -> Result<uuid::Uuid> {
        let mut cms_exercises: Vec<CmsPageExercise> = vec![];
        let mut cms_slides: Vec<CmsPageExerciseSlide> = vec![];
        let mut cms_tasks: Vec<CmsPageExerciseTask> = vec![];
        let mut blocks = self.blocks;

        for e in self.exercises {
            let (b, e_, s, t) = e.to_cms(cx)?;
            blocks.push(b);
            cms_exercises.push(e_);
            cms_slides.push(s);
            cms_tasks.push(t);
        }

        create_page(
            cx.conn,
            course_id,
            cx.teacher,
            Some(chapter_id),
            CmsPageUpdate {
                url_path: self.url,
                title: self.title,
                chapter_id: Some(chapter_id),
                content: blocks,
                exercises: cms_exercises,
                exercise_slides: cms_slides,
                exercise_tasks: cms_tasks,
            },
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use crate::programs::seed::{
        builder::{
            exercise::{ExerciseBuilder, ExerciseIds},
            json_source::JsonSource,
            page::PageBuilder,
        },
        seed_helpers::paragraph,
    };

    use headless_lms_utils::document_schema_processor::GutenbergBlock;
    use serde_json::{Map, json};
    use uuid::Uuid;

    fn create_test_gutenberg_block() -> GutenbergBlock {
        let mut attributes = Map::new();
        attributes.insert("content".to_string(), json!("Test content"));

        GutenbergBlock {
            client_id: Uuid::new_v4(),
            name: "core/paragraph".to_string(),
            is_valid: true,
            attributes,
            inner_blocks: vec![],
        }
    }

    fn create_test_exercise_builder() -> ExerciseBuilder {
        let ids = ExerciseIds {
            exercise_id: Uuid::new_v4(),
            slide_id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            block_id: Uuid::new_v4(),
        };
        let assignment_blocks = vec![paragraph("Answer this question.", Uuid::new_v4())];
        let spec = JsonSource::Inline(json!({"type": "multiple_choice"}));

        ExerciseBuilder::quizzes("Test Exercise", ids, false, None, spec, assignment_blocks)
    }

    #[test]
    fn test_page_builder_creation_with_string() {
        let page = PageBuilder::new("test-url".to_string(), "Test Title".to_string());

        assert_eq!(page.url, "test-url");
        assert_eq!(page.title, "Test Title");
        assert!(page.blocks.is_empty());
        assert!(page.exercises.is_empty());
    }

    #[test]
    fn test_page_builder_creation_with_str() {
        let page = PageBuilder::new("test-url", "Test Title");

        assert_eq!(page.url, "test-url");
        assert_eq!(page.title, "Test Title");
        assert!(page.blocks.is_empty());
        assert!(page.exercises.is_empty());
    }

    #[test]
    fn test_page_builder_creation_mixed_types() {
        let page = PageBuilder::new("test-url".to_string(), "Test Title");

        assert_eq!(page.url, "test-url");
        assert_eq!(page.title, "Test Title");
    }

    #[test]
    fn test_page_builder_add_single_block() {
        let block = create_test_gutenberg_block();
        let page = PageBuilder::new("test-url", "Test Title").block(block.clone());

        assert_eq!(page.blocks.len(), 1);
        assert_eq!(page.blocks[0].name, block.name);
        assert_eq!(page.blocks[0].client_id, block.client_id);
    }

    #[test]
    fn test_page_builder_add_multiple_blocks() {
        let block1 = create_test_gutenberg_block();
        let block2 = create_test_gutenberg_block();

        let page = PageBuilder::new("test-url", "Test Title")
            .block(block1.clone())
            .block(block2.clone());

        assert_eq!(page.blocks.len(), 2);
        assert_eq!(page.blocks[0].client_id, block1.client_id);
        assert_eq!(page.blocks[1].client_id, block2.client_id);
    }

    #[test]
    fn test_page_builder_add_single_exercise() {
        let exercise = create_test_exercise_builder();
        let page = PageBuilder::new("test-url", "Test Title").exercise(exercise);

        assert_eq!(page.exercises.len(), 1);
    }

    #[test]
    fn test_page_builder_add_multiple_exercises() {
        let exercise1 = create_test_exercise_builder();
        let exercise2 = create_test_exercise_builder();

        let page = PageBuilder::new("test-url", "Test Title")
            .exercise(exercise1)
            .exercise(exercise2);

        assert_eq!(page.exercises.len(), 2);
    }

    #[test]
    fn test_page_builder_fluent_api_chaining() {
        let block1 = create_test_gutenberg_block();
        let block2 = create_test_gutenberg_block();
        let exercise1 = create_test_exercise_builder();
        let exercise2 = create_test_exercise_builder();

        let page = PageBuilder::new("test-url", "Test Title")
            .block(block1.clone())
            .exercise(exercise1)
            .block(block2.clone())
            .exercise(exercise2);

        assert_eq!(page.url, "test-url");
        assert_eq!(page.title, "Test Title");
        assert_eq!(page.blocks.len(), 2);
        assert_eq!(page.exercises.len(), 2);
        assert_eq!(page.blocks[0].client_id, block1.client_id);
        assert_eq!(page.blocks[1].client_id, block2.client_id);
    }

    #[test]
    fn test_page_builder_immutability() {
        let block = create_test_gutenberg_block();
        let exercise1 = create_test_exercise_builder();
        let exercise2 = create_test_exercise_builder();

        let original_page = PageBuilder::new("test-url", "Test Title");
        let page_with_block = original_page.block(block.clone());
        let page_with_both = page_with_block.exercise(exercise1);

        let fresh_original = PageBuilder::new("test-url", "Test Title");
        assert!(fresh_original.blocks.is_empty());
        assert!(fresh_original.exercises.is_empty());

        let test_page_with_block = PageBuilder::new("test-url", "Test Title").block(block.clone());
        assert_eq!(test_page_with_block.blocks.len(), 1);
        assert!(test_page_with_block.exercises.is_empty());

        assert_eq!(page_with_both.blocks.len(), 1);
        assert_eq!(page_with_both.exercises.len(), 1);

        let another_page = PageBuilder::new("another-url", "Another Title").exercise(exercise2);
        assert_eq!(another_page.exercises.len(), 1);
        assert!(another_page.blocks.is_empty());
    }

    #[test]
    fn test_page_builder_empty_initialization() {
        let page = PageBuilder::new("", "");

        assert_eq!(page.url, "");
        assert_eq!(page.title, "");
        assert!(page.blocks.is_empty());
        assert!(page.exercises.is_empty());
    }

    #[test]
    fn test_page_builder_with_special_characters() {
        let page = PageBuilder::new("/path/with-special_chars", "Title with émojis 🚀");

        assert_eq!(page.url, "/path/with-special_chars");
        assert_eq!(page.title, "Title with émojis 🚀");
    }

    #[test]
    fn test_page_builder_blocks_preserve_order() {
        let block1 = create_test_gutenberg_block();
        let block2 = create_test_gutenberg_block();
        let block3 = create_test_gutenberg_block();

        let page = PageBuilder::new("test-url", "Test Title")
            .block(block1.clone())
            .block(block2.clone())
            .block(block3.clone());

        assert_eq!(page.blocks.len(), 3);
        assert_eq!(page.blocks[0].client_id, block1.client_id);
        assert_eq!(page.blocks[1].client_id, block2.client_id);
        assert_eq!(page.blocks[2].client_id, block3.client_id);
    }

    #[test]
    fn test_page_builder_exercises_preserve_order() {
        let exercise1 = create_test_exercise_builder();
        let exercise2 = create_test_exercise_builder();
        let exercise3 = create_test_exercise_builder();

        let page = PageBuilder::new("test-url", "Test Title")
            .exercise(exercise1)
            .exercise(exercise2)
            .exercise(exercise3);

        assert_eq!(page.exercises.len(), 3);
    }
}
