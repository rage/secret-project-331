use std::sync::Mutex;

use async_trait::async_trait;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use pretty_assertions::assert_eq;
use serde_json::json;

use super::*;
use crate::snapshots::tests::course;
use crate::test_fixtures::{id, para};
use crate::validator::{BlockSchemas, BlockValidationError, ValidationOutcome, ValidatorError};

#[test]
fn state_changes_list_written_entities() {
    let before = course();
    let mut after = before.clone();
    after.page_mut(id("ch1-a")).unwrap().content = vec![para("x", "new")];
    after.chapters[0].name = "Renamed".into();
    after.modules.retain(|m| m.id != id("extra"));
    after.settings.name = "New name".into();

    let changes = state_changes(&before, &after);
    assert_eq!(changes.pages, vec![id("ch1-a")]);
    let keys: Vec<(AgentChangesetEntityType, Uuid, bool)> = changes
        .entities
        .iter()
        .map(|w| (w.entity_type, w.entity_id, w.after.is_some()))
        .collect();
    assert_eq!(
        keys,
        vec![
            (AgentChangesetEntityType::CourseSettings, id("course"), true),
            (AgentChangesetEntityType::Module, id("extra"), false),
            (AgentChangesetEntityType::Chapter, id("ch2"), true),
        ]
    );
    assert_eq!(state_changes(&before, &before), StateChanges::default());
}

fn delete(entity_type: AgentChangesetEntityType, name: &str) -> EntityWrite {
    EntityWrite {
        entity_type,
        entity_id: id(name),
        after: None,
    }
}

#[test]
fn removing_visible_content_of_a_live_course_is_risky() {
    let live = course();
    let mut after = live.clone();
    after.pages.retain(|p| p.id != id("faq"));
    let writes = vec![delete(AgentChangesetEntityType::Page, "faq")];
    let reasons = risk_reasons(&live, &after, &StudentActivity::default(), &writes);
    let codes: Vec<&str> = reasons[&(AgentChangesetEntityType::Page, id("faq"))]
        .iter()
        .map(|r| r.code.as_str())
        .collect();
    assert_eq!(codes, vec!["visible_page_removed"]);

    let mut draft = live.clone();
    draft.settings.is_draft = true;
    let mut draft_after = after.clone();
    draft_after.settings.is_draft = true;
    assert!(risk_reasons(&draft, &draft_after, &StudentActivity::default(), &writes).is_empty());
}

#[test]
fn risk_reasons_only_cover_written_entities() {
    let live = course();
    let mut after = live.clone();
    after.chapters.retain(|c| c.id != id("ch2"));
    after.pages.retain(|p| p.id != id("ch2-front"));
    let writes = vec![delete(AgentChangesetEntityType::Chapter, "ch2")];
    let reasons = risk_reasons(&live, &after, &StudentActivity::default(), &writes);
    assert!(reasons.contains_key(&(AgentChangesetEntityType::Chapter, id("ch2"))));
    assert!(!reasons.contains_key(&(AgentChangesetEntityType::Page, id("ch2-front"))));
}

#[test]
fn removing_an_exercise_with_submissions_is_risky() {
    let mut live = course();
    let exercise = crate::test_fixtures::block(
        "exb",
        crate::engine::blocks::EXERCISE_BLOCK,
        json!({"id": id("ex")}),
        vec![],
    );
    live.page_mut(id("ch1-a")).unwrap().content.push(exercise);
    let mut after = live.clone();
    after
        .page_mut(id("ch1-a"))
        .unwrap()
        .content
        .retain(|b| b.client_id != id("exb"));
    let activity = StudentActivity {
        exercises_with_submissions: HashSet::from([id("ex")]),
        pages_with_submissions: HashSet::from([id("ch1-a")]),
        ..Default::default()
    };
    let writes = vec![EntityWrite {
        entity_type: AgentChangesetEntityType::Page,
        entity_id: id("ch1-a"),
        after: None,
    }];
    let reasons = risk_reasons(&live, &after, &activity, &writes);
    assert_eq!(
        reasons[&(AgentChangesetEntityType::Page, id("ch1-a"))][0].code,
        "exercise_with_submissions_removed"
    );
}

/// Accepts blocks unless they contain `<script`, and normalises paragraphs by trimming them.
#[derive(Default)]
struct StubValidator {
    requests: Mutex<Vec<(PageType, usize)>>,
}

use crate::engine::PageType;

#[async_trait]
impl BlockValidator for StubValidator {
    async fn validate_blocks(
        &self,
        request: &ValidationRequest<'_>,
    ) -> Result<ValidationOutcome, ValidatorError> {
        self.requests
            .lock()
            .unwrap()
            .push((request.page_type, request.blocks.len()));
        let bad: Vec<&GutenbergBlock> = request
            .blocks
            .iter()
            .filter(|b| {
                Value::Object(b.attributes.clone())
                    .to_string()
                    .contains("<script")
            })
            .collect();
        if !bad.is_empty() {
            return Ok(ValidationOutcome {
                valid: false,
                blocks: vec![],
                errors: bad
                    .iter()
                    .map(|b| BlockValidationError {
                        client_id: Some(b.client_id),
                        path: vec![json!("attributes"), json!("content")],
                        code: "disallowed_markup".into(),
                        message: "script isn't allowed".into(),
                        fix: "remove the script tag".into(),
                    })
                    .collect(),
            });
        }
        let blocks = request
            .blocks
            .iter()
            .cloned()
            .map(|mut b| {
                if let Some(Value::String(content)) = b.attributes.get_mut("content") {
                    *content = content.trim().to_string();
                }
                b
            })
            .collect();
        Ok(ValidationOutcome {
            valid: true,
            blocks,
            errors: vec![],
        })
    }

    async fn block_schemas(&self) -> Result<BlockSchemas, ValidatorError> {
        Err(ValidatorError::Unavailable {
            reason: "stub".into(),
            retry_after: None,
        })
    }
}

#[tokio::test]
async fn validation_normalises_changed_roots_only() {
    let before = course();
    let mut after = before.clone();
    after
        .page_mut(id("ch1-a"))
        .unwrap()
        .content
        .push(para("new", "  padded  "));
    let validator = StubValidator::default();
    let names = validate_changed_blocks(
        &validator,
        &before,
        &mut after,
        &HashSet::new(),
        &ProgressReporter::disabled(),
    )
    .await
    .unwrap();
    assert_eq!(names, vec!["core/paragraph".to_string()]);
    assert_eq!(
        *validator.requests.lock().unwrap(),
        vec![(PageType::CoursePage, 1)]
    );
    let content = &after.page(id("ch1-a")).unwrap().content;
    assert_eq!(content[1].attributes["content"], json!("padded"));
    assert_eq!(content[0], before.page(id("ch1-a")).unwrap().content[0]);
}

#[tokio::test]
async fn invalid_blocks_reject_the_call_with_every_error() {
    let before = course();
    let mut after = before.clone();
    after.page_mut(id("faq")).unwrap().content = vec![para("bad", "<script>x</script>")];
    after.page_mut(id("ch1-b")).unwrap().content = vec![para("bad2", "<script>y</script>")];
    let error = validate_changed_blocks(
        &StubValidator::default(),
        &before,
        &mut after,
        &HashSet::new(),
        &ProgressReporter::disabled(),
    )
    .await
    .unwrap_err();
    let ToolError::Edit(error) = error else {
        panic!("expected an edit error, got {error:?}");
    };
    assert_eq!(error.code, EditErrorCode::InvalidBlocks);
    let details = error.details.unwrap();
    assert_eq!(details.as_array().unwrap().len(), 2);
    assert_eq!(details[0]["code"], json!("disallowed_markup"));
    assert_eq!(error.fix.as_deref(), Some("remove the script tag"));
}

#[tokio::test]
async fn skipped_pages_are_not_validated() {
    let before = course();
    let mut after = before.clone();
    after.page_mut(id("faq")).unwrap().content = vec![para("bad", "<script>x</script>")];
    let validator = StubValidator::default();
    validate_changed_blocks(
        &validator,
        &before,
        &mut after,
        &HashSet::from([id("faq")]),
        &ProgressReporter::disabled(),
    )
    .await
    .unwrap();
    assert!(validator.requests.lock().unwrap().is_empty());
}
