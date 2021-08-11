use crate::models::pages::NormalizedCmsExercise;
use crate::models::pages::NormalizedCmsExerciseTask;
use anyhow::anyhow;
use anyhow::Result;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

static DISALLOWED_BLOCKS_IN_TOP_LEVEL_PAGES: Lazy<Vec<String>> = Lazy::new(|| {
    vec![
        "moocfi/exercise".to_string(),
        "moocfi/exercise-task".to_string(),
        "moocfi/exercises-in-chapter".to_string(),
        "moocfi/pages-in-chapter".to_string(),
        "moocfi/exercises-in-chapter".to_string(),
        "moocfi/chapter-progress".to_string(),
    ]
});

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct GutenbergBlock {
    #[serde(rename = "clientId")]
    pub client_id: String,
    pub name: String,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    pub attributes: serde_json::Value,
    #[serde(rename = "innerBlocks")]
    pub inner_blocks: Vec<GutenbergBlock>,
}

impl GutenbergBlock {
    pub fn empty_block_from_name(name: String) -> Self {
        GutenbergBlock {
            client_id: Uuid::new_v4().to_string(),
            name,
            is_valid: true,
            attributes: serde_json::json!({}),
            inner_blocks: vec![],
        }
    }
    pub fn block_with_name_and_attributes(name: &str, attributes: serde_json::Value) -> Self {
        GutenbergBlock {
            client_id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            is_valid: true,
            attributes,
            inner_blocks: vec![],
        }
    }
    pub fn block_with_name_attributes_and_inner_blocks(
        name: &str,
        attributes: serde_json::Value,
        inner_blocks: Vec<GutenbergBlock>,
    ) -> Self {
        GutenbergBlock {
            client_id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            is_valid: true,
            attributes,
            inner_blocks,
        }
    }
    pub fn hero_section(title: &str, sub_title: &str) -> Self {
        GutenbergBlock::block_with_name_and_attributes(
            "moocfi/hero-section",
            serde_json::json!({
                "title": title.to_string(),
                "subTitle": sub_title.to_string()
            }),
        )
    }
    pub fn landing_page_hero_section(title: &str, sub_title: &str) -> Self {
        GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/landing-page-hero-section",
            serde_json::json!({"title": title.to_string()}),
            vec![GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                    "align": "center",
                    "content": "",
                    "dropCap": false,
                    "placeholder": sub_title.to_string()
                }),
            )],
        )
    }
    pub fn course_objective_section() -> Self {
        GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/course-objective-section",
            serde_json::json!({
                "title": "In this course you'll..."
            }),
            vec![GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                "core/columns",
                serde_json::json!({
                    "isStackedOnMobile": true
                }),
                vec![
                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                        "core/column",
                        serde_json::json!({}),
                        vec![
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/heading",
                                serde_json::json!({
                                    "textAlign": "center",
                                    "content": "",
                                    "level": 3,
                                    "placeholder": "Objective #1"
                                }),
                            ),
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/paragraph",
                                serde_json::json!({
                                    "align": "center",
                                    "content": "",
                                    "dropCap": false,
                                    "placeholder": "Insert text..."
                                }),
                            ),
                        ],
                    ),
                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                        "core/column",
                        serde_json::json!({}),
                        vec![
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/heading",
                                serde_json::json!({
                                    "textAlign": "center",
                                    "content": "",
                                    "level": 3,
                                    "placeholder": "Objective #2"
                                }),
                            ),
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/paragraph",
                                serde_json::json!({
                                    "align": "center",
                                    "content": "",
                                    "dropCap": false,
                                    "placeholder": "Insert text..."
                                }),
                            ),
                        ],
                    ),
                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                        "core/column",
                        serde_json::json!({}),
                        vec![
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/heading",
                                serde_json::json!({
                                    "textAlign": "center",
                                    "content": "",
                                    "level": 3,
                                    "placeholder": "Objective #3"
                                }),
                            ),
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/paragraph",
                                serde_json::json!({
                                    "align": "center",
                                    "content": "",
                                    "dropCap": false,
                                    "placeholder": "Insert text..."
                                }),
                            ),
                        ],
                    ),
                ],
            )],
        )
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NormalizedDocument {
    pub content: Vec<GutenbergBlock>,
    pub exercises: Vec<NormalizedCmsExercise>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct DeNormalizedDocument {
    content: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NormalizedMoocfiExerciseAttributes {
    pub id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct GuternbergExerciseAttributes {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct GuternbergExerciseTaskAttributes {
    pub id: Uuid,
    pub exercise_type: String,
    pub private_spec: Option<String>,
}

pub fn normalize_from_json(input: serde_json::Value) -> Result<NormalizedDocument> {
    let parsed: Vec<GutenbergBlock> = serde_json::from_value(input)?;
    normalize(parsed)
}

pub fn contains_blocks_not_allowed_in_top_level_pages(input: &[GutenbergBlock]) -> bool {
    let res = input
        .iter()
        .any(|block| DISALLOWED_BLOCKS_IN_TOP_LEVEL_PAGES.contains(&block.name));
    res
}

pub fn normalize(input: Vec<GutenbergBlock>) -> Result<NormalizedDocument> {
    let mut exercises: Vec<NormalizedCmsExercise> = Vec::new();
    let res: Result<Vec<GutenbergBlock>> = input
        .into_iter()
        .enumerate()
        .map(|(i, block)| {
            if block.name != "moocfi/exercise" {
                return Ok(block);
            }
            let exercise_attributes: GuternbergExerciseAttributes =
                serde_json::from_value(block.attributes)?;
            let exercise_tasks: Result<Vec<NormalizedCmsExerciseTask>> = block
                .inner_blocks
                .into_iter()
                .map(|inner_block| {
                    if inner_block.name != "moocfi/exercise-task" {
                        return Err(anyhow!(
                            "Exercise block is only allowed to have exercise tasks blocks inside"
                        ));
                    }
                    let exercise_task_attributes: GuternbergExerciseTaskAttributes =
                        serde_json::from_value(inner_block.attributes)?;

                    let mut private_spec = None;
                    if let Some(spec_value) = exercise_task_attributes.private_spec {
                        private_spec = Some(serde_json::from_str(&spec_value)?)
                    }

                    Ok(NormalizedCmsExerciseTask {
                        id: exercise_task_attributes.id,
                        exercise_type: exercise_task_attributes.exercise_type,
                        private_spec,
                        assignment: serde_json::to_value(inner_block.inner_blocks)?,
                    })
                })
                .collect();

            let exercise = NormalizedCmsExercise {
                id: exercise_attributes.id,
                name: exercise_attributes.name,
                order_number: i as i32,
                exercise_tasks: exercise_tasks?,
            };
            let id = exercise.id;
            exercises.push(exercise);

            let normalized_block = GutenbergBlock {
                inner_blocks: Vec::new(),
                attributes: serde_json::to_value(NormalizedMoocfiExerciseAttributes { id })?,
                ..block
            };
            Ok(normalized_block)
        })
        .collect();

    Ok(NormalizedDocument {
        content: res?,
        exercises,
    })
}

pub fn denormalize(input: NormalizedDocument) -> Result<Vec<GutenbergBlock>> {
    let NormalizedDocument { content, exercises } = input;
    let res: Result<Vec<GutenbergBlock>> = content
        .into_iter()
        .map(|block| {
            if block.name != "moocfi/exercise" {
                return Ok(block);
            }
            let saved_attributes: NormalizedMoocfiExerciseAttributes =
                serde_json::from_value(block.attributes)?;
            let exercise = exercises
                .iter()
                .find(|exercise| exercise.id == saved_attributes.id)
                .ok_or_else(|| anyhow!("Could not find exercise that was in gutenberg schema"))?;
            let inner_blocks: Result<Vec<GutenbergBlock>> = exercise
                .exercise_tasks
                .iter()
                .map(|exercise_task| {
                    let exercise_type = &exercise_task.exercise_type;
                    let item_inner_blocks: Vec<GutenbergBlock> =
                        serde_json::from_value(exercise_task.assignment.clone())?;
                    let mut private_spec = None;
                    if let Some(spec_content) = &exercise_task.private_spec {
                        private_spec = Some(serde_json::to_string(spec_content)?)
                    }
                    Ok(GutenbergBlock {
                        client_id: Uuid::new_v4().to_string(), // this was discarded on normalizing but any random value should do
                        name: "moocfi/exercise-task".to_string(),
                        is_valid: true,
                        attributes: serde_json::to_value(GuternbergExerciseTaskAttributes {
                            id: exercise_task.id,
                            exercise_type: exercise_type.to_string(),
                            private_spec,
                        })?,
                        inner_blocks: item_inner_blocks,
                    })
                })
                .collect();
            let attributes = GuternbergExerciseAttributes {
                id: exercise.id,
                name: exercise.name.clone(),
            };
            Ok(GutenbergBlock {
                inner_blocks: inner_blocks?,
                attributes: serde_json::to_value(attributes)?,
                ..block
            })
        })
        .collect();
    res
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
    struct ExampleBlockAttributes {
        example: String,
    }
    #[test]
    fn it_doesnt_change_other_blocks() {
        let input = vec![
            GutenbergBlock {
                client_id: Uuid::new_v4().to_string(),
                name: "test/example-block".to_string(),
                is_valid: true,
                attributes: serde_json::to_value(ExampleBlockAttributes {
                    example: "example-exercise".to_string(),
                })
                .unwrap(),
                inner_blocks: Vec::new(),
            },
            GutenbergBlock {
                client_id: Uuid::new_v4().to_string(),
                name: "test/example-block".to_string(),
                is_valid: true,
                attributes: serde_json::to_value(ExampleBlockAttributes {
                    example: "example2".to_string(),
                })
                .unwrap(),
                inner_blocks: Vec::new(),
            },
        ];

        let input2 = input.clone();

        let output = normalize(input).expect("Normalization failed");
        assert_eq!(output.exercises.len(), 0);
        for o in output.content {
            assert!(
                input2.iter().any(|o2| o2 == &o),
                "input and output did not match"
            );
        }
    }

    #[test]
    fn normalization_works() {
        let input = vec![
            GutenbergBlock {
                client_id: "0edbfe2d-9677-475b-8040-97b7ab6b340d".to_string(),
                name: "test/example-block".to_string(),
                is_valid: true,
                attributes: serde_json::to_value(ExampleBlockAttributes {
                    example: "example-exercise".to_string(),
                })
                .unwrap(),
                inner_blocks: Vec::new(),
            },
            GutenbergBlock {
                client_id: "43fa8fab-0c65-46d6-b043-3ab09c93fbde".to_string(),
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                attributes: serde_json::to_value(GuternbergExerciseAttributes {
                    id: Uuid::parse_str("20dff562-0657-4e8e-b34e-65be68e96a81").unwrap(),
                    name: "Best exercise".to_string(),
                })
                .unwrap(),
                inner_blocks: vec![
                    GutenbergBlock {
                        client_id: "b7538d47-a904-4079-a73d-0fa15fa4664b".to_string(),
                        name: "moocfi/exercise-task".to_string(),
                        is_valid: true,
                        attributes: serde_json::to_value(GuternbergExerciseTaskAttributes {
                            id: Uuid::parse_str("f0aa52bf-16f4-4f5a-a5cc-a15b1510220c").unwrap(),
                            exercise_type: "example-exercise".to_string(),
                            private_spec: Some("{}".to_string()),
                        })
                        .unwrap(),
                        inner_blocks: Vec::new(),
                    },
                    GutenbergBlock {
                        client_id: "11b9a005-c552-4542-b6c0-a2e5a53c5b8f".to_string(),
                        name: "moocfi/exercise-task".to_string(),
                        is_valid: true,
                        attributes: serde_json::to_value(GuternbergExerciseTaskAttributes {
                            id: Uuid::parse_str("0b39498e-fb6c-43c7-b5e0-9fbc510d0e60").unwrap(),
                            exercise_type: "example-exercise".to_string(),
                            private_spec: Some("{}".to_string()),
                        })
                        .unwrap(),
                        inner_blocks: vec![GutenbergBlock {
                            client_id: "58333a81-6ee9-4638-8587-9f902bb9936f".to_string(),
                            name: "test/example-block".to_string(),
                            is_valid: true,
                            attributes: serde_json::to_value(ExampleBlockAttributes {
                                example: "example-exercise".to_string(),
                            })
                            .unwrap(),
                            inner_blocks: Vec::new(),
                        }],
                    },
                ],
            },
        ];

        let output = normalize(input).expect("Normalization failed");
        assert_eq!(output.exercises.len(), 1);
        let first_exercise = output.exercises.first().unwrap();
        assert_eq!(
            first_exercise,
            &NormalizedCmsExercise {
                id: Uuid::parse_str("20dff562-0657-4e8e-b34e-65be68e96a81").unwrap(),
                name: "Best exercise".to_string(),
                order_number: 1,
                exercise_tasks: vec![
                    NormalizedCmsExerciseTask {
                        id: Uuid::parse_str("f0aa52bf-16f4-4f5a-a5cc-a15b1510220c").unwrap(),
                        exercise_type: "example-exercise".to_string(),
                        private_spec: serde_json::from_str("{}").unwrap(),
                        assignment: serde_json::from_str("[]").unwrap(),
                    },
                    NormalizedCmsExerciseTask {
                        id: Uuid::parse_str("0b39498e-fb6c-43c7-b5e0-9fbc510d0e60").unwrap(),
                        exercise_type: "example-exercise".to_string(),
                        private_spec: serde_json::from_str("{}").unwrap(),
                        assignment: serde_json::to_value(vec![GutenbergBlock {
                            client_id: "58333a81-6ee9-4638-8587-9f902bb9936f".to_string(),
                            name: "test/example-block".to_string(),
                            is_valid: true,
                            attributes: serde_json::to_value(ExampleBlockAttributes {
                                example: "example-exercise".to_string(),
                            })
                            .unwrap(),
                            inner_blocks: Vec::new(),
                        }])
                        .unwrap(),
                    }
                ]
            }
        );
        assert_eq!(
            output.content,
            vec![
                GutenbergBlock {
                    client_id: "0edbfe2d-9677-475b-8040-97b7ab6b340d".to_string(),
                    name: "test/example-block".to_string(),
                    is_valid: true,
                    attributes: serde_json::to_value(ExampleBlockAttributes {
                        example: "example-exercise".to_string(),
                    })
                    .unwrap(),
                    inner_blocks: Vec::new(),
                },
                GutenbergBlock {
                    client_id: "43fa8fab-0c65-46d6-b043-3ab09c93fbde".to_string(),
                    name: "moocfi/exercise".to_string(),
                    is_valid: true,
                    attributes: serde_json::to_value(NormalizedMoocfiExerciseAttributes {
                        id: Uuid::parse_str("20dff562-0657-4e8e-b34e-65be68e96a81").unwrap(),
                    })
                    .unwrap(),
                    inner_blocks: Vec::new()
                },
            ]
        )
    }

    #[test]
    fn denormalization_works() {
        let exercises = vec![NormalizedCmsExercise {
            id: Uuid::parse_str("20dff562-0657-4e8e-b34e-65be68e96a81").unwrap(),
            name: "Best exercise".to_string(),
            order_number: 1,
            exercise_tasks: vec![
                NormalizedCmsExerciseTask {
                    id: Uuid::parse_str("f0aa52bf-16f4-4f5a-a5cc-a15b1510220c").unwrap(),
                    exercise_type: "example-exercise".to_string(),
                    private_spec: serde_json::from_str("{}").unwrap(),
                    assignment: serde_json::from_str("[]").unwrap(),
                },
                NormalizedCmsExerciseTask {
                    id: Uuid::parse_str("0b39498e-fb6c-43c7-b5e0-9fbc510d0e60").unwrap(),
                    exercise_type: "example-exercise".to_string(),
                    private_spec: serde_json::from_str("{}").unwrap(),
                    assignment: serde_json::to_value(vec![GutenbergBlock {
                        client_id: "58333a81-6ee9-4638-8587-9f902bb9936f".to_string(),
                        name: "test/example-block".to_string(),
                        is_valid: true,
                        attributes: serde_json::to_value(ExampleBlockAttributes {
                            example: "example-exercise".to_string(),
                        })
                        .unwrap(),
                        inner_blocks: Vec::new(),
                    }])
                    .unwrap(),
                },
            ],
        }];
        let content = vec![
            GutenbergBlock {
                client_id: "0edbfe2d-9677-475b-8040-97b7ab6b340d".to_string(),
                name: "test/example-block".to_string(),
                is_valid: true,
                attributes: serde_json::to_value(ExampleBlockAttributes {
                    example: "example-exercise".to_string(),
                })
                .unwrap(),
                inner_blocks: Vec::new(),
            },
            GutenbergBlock {
                client_id: "43fa8fab-0c65-46d6-b043-3ab09c93fbde".to_string(),
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                attributes: serde_json::to_value(NormalizedMoocfiExerciseAttributes {
                    id: Uuid::parse_str("20dff562-0657-4e8e-b34e-65be68e96a81").unwrap(),
                })
                .unwrap(),
                inner_blocks: Vec::new(),
            },
        ];
        let input = NormalizedDocument { content, exercises };
        let output = denormalize(input).expect("Denormalization failed");
        let exercise_block = output.iter().skip(1).next().expect("Array ended too soon");
        assert_eq!(exercise_block.name, "moocfi/exercise".to_string());
        assert_eq!(
            exercise_block.attributes,
            serde_json::to_value(GuternbergExerciseAttributes {
                id: Uuid::parse_str("20dff562-0657-4e8e-b34e-65be68e96a81").unwrap(),
                name: "Best exercise".to_string(),
            })
            .unwrap()
        );
        let inner_blocks = &exercise_block.inner_blocks;
        assert_eq!(inner_blocks.len(), 2);
        let exercise_task_block = inner_blocks
            .iter()
            .skip(1)
            .next()
            .expect("Array ended too soon");

        assert_eq!(exercise_task_block.name, "moocfi/exercise-task".to_string());
        assert_eq!(
            exercise_task_block.attributes,
            serde_json::to_value(GuternbergExerciseTaskAttributes {
                id: Uuid::parse_str("0b39498e-fb6c-43c7-b5e0-9fbc510d0e60").unwrap(),
                exercise_type: "example-exercise".to_string(),
                private_spec: Some("{}".to_string()),
            })
            .unwrap()
        );

        assert_eq!(
            exercise_task_block.inner_blocks,
            vec![GutenbergBlock {
                client_id: "58333a81-6ee9-4638-8587-9f902bb9936f".to_string(),
                name: "test/example-block".to_string(),
                is_valid: true,
                attributes: serde_json::to_value(ExampleBlockAttributes {
                    example: "example-exercise".to_string(),
                })
                .unwrap(),
                inner_blocks: Vec::new(),
            }]
        );
    }
}
