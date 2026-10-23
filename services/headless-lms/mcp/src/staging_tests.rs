use pretty_assertions::assert_eq;
use serde_json::json;

use super::*;
use crate::test_fixtures::{course, id, para};
use crate::test_support::StubValidator;
use crate::validator::ExerciseContext;
use headless_lms_models::library::agent_changesets::course_state::StateChanges;

#[test]
fn changes_since_lists_written_entities() {
    let before = course();
    let mut after = before.clone();
    after.page_mut(id("ch1-a")).unwrap().content = Arc::new(vec![para("x", "new")]);
    after.chapters[0].name = "Renamed".into();
    after.modules.retain(|m| m.id != id("extra"));
    after.settings.name = "New name".into();

    let changes = after.changes_since(&before);
    assert_eq!(changes.pages, vec![id("ch1-a")]);
    let keys: Vec<(ContentEntityType, Uuid, bool)> = changes
        .entities
        .iter()
        .map(|w| (w.key().0, w.key().1, w.after().is_some()))
        .collect();
    assert_eq!(
        keys,
        vec![
            (ContentEntityType::CourseSettings, id("course"), true),
            (ContentEntityType::Module, id("extra"), false),
            (ContentEntityType::Chapter, id("ch2"), true),
        ]
    );
    assert_eq!(before.changes_since(&before), StateChanges::default());
}

/// [`validate_changed_blocks`] of a call that generated no blocks.
async fn validate(
    validator: &StubValidator,
    live: &CourseState,
    before: &CourseState,
    after: &mut CourseState,
) -> Result<ValidatedBlocks, ToolError> {
    validate_changed_blocks(
        validator,
        live,
        before,
        after,
        &HashSet::new(),
        &ProgressReporter::default(),
    )
    .await
}

#[tokio::test]
async fn validation_normalises_changed_roots_only() {
    let before = course();
    let mut after = before.clone();
    Arc::make_mut(&mut after.page_mut(id("ch1-a")).unwrap().content)
        .push(para("new", "  padded  "));
    let validator = StubValidator::default();
    let validated = validate(&validator, &before, &before, &mut after)
        .await
        .unwrap();
    assert_eq!(validated.block_names, vec!["core/paragraph".to_string()]);
    assert_eq!(
        *validator.requests.lock().unwrap(),
        vec![(
            ValidationTarget::Page {
                page_type: PageType::CoursePage
            },
            1
        )]
    );
    let content = &after.page(id("ch1-a")).unwrap().content;
    assert_eq!(content[1].attributes["content"], json!("padded"));
    assert_eq!(content[0], before.page(id("ch1-a")).unwrap().content[0]);
}

#[tokio::test]
async fn invalid_blocks_reject_the_call_with_every_error() {
    let before = course();
    let mut after = before.clone();
    after.page_mut(id("faq")).unwrap().content = Arc::new(vec![para("bad", "<script>x</script>")]);
    after.page_mut(id("ch1-b")).unwrap().content =
        Arc::new(vec![para("bad2", "<script>y</script>")]);
    let error = validate(&StubValidator::default(), &before, &before, &mut after)
        .await
        .unwrap_err();
    let ToolError::Edit(error) = error else {
        panic!("expected an edit error, got {error:?}");
    };
    assert_eq!(error.code, EditErrorCode::InvalidBlocks);
    let details = error.details.unwrap();
    assert_eq!(details.as_array().unwrap().len(), 2);
    assert_eq!(details[0]["code"], json!("disallowed_markup"));
    assert_eq!(error.fix.as_deref(), Some("remove the <script tag"));
}

#[tokio::test]
async fn every_changed_page_goes_in_one_request() {
    let before = course();
    let mut after = before.clone();
    after.page_mut(id("faq")).unwrap().content = Arc::new(vec![para("f", "FAQ")]);
    after.page_mut(id("ch1-b")).unwrap().content = Arc::new(vec![para("b", "B")]);
    let validator = StubValidator::default();
    validate(&validator, &before, &before, &mut after)
        .await
        .unwrap();
    assert_eq!(*validator.calls.lock().unwrap(), 1);
    assert_eq!(validator.requests.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn problems_of_the_teachers_blocks_come_back_as_warnings() {
    let mut live = course();
    live.page_mut(id("ch1-a")).unwrap().content = Arc::new(vec![crate::test_fixtures::infobox(
        "box",
        vec![para("old", "<b>Teacher</b> text")],
    )]);
    let mut after = live.clone();
    Arc::make_mut(&mut after.page_mut(id("ch1-a")).unwrap().content)[0]
        .inner_blocks
        .push(para("new", "Agent text"));
    let validated = validate(&StubValidator::default(), &live, &live, &mut after)
        .await
        .unwrap();
    let warned: Vec<_> = validated
        .unchanged_block_warnings
        .iter()
        .map(|warning| (warning.page, warning.warning.client_id))
        .collect();
    assert_eq!(warned, vec![(Some(id("ch1-a")), Some(id("old")))]);
}

#[tokio::test]
async fn generated_blocks_are_validated_as_unchanged() {
    let before = course();
    let mut after = before.clone();
    after.page_mut(id("faq")).unwrap().content = Arc::new(vec![para("generated", "<b>Hi</b>")]);
    let validator = StubValidator::default();
    let validated = validate_changed_blocks(
        &validator,
        &before,
        &before,
        &mut after,
        &HashSet::from([id("generated")]),
        &ProgressReporter::default(),
    )
    .await
    .unwrap();
    assert_eq!(*validator.unchanged.lock().unwrap(), vec![id("generated")]);
    assert_eq!(validated.unchanged_block_warnings.len(), 1);
}

#[tokio::test]
async fn blocks_as_published_are_sent_as_unchanged() {
    let mut live = course();
    live.page_mut(id("ch1-a")).unwrap().content = Arc::new(vec![crate::test_fixtures::infobox(
        "box",
        vec![para("old", "Teacher text")],
    )]);
    let mut after = live.clone();
    Arc::make_mut(&mut after.page_mut(id("ch1-a")).unwrap().content)[0]
        .inner_blocks
        .push(para("new", "Agent text"));
    let validator = StubValidator::default();
    validate(&validator, &live, &live, &mut after)
        .await
        .unwrap();
    assert_eq!(
        *validator.unchanged.lock().unwrap(),
        vec![id("box"), id("old")]
    );
}

#[tokio::test]
async fn a_page_that_changes_type_is_validated_whole() {
    let live = course();
    let mut before = live.clone();
    before.page_mut(id("ch1-b")).unwrap().content =
        Arc::new(vec![para("b1", "One"), para("b2", "Two")]);
    let mut after = before.clone();
    let page = after.page_mut(id("ch1-b")).unwrap();
    page.chapter_id = None;
    page.url_path = "/b".into();
    let validator = StubValidator::default();
    validate(&validator, &live, &before, &mut after)
        .await
        .unwrap();
    assert_eq!(
        *validator.requests.lock().unwrap(),
        vec![(
            ValidationTarget::Page {
                page_type: PageType::TopLevelPage
            },
            2
        )]
    );
    assert!(validator.unchanged.lock().unwrap().is_empty());
}

#[tokio::test]
async fn chapter_blocks_cant_end_up_outside_chapters() {
    let mut before = course();
    before.page_mut(id("ch1-front")).unwrap().content =
        Arc::new(vec![crate::test_fixtures::infobox(
            "box",
            vec![crate::test_fixtures::block(
                "list",
                "moocfi/pages-in-chapter",
                json!({}),
                vec![],
            )],
        )]);
    let mut after = before.clone();
    let page = after.page_mut(id("ch1-front")).unwrap();
    page.chapter_id = None;
    page.url_path = "/moved".into();
    let error = validate(&StubValidator::default(), &before, &before, &mut after)
        .await
        .unwrap_err();
    let ToolError::Edit(error) = error else {
        panic!("expected an edit error, got {error:?}");
    };
    assert_eq!(error.code, EditErrorCode::InvalidBlocks);
    assert!(
        error.message.contains("moocfi/pages-in-chapter"),
        "{}",
        error.message
    );
}

#[tokio::test]
async fn changed_instructions_are_validated_in_their_exercise_context_and_normalised() {
    let before = crate::test_fixtures::course_with_exercises();
    let mut after = before.clone();
    let task = exercises::InstructionsList::Task {
        exercise_id: id("ex"),
        task_id: id("task"),
    };
    let default = exercises::InstructionsList::CourseDefaultReview {
        config_id: id("default-review"),
    };
    exercises::set_blocks(&mut after, task, &[para("task-p", "  Two loops.  ")]);
    exercises::set_blocks(&mut after, default, &[para("def-p", "Be kind.")]);
    let validator = StubValidator::default();
    validate(&validator, &before, &before, &mut after)
        .await
        .unwrap();
    let mut targets: Vec<ValidationTarget> = validator
        .requests
        .lock()
        .unwrap()
        .iter()
        .map(|(target, _)| *target)
        .collect();
    targets.sort_by_key(|target| format!("{target:?}"));
    assert_eq!(
        targets,
        vec![
            ValidationTarget::Exercise {
                exercise_context: ExerciseContext::ReviewInstructions
            },
            ValidationTarget::Exercise {
                exercise_context: ExerciseContext::TaskInstructions
            },
        ]
    );
    let blocks = exercises::document(&after, task).unwrap().unwrap().blocks;
    assert_eq!(blocks[0].attributes["content"], json!("Two loops."));
}

#[tokio::test]
async fn invalid_instructions_say_which_exercise_they_are_in() {
    let before = crate::test_fixtures::course_with_exercises();
    let mut after = before.clone();
    let task = exercises::InstructionsList::Task {
        exercise_id: id("ex"),
        task_id: id("task"),
    };
    exercises::set_blocks(&mut after, task, &[para("task-p", "<script>")]);
    let error = validate(&StubValidator::default(), &before, &before, &mut after)
        .await
        .unwrap_err();
    let ToolError::Edit(error) = error else {
        panic!("{error:?}");
    };
    let details = &error.details.unwrap()[0];
    assert_eq!(details["exercise"], json!(id("ex")));
    assert_eq!(details["page"], json!(id("p")));
    assert_eq!(
        details["instructions"],
        json!(format!("/tasks/{}", id("task")))
    );
}

#[tokio::test]
async fn a_fork_keeps_the_teachers_default_instructions_as_unchanged() {
    let before = crate::test_fixtures::course_with_exercises();
    let mut after = before.clone();
    let instructions = before
        .course_default_review_config
        .as_ref()
        .and_then(|config| config.review_instructions.clone())
        .map(Arc::new);
    exercises::exercise_mut(&mut after, id("ex"))
        .unwrap()
        .review_config = ExerciseReviewConfig::Own {
        config_id: id("fork"),
        review_instructions: instructions,
    };
    let validator = StubValidator::default();
    validate(&validator, &before, &before, &mut after)
        .await
        .unwrap();
    assert_eq!(*validator.unchanged.lock().unwrap(), vec![id("def-p")]);
}
