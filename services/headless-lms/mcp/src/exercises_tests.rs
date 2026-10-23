use pretty_assertions::assert_eq;
use serde_json::json;

use super::*;
use crate::test_fixtures::{course_with_exercises, id, para};

#[test]
fn lists_hold_tasks_own_review_and_the_shared_default_once() {
    let state = course_with_exercises();
    let lists = lists_of_pages(&state, &[id("p")], false);
    assert_eq!(
        lists,
        vec![
            InstructionsList::Task {
                exercise_id: id("ex"),
                task_id: id("task"),
            },
            InstructionsList::Task {
                exercise_id: id("own"),
                task_id: id("own-task"),
            },
            InstructionsList::Review {
                exercise_id: id("own"),
            },
            InstructionsList::CourseDefaultReview {
                config_id: id("default-review"),
            },
        ]
    );

    let mut without_reviews = state.clone();
    for exercise_id in [id("ex"), id("own")] {
        exercise_mut(&mut without_reviews, exercise_id)
            .unwrap()
            .needs_peer_review = false;
    }
    assert_eq!(lists_of_pages(&without_reviews, &[id("p")], false).len(), 2);
    assert_eq!(lists_of_pages(&without_reviews, &[id("p")], true).len(), 3);
}

#[test]
fn edited_lists_are_found_and_empty_review_instructions_become_null() {
    let before = course_with_exercises();
    let mut after = before.clone();
    let task = InstructionsList::Task {
        exercise_id: id("ex"),
        task_id: id("task"),
    };
    set_blocks(&mut after, task, &[para("task-p", "Write two loops.")]);
    let own = InstructionsList::Review {
        exercise_id: id("own"),
    };
    set_blocks(&mut after, own, &[para("empty", " ")]);
    assert_eq!(stored_blocks(&after, own), Some(None));
    let changed = changed_lists(&before, &after);
    assert_eq!(changed.len(), 2);
    assert!(changed.contains(&task) && changed.contains(&own));
    assert_eq!(after.changes_since(&before).pages, vec![id("p")]);
}

#[test]
fn bulk_results_name_the_exercise_and_patch_exercise_path() {
    let state = course_with_exercises();
    let texts = text_documents(&state, &[id("p")], true, false, true);
    let task = texts
        .iter()
        .find(|document| {
            matches!(
                document.key,
                DocumentKey::Instructions {
                    list: InstructionsList::Task { .. },
                    ..
                }
            )
        })
        .unwrap();
    let task_match = task.key.block_match(
        &task.blocks[0],
        format!("/{}/attributes/content", task.blocks[0].client_id),
        String::new(),
    );
    let task_match = serde_json::to_value(&task_match).unwrap();
    assert_eq!(task_match["page_id"], json!(id("p")));
    assert_eq!(task_match["exercise"], json!(id("ex")));
    assert_eq!(
        task_match["path"],
        json!(format!(
            "/tasks/{}/{}/attributes/content",
            id("task"),
            task.blocks[0].client_id
        ))
    );
    let default = serde_json::to_value(DocumentKey::Instructions {
        list: InstructionsList::CourseDefaultReview {
            config_id: id("default-review"),
        },
        page_id: None,
    })
    .unwrap();
    assert!(default.get("page_id").is_none());
    assert_eq!(default["course_default_review_config"], json!(true));
    assert_eq!(default["instructions"], json!("/review_instructions"));

    let mut after = state.clone();
    let name_document = texts
        .iter()
        .find(|document| matches!(document.key, DocumentKey::ExerciseName { .. }))
        .unwrap()
        .clone();
    let mut renamed = name_document.clone();
    renamed.blocks[0]
        .attributes
        .insert("content".into(), json!("Loops"));
    apply_documents(&mut after, vec![renamed]).unwrap();
    assert_eq!(after.exercise(id("ex")).unwrap().name, "Loops");
    let mut emptied = name_document;
    emptied.blocks[0]
        .attributes
        .insert("content".into(), json!(""));
    assert!(apply_documents(&mut after, vec![emptied]).is_err());
}

#[test]
fn names_are_searched_as_rich_text_and_stored_as_plain_text() {
    let mut state = course_with_exercises();
    exercise_mut(&mut state, id("ex")).unwrap().name = "Q&A x < y".into();
    let texts = text_documents(&state, &[id("p")], false, false, true);
    let mut renamed = texts[0].clone();
    assert_eq!(
        renamed.blocks[0].attributes["content"],
        json!("Q&amp;A x &lt; y")
    );
    renamed.blocks[0]
        .attributes
        .insert("content".into(), json!("R&amp;D x &lt; y"));
    let mut after = state.clone();
    apply_documents(&mut after, vec![renamed]).unwrap();
    assert_eq!(after.exercise(id("ex")).unwrap().name, "R&D x < y");
}
