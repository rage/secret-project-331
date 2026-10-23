use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use headless_lms_models::{
    courses::CourseAiPolicy,
    library::entity_snapshots::{ExerciseBundle, PageSnapshot},
};
use pretty_assertions::assert_eq;

use super::*;
use crate::engine::PageType;
use crate::ids::{IdGenerator, SequentialIds};
use crate::test_fixtures::{course, course_row, exercise, id, page_with_exercise, para};

fn no_facts() -> PageFacts {
    PageFacts {
        pages_with_submissions: HashSet::new(),
        page_language_groups: HashMap::new(),
    }
}

#[test]
fn structure_orders_by_role_and_number() {
    let structure = structure(
        &course(),
        &PageFacts {
            pages_with_submissions: HashSet::from([id("ch1-a")]),
            page_language_groups: HashMap::new(),
        },
    );
    let modules: Vec<_> = structure.modules().map(|m| m.id).collect();
    assert_eq!(modules, vec![id("default"), id("extra")]);
    assert!(structure.modules[0].default);
    let chapters: Vec<_> = structure.chapters().map(|c| c.id).collect();
    assert_eq!(chapters, vec![id("ch1"), id("ch2")]);
    let ch1_pages: Vec<_> = structure.modules[0].chapters[0]
        .pages
        .iter()
        .map(|p| p.id)
        .collect();
    assert_eq!(ch1_pages, vec![id("ch1-front"), id("ch1-a"), id("ch1-b")]);
    let top: Vec<_> = structure.pages.iter().map(|p| p.id).collect();
    assert_eq!(top, vec![id("front"), id("faq")]);
    assert!(structure.modules[0].chapters[0].pages[1].has_submissions);
}

#[test]
fn page_types_follow_position() {
    let state = course();
    assert_eq!(
        page_type(state.page(id("ch1-front")).unwrap()),
        PageType::CoursePage
    );
    assert_eq!(
        page_type(state.page(id("front")).unwrap()),
        PageType::CourseFrontPage
    );
    assert_eq!(
        page_type(state.page(id("faq")).unwrap()),
        PageType::TopLevelPage
    );
}

#[test]
fn unchanged_structure_round_trips() {
    let state = course();
    let doc = structure(&state, &no_facts());
    let after = apply_structure(&state, &doc, &doc, &HashMap::new());
    assert_eq!(after.pages.len(), state.pages.len());
    for page in &state.pages {
        assert_eq!(after.page(page.id), Some(page));
    }
    for chapter in &state.chapters {
        assert!(after.chapters.contains(chapter));
    }
    for module in &state.modules {
        assert!(after.modules.contains(module));
    }
}

#[test]
fn reordering_renumbers_only_the_changed_list() {
    let mut state = course();
    state.page_mut(id("faq")).unwrap().order_number = 7;
    let before = structure(&state, &no_facts());
    let mut after_doc = before.clone();
    let pages = &mut after_doc.modules[0].chapters[0].pages;
    pages.swap(1, 2);
    let mut new_page = pages[1].clone();
    new_page.id = id("new");
    new_page.url_path = "/chapter-1/new".into();
    pages.push(new_page);
    after_doc.modules[0].chapters.remove(1);

    let contents = HashMap::from([(id("new"), vec![para("np", "new")])]);
    let after = apply_structure(&state, &before, &after_doc, &contents);
    assert_eq!(after.page(id("ch1-b")).unwrap().order_number, 2);
    assert_eq!(after.page(id("ch1-a")).unwrap().order_number, 3);
    assert_eq!(after.page(id("new")).unwrap().order_number, 4);
    assert_eq!(
        *after.page(id("new")).unwrap().content,
        contents[&id("new")]
    );
    assert_eq!(after.page(id("new")).unwrap().chapter_id, Some(id("ch1")));
    assert_eq!(after.page(id("faq")).unwrap().order_number, 7);
    assert!(after.page(id("ch2-front")).is_none());
    assert!(!after.chapters.iter().any(|c| c.id == id("ch2")));
}

#[test]
fn settings_round_trip_and_policy_conversion() {
    let mut state = course();
    let mut doc = settings_document(&state, &course_row());
    assert_eq!(doc.modules[0].id, id("default"));
    apply_settings(&mut state, &doc);
    assert_eq!(state, course());

    doc.course.ai_policy = AiPolicy::FullUse;
    doc.course.audiences.push(Audience {
        id: id("aud"),
        name: "Adults".into(),
    });
    doc.modules[1].completion_policy = CompletionPolicy {
        policy: CompletionPolicyKind::Automatic,
        number_of_points_treshold: Some(50),
        number_of_exercises_attempted_treshold: None,
        requires_exam: false,
    };
    apply_settings(&mut state, &doc);
    assert_eq!(state.settings.ai_policy, CourseAiPolicy::FullUse);
    assert_eq!(state.settings.audiences[0].audience, "Adults");
    let extra = state.modules.iter().find(|m| m.id == id("extra")).unwrap();
    assert_eq!(
        settings_document(&state, &course_row()).modules[1].completion_policy,
        doc.modules[1].completion_policy
    );
    assert!(matches!(
        &extra.completion_policy,
        ModelCompletionPolicy::Automatic(r) if r.course_module_id == id("extra")
    ));
}

#[test]
fn glossary_round_trip() {
    let mut state = course();
    state.glossary.push(GlossaryTermSnapshot {
        id: id("t"),
        course_id: id("course"),
        term: "Loop".into(),
        definition: "Repeats".into(),
    });
    let doc = glossary_document(&state);
    let mut next = state.clone();
    apply_glossary(&mut next, &doc);
    assert_eq!(next, state);
}

fn bundles_by_id(page: &PageSnapshot) -> HashMap<Uuid, ExerciseBundle> {
    page.exercise_bundles()
        .into_iter()
        .map(|bundle| (bundle.exercise.id, bundle))
        .collect()
}

#[test]
fn copied_exercise_keeps_settings_under_new_ids() {
    let bundles = bundles_by_id(&page_with_exercise());
    let ids = SequentialIds::default();
    let copy = bundles[&id("ex")].copy_with_new_ids(id("ex2"), || ids.new_id());
    assert_eq!(copy.exercise.id, id("ex2"));
    assert_eq!(copy.exercise.name, "Exercise");
    assert_eq!(copy.slides[0].exercise_id, id("ex2"));
    assert_ne!(copy.slides[0].id, id("slide"));
    assert_eq!(copy.tasks[0].exercise_slide_id, copy.slides[0].id);
    assert_ne!(copy.tasks[0].id, id("task"));
    assert_eq!(copy.tasks[0].private_spec_files, vec![id("file")]);
}

#[test]
fn page_snapshot_holds_exactly_the_exercises_of_its_blocks() {
    let source = page_with_exercise();
    let mut bundles = bundles_by_id(&source);
    let mut record = PageRecord::from(&source);
    Arc::make_mut(&mut record.content).push(para("p1", "text"));
    let snapshot = PageSnapshot::from_record_and_bundles(id("course"), &record, &bundles).unwrap();
    assert_eq!(
        snapshot,
        PageSnapshot {
            content: record.content.clone(),
            ..source.clone()
        }
    );

    Arc::make_mut(&mut record.content).retain(|b| !blocks::is_exercise(b));
    let without = PageSnapshot::from_record_and_bundles(id("course"), &record, &bundles).unwrap();
    assert!(without.exercises.is_empty() && without.exercise_tasks.is_empty());

    Arc::make_mut(&mut record.content).push(exercise("other", "missing"));
    bundles.remove(&id("ex"));
    assert_eq!(
        PageSnapshot::from_record_and_bundles(id("course"), &record, &bundles),
        Err(vec![id("missing")])
    );
}

#[test]
fn adding_a_page_keeps_the_numbers_of_the_others() {
    let mut state = course();
    state.page_mut(id("ch1-b")).unwrap().order_number = 5;
    let before = structure(&state, &no_facts());
    let mut after_doc = before.clone();
    let pages = &mut after_doc.modules[0].chapters[0].pages;
    let mut new_page = pages[1].clone();
    new_page.id = id("new");
    new_page.url_path = "/chapter-1/new".into();
    pages.insert(2, new_page);

    let after = apply_structure(&state, &before, &after_doc, &HashMap::new());
    assert_eq!(after.page(id("ch1-front")).unwrap().order_number, 0);
    assert_eq!(after.page(id("ch1-a")).unwrap().order_number, 1);
    assert_eq!(after.page(id("new")).unwrap().order_number, 2);
    assert_eq!(after.page(id("ch1-b")).unwrap().order_number, 5);
}
