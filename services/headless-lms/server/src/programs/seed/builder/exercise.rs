use anyhow::Result;
use chrono::{DateTime, Utc};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::Value;
use uuid::Uuid;

use headless_lms_models::pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask};

use crate::programs::seed::{
    builder::{context::SeedContext, json_source::JsonSource},
    seed_helpers::example_exercise_flexible,
};
use headless_lms_utils::attributes;

/// Required IDs for creating exercises.
#[derive(Debug, Clone)]
pub struct ExerciseIds {
    pub exercise_id: Uuid,
    pub slide_id: Uuid,
    pub task_id: Uuid,
    pub block_id: Uuid,
}

/// Builder for different types of exercises.
#[derive(Debug, Clone)]
pub enum ExerciseBuilder {
    /// Multiple choice exercise with custom options
    ExampleExercise {
        ids: ExerciseIds,
        assignment_blocks: Vec<GutenbergBlock>,
        name: String,
        options: Value,
    },
    /// Quizzes service exercise with JSON specification
    Quizzes {
        ids: ExerciseIds,
        name: String,
        needs_peer_review: bool,
        deadline: Option<DateTime<Utc>>,
        spec: JsonSource,
        assignment_blocks: Vec<GutenbergBlock>,
    },
    /// Test My Code exercise
    Tmc {
        ids: ExerciseIds,
        name: String,
        deadline: Option<DateTime<Utc>>,
        spec: JsonSource,
        assignment_blocks: Vec<GutenbergBlock>,
    },
}

impl ExerciseBuilder {
    pub fn quizzes(
        name: impl Into<String>,
        ids: ExerciseIds,
        needs_pr: bool,
        deadline: Option<DateTime<Utc>>,
        spec: JsonSource,
        assignment_blocks: Vec<GutenbergBlock>,
    ) -> Self {
        Self::Quizzes {
            ids,
            name: name.into(),
            needs_peer_review: needs_pr,
            deadline,
            spec,
            assignment_blocks,
        }
    }

    pub fn tmc(
        name: impl Into<String>,
        ids: ExerciseIds,
        deadline: Option<DateTime<Utc>>,
        spec: JsonSource,
        assignment_blocks: Vec<GutenbergBlock>,
    ) -> Self {
        Self::Tmc {
            ids,
            name: name.into(),
            deadline,
            spec,
            assignment_blocks,
        }
    }

    pub fn example_exercise(
        name: impl Into<String>,
        ids: ExerciseIds,
        assignment_blocks: Vec<GutenbergBlock>,
        options: Value,
    ) -> Self {
        Self::ExampleExercise {
            ids,
            assignment_blocks,
            name: name.into(),
            options,
        }
    }

    pub(crate) fn to_cms(
        &self,
        _cx: &SeedContext,
    ) -> Result<(
        GutenbergBlock,
        CmsPageExercise,
        CmsPageExerciseSlide,
        CmsPageExerciseTask,
    )> {
        Ok(match self {
            ExerciseBuilder::Quizzes {
                ids,
                name,
                needs_peer_review: _,
                deadline: _,
                spec,
                assignment_blocks,
            } => {
                let spec_v = spec.load()?;
                let assignment_json = serde_json::to_value(assignment_blocks)?;
                let (block, exercise, mut slides, mut tasks) = example_exercise_flexible(
                    ids.exercise_id,
                    name.clone(),
                    vec![(
                        ids.slide_id,
                        vec![(ids.task_id, "quizzes".to_string(), assignment_json, spec_v)],
                    )],
                    ids.block_id,
                );
                let slide = slides.swap_remove(0);
                let task = tasks.swap_remove(0);
                (block, exercise, slide, task)
            }

            ExerciseBuilder::Tmc {
                ids,
                name,
                deadline: _,
                spec,
                assignment_blocks,
            } => {
                let spec_v = spec.load()?;
                let assignment_json = serde_json::to_value(assignment_blocks)?;
                let (block, exercise, mut slides, mut tasks) = example_exercise_flexible(
                    ids.exercise_id,
                    name.clone(),
                    vec![(
                        ids.slide_id,
                        vec![(ids.task_id, "tmc".to_string(), assignment_json, spec_v)],
                    )],
                    ids.block_id,
                );
                let slide = slides.swap_remove(0);
                let task = tasks.swap_remove(0);
                (block, exercise, slide, task)
            }

            ExerciseBuilder::ExampleExercise {
                ids,
                assignment_blocks,
                name,
                options,
            } => {
                let assignment_json = serde_json::to_value(assignment_blocks)?;
                let (_block, exercise, slides, tasks) = example_exercise_flexible(
                    ids.exercise_id,
                    name.clone(),
                    vec![(
                        ids.slide_id,
                        vec![(
                            ids.task_id,
                            "example-exercise".to_string(),
                            assignment_json,
                            options.clone(),
                        )],
                    )],
                    ids.block_id,
                );

                let slide = slides
                    .into_iter()
                    .next()
                    .expect("example exercise must produce one slide");
                let task = tasks
                    .into_iter()
                    .next()
                    .expect("example exercise must produce one task");

                let b = GutenbergBlock {
                    client_id: ids.block_id,
                    name: "moocfi/exercise".to_string(),
                    is_valid: true,
                    attributes: attributes! {
                        "id": ids.exercise_id,
                        "name": exercise.name,
                        "dropCap": false,
                    },
                    inner_blocks: vec![],
                };

                (b, exercise, slide, task)
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::programs::seed::seed_helpers::paragraph;
    use chrono::Utc;
    use serde_json::json;
    use uuid::Uuid;

    fn create_test_ids() -> ExerciseIds {
        ExerciseIds {
            exercise_id: Uuid::new_v4(),
            slide_id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            block_id: Uuid::new_v4(),
        }
    }

    #[test]
    fn test_quizzes_builder_creation() {
        let ids = create_test_ids();
        let assignment_blocks = vec![paragraph("Answer this question.", Uuid::new_v4())];
        let spec = JsonSource::Inline(json!({"type": "multiple_choice"}));
        let deadline = Some(Utc::now());

        let builder = ExerciseBuilder::quizzes(
            "Test Quiz",
            ids.clone(),
            true,
            deadline,
            spec,
            assignment_blocks.clone(),
        );

        match builder {
            ExerciseBuilder::Quizzes {
                ids: builder_ids,
                name,
                needs_peer_review,
                deadline: builder_deadline,
                spec: _,
                assignment_blocks: builder_blocks,
            } => {
                assert_eq!(name, "Test Quiz");
                assert!(needs_peer_review);
                assert_eq!(builder_deadline, deadline);
                assert_eq!(builder_ids.exercise_id, ids.exercise_id);
                assert_eq!(builder_blocks.len(), 1);
                assert_eq!(builder_blocks[0].name, "core/paragraph");
            }
            _ => panic!("Expected Quizzes variant"),
        }
    }

    #[test]
    fn test_tmc_builder_creation() {
        let ids = create_test_ids();
        let assignment_blocks = vec![paragraph("Write an `add` function.", Uuid::new_v4())];
        let spec = JsonSource::Inline(json!({"type": "tmc"}));
        let deadline = Some(Utc::now());

        let builder = ExerciseBuilder::tmc(
            "Test TMC",
            ids.clone(),
            deadline,
            spec,
            assignment_blocks.clone(),
        );

        match builder {
            ExerciseBuilder::Tmc {
                ids: builder_ids,
                name,
                deadline: builder_deadline,
                spec: _,
                assignment_blocks: builder_blocks,
            } => {
                assert_eq!(name, "Test TMC");
                assert_eq!(builder_deadline, deadline);
                assert_eq!(builder_ids.exercise_id, ids.exercise_id);
                assert_eq!(builder_blocks.len(), 1);
                assert_eq!(builder_blocks[0].name, "core/paragraph");
            }
            _ => panic!("Expected Tmc variant"),
        }
    }

    #[test]
    fn test_example_exercise_builder_creation() {
        let ids = create_test_ids();
        let assignment_blocks = vec![paragraph("Answer this question.", Uuid::new_v4())];
        let options = json!({
            "options": [
                {"text": "Option 1", "correct": true},
                {"text": "Option 2", "correct": false}
            ]
        });

        let builder = ExerciseBuilder::example_exercise(
            "Test Example Exercise",
            ids.clone(),
            assignment_blocks.clone(),
            options.clone(),
        );

        match builder {
            ExerciseBuilder::ExampleExercise {
                ids: builder_ids,
                assignment_blocks: builder_blocks,
                name,
                options: builder_options,
            } => {
                assert_eq!(name, "Test Example Exercise");
                assert_eq!(builder_ids.exercise_id, ids.exercise_id);
                assert_eq!(builder_blocks.len(), 1);
                assert_eq!(builder_blocks[0].name, "core/paragraph");
                assert_eq!(builder_options, options);
            }
            _ => panic!("Expected ExampleExercise variant"),
        }
    }

    #[test]
    fn test_exercise_ids_structure() {
        let ids = create_test_ids();

        assert_ne!(ids.exercise_id, ids.slide_id);
        assert_ne!(ids.exercise_id, ids.task_id);
        assert_ne!(ids.exercise_id, ids.block_id);
        assert_ne!(ids.slide_id, ids.task_id);
        assert_ne!(ids.slide_id, ids.block_id);
        assert_ne!(ids.task_id, ids.block_id);
    }

    #[test]
    fn test_builder_without_deadline() {
        let ids = create_test_ids();
        let assignment_blocks = vec![paragraph("Answer this question.", Uuid::new_v4())];
        let spec = JsonSource::Inline(json!({"type": "multiple_choice"}));

        let builder = ExerciseBuilder::quizzes(
            "No Deadline Quiz",
            ids,
            false,
            None,
            spec,
            assignment_blocks,
        );

        match builder {
            ExerciseBuilder::Quizzes {
                deadline,
                needs_peer_review,
                ..
            } => {
                assert_eq!(deadline, None);
                assert!(!needs_peer_review);
            }
            _ => panic!("Expected Quizzes variant"),
        }
    }

    #[test]
    fn test_string_conversion_for_names() {
        let ids = create_test_ids();
        let assignment_blocks = vec![paragraph("Answer this question.", Uuid::new_v4())];
        let spec = JsonSource::Inline(json!({"type": "multiple_choice"}));

        let builder1 = ExerciseBuilder::quizzes(
            "String name".to_string(),
            ids.clone(),
            false,
            None,
            spec.clone(),
            assignment_blocks.clone(),
        );

        let builder2 =
            ExerciseBuilder::quizzes("&str name", ids, false, None, spec, assignment_blocks);

        match (builder1, builder2) {
            (
                ExerciseBuilder::Quizzes { name: name1, .. },
                ExerciseBuilder::Quizzes { name: name2, .. },
            ) => {
                assert_eq!(name1, "String name");
                assert_eq!(name2, "&str name");
            }
            _ => panic!("Expected Quizzes variants"),
        }
    }
}
