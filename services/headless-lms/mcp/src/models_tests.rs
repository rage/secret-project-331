//! Models behaviour the MCP tools rely on: publish blockers and the agent preview.

use headless_lms_models::{
    library::agent_changesets::{
        PublishBlocker,
        preview::{PreviewExercise, PreviewPage},
    },
    pages::{CmsPageExerciseSlide, CmsPageExerciseTask},
};
use pretty_assertions::assert_eq;
use serde_json::json;

use crate::test_fixtures::{course, id, page_with_exercise};

#[test]
fn a_front_page_must_be_in_its_chapter_at_the_chapter_path() {
    let state = course();
    assert_eq!(state.publish_blockers(), Vec::new());

    let mut elsewhere = state.clone();
    elsewhere.page_mut(id("ch1-front")).unwrap().chapter_id = Some(id("ch2"));
    let blockers = elsewhere.publish_blockers();
    assert!(
        blockers.iter().any(|b| matches!(
            b,
            PublishBlocker::FrontPageInOtherChapter { front_page, .. }
                if front_page.entity_id == id("ch1-front")
        )),
        "{blockers:?}"
    );

    let mut off_path = state.clone();
    off_path.page_mut(id("ch1-front")).unwrap().url_path = "/chapter-1/old".into();
    let blockers = off_path.publish_blockers();
    assert!(
        blockers.iter().any(|b| matches!(
            b,
            PublishBlocker::FrontPageOffPath { expected_url_path, .. }
                if expected_url_path == "/chapter-1"
        )),
        "{blockers:?}"
    );
}

#[test]
fn a_blocker_that_only_renames_its_entities_isnt_new() {
    let mut duplicated = course();
    duplicated.page_mut(id("ch1-b")).unwrap().url_path = "/chapter-1/a".into();
    let mut renamed = duplicated.clone();
    renamed.page_mut(id("ch1-a")).unwrap().title = "Renamed".into();
    assert_eq!(renamed.blockers_added_since(&duplicated), Vec::new());

    let mut tripled = duplicated.clone();
    tripled.page_mut(id("faq")).unwrap().url_path = "/chapter-1/a".into();
    assert!(matches!(
        tripled.blockers_added_since(&duplicated).as_slice(),
        [PublishBlocker::DuplicatePath { pages, .. }] if pages.len() == 3
    ));
}

#[test]
fn a_preview_shows_assignments_in_slide_and_task_order_but_no_specs() {
    let mut page = page_with_exercise();
    page.exercise_slides.push(CmsPageExerciseSlide {
        id: id("slide0"),
        exercise_id: id("ex"),
        order_number: -1,
    });
    page.exercise_tasks[0].assignment = json!([{"name": "second"}]);
    page.exercise_tasks.push(CmsPageExerciseTask {
        id: id("task0"),
        exercise_slide_id: id("slide0"),
        assignment: json!([{"name": "first"}]),
        exercise_type: "quizzes".into(),
        private_spec: Some(json!("answers")),
        order_number: 0,
        private_spec_files: Vec::new(),
    });
    let preview = PreviewPage::from(page);
    assert_eq!(
        preview.exercises,
        vec![PreviewExercise {
            id: id("ex"),
            name: "Exercise".into(),
            assignment: vec![json!({"name": "first"}), json!({"name": "second"})],
            has_reviews: false,
            uses_course_default_review_config: true,
            review_instructions: None,
        }]
    );
    let serialized = serde_json::to_string(&preview).unwrap();
    for leak in [
        "private_spec",
        "answers",
        "\"a\":1",
        "quizzes",
        &id("file").to_string(),
    ] {
        assert!(!serialized.contains(leak), "{leak} in {serialized}");
    }
}
