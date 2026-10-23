use std::collections::{HashMap, HashSet};

use headless_lms_models::{
    courses::CourseAiPolicy,
    library::entity_snapshots::{CourseSettingsSnapshot, PageSnapshot},
    pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask},
};
use pretty_assertions::assert_eq;
use serde_json::json;

use super::*;
use crate::ids::SequentialIds;
use crate::test_fixtures::{block, id, para};

fn module(name: &str, label: Option<&str>, order_number: i32) -> ModuleSnapshot {
    ModuleSnapshot {
        name: label.map(str::to_string),
        order_number,
        ..new_module(id("course"), id(name))
    }
}

fn chapter(name: &str, module_name: &str, number: i32, front: &str) -> ChapterSnapshot {
    ChapterSnapshot {
        name: name.to_string(),
        chapter_number: number,
        front_page_id: Some(id(front)),
        ..new_chapter(id("course"), id(name), id(module_name))
    }
}

fn page(name: &str, chapter: Option<&str>, url_path: &str, order_number: i32) -> PageRecord {
    PageRecord {
        id: id(name),
        chapter_id: chapter.map(id),
        url_path: url_path.to_string(),
        title: name.to_string(),
        hidden: false,
        order_number,
        content: vec![para(&format!("{name}-p"), "text")],
    }
}

pub(crate) fn course() -> CourseState {
    CourseState {
        course_id: id("course"),
        slug: "course".into(),
        language_code: "en".into(),
        settings: CourseSettingsSnapshot {
            course_id: id("course"),
            name: "Course".into(),
            description: None,
            is_draft: false,
            is_test_mode: false,
            is_unlisted: false,
            can_add_chatbot: false,
            is_joinable_by_code_only: false,
            ask_marketing_consent: false,
            flagged_answers_threshold: None,
            flagged_answers_skip_manual_review_and_allow_retry: false,
            closed_at: None,
            closed_additional_message: None,
            closed_course_successor_id: None,
            chapter_locking_enabled: false,
            ai_policy: CourseAiPolicy::NotSet,
            course_material_ai_instructions: None,
            base_module_completion_requires_n_submodule_completions: 0,
            audiences: vec![],
        },
        modules: vec![
            module("extra", Some("Extra"), 1),
            module("default", None, 0),
        ],
        chapters: vec![
            chapter("ch2", "default", 2, "ch2-front"),
            chapter("ch1", "default", 1, "ch1-front"),
        ],
        pages: vec![
            page("faq", None, "/faq", 1),
            page("ch1-b", Some("ch1"), "/chapter-1/b", 2),
            page("front", None, "/", 0),
            page("ch1-a", Some("ch1"), "/chapter-1/a", 1),
            page("ch1-front", Some("ch1"), "/chapter-1", 0),
            page("ch2-front", Some("ch2"), "/chapter-2", 0),
        ],
        glossary: vec![],
        references: vec![],
    }
}

#[test]
fn structure_orders_by_role_and_number() {
    let structure = structure(&course(), &HashSet::from([id("ch1-a")]));
    let modules: Vec<_> = structure.modules().map(|m| m.id).collect();
    assert_eq!(modules, vec![id("default"), id("extra")]);
    assert!(structure.course.modules[0].default);
    let chapters: Vec<_> = structure.chapters().map(|c| c.id).collect();
    assert_eq!(chapters, vec![id("ch1"), id("ch2")]);
    let ch1_pages: Vec<_> = structure.course.modules[0].chapters[0]
        .pages
        .iter()
        .map(|p| p.id)
        .collect();
    assert_eq!(ch1_pages, vec![id("ch1-front"), id("ch1-a"), id("ch1-b")]);
    let top: Vec<_> = structure.course.pages.iter().map(|p| p.id).collect();
    assert_eq!(top, vec![id("front"), id("faq")]);
    assert!(structure.course.modules[0].chapters[0].pages[1].has_submissions);
    assert_eq!(
        structure.page_type(id("ch1-front")),
        Some(PageType::ChapterFrontPage)
    );
    assert_eq!(
        structure.page_type(id("front")),
        Some(PageType::CourseFrontPage)
    );
}

#[test]
fn unchanged_structure_round_trips() {
    let state = course();
    let doc = structure(&state, &HashSet::new());
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
    let before = structure(&state, &HashSet::new());
    let mut after_doc = before.clone();
    let pages = &mut after_doc.course.modules[0].chapters[0].pages;
    pages.swap(1, 2);
    let mut new_page = pages[1].clone();
    new_page.id = id("new");
    new_page.url_path = "/chapter-1/new".into();
    pages.push(new_page);
    after_doc.course.modules[0].chapters.remove(1);

    let contents = HashMap::from([(id("new"), vec![para("np", "new")])]);
    let after = apply_structure(&state, &before, &after_doc, &contents);
    assert_eq!(after.page(id("ch1-b")).unwrap().order_number, 1);
    assert_eq!(after.page(id("ch1-a")).unwrap().order_number, 2);
    assert_eq!(after.page(id("new")).unwrap().order_number, 3);
    assert_eq!(after.page(id("new")).unwrap().content, contents[&id("new")]);
    assert_eq!(after.page(id("new")).unwrap().chapter_id, Some(id("ch1")));
    assert_eq!(after.page(id("faq")).unwrap().order_number, 7);
    assert!(after.page(id("ch2-front")).is_none());
    assert!(!after.chapters.iter().any(|c| c.id == id("ch2")));
}

#[test]
fn settings_round_trip_and_policy_conversion() {
    let mut state = course();
    let mut doc = settings_document(&state);
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
        settings_document(&state).modules[1].completion_policy,
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

fn exercise_block(name: &str, exercise: &str) -> GutenbergBlock {
    block(
        name,
        blocks::EXERCISE_BLOCK,
        json!({"id": id(exercise)}),
        vec![],
    )
}

fn bundle_page() -> PageSnapshot {
    PageSnapshot {
        id: id("p"),
        course_id: id("course"),
        chapter_id: Some(id("ch1")),
        url_path: "/chapter-1/p".into(),
        title: "P".into(),
        hidden: false,
        order_number: 1,
        content: vec![exercise_block("exb", "ex")],
        exercises: vec![CmsPageExercise {
            id: id("ex"),
            name: "Exercise".into(),
            order_number: 0,
            score_maximum: 1,
            max_tries_per_slide: None,
            limit_number_of_tries: false,
            deadline: None,
            needs_peer_review: false,
            needs_self_review: false,
            peer_or_self_review_config: None,
            peer_or_self_review_questions: None,
            use_course_default_peer_or_self_review_config: true,
            teacher_reviews_answer_after_locking: false,
        }],
        exercise_slides: vec![CmsPageExerciseSlide {
            id: id("slide"),
            exercise_id: id("ex"),
            order_number: 0,
        }],
        exercise_tasks: vec![CmsPageExerciseTask {
            id: id("task"),
            exercise_slide_id: id("slide"),
            assignment: json!([]),
            exercise_type: "quizzes".into(),
            private_spec: Some(json!({"a": 1})),
            order_number: 0,
            private_spec_files: vec![id("file")],
        }],
    }
}

#[test]
fn copied_blocks_get_new_ids_and_new_exercises() {
    let source = vec![
        block("box", "moocfi/infobox", json!({}), vec![para("c", "x")]),
        exercise_block("exb", "ex"),
    ];
    let ids = SequentialIds::new();
    let (copied, copies) = copy_blocks(&source, &ids);
    let source_ids: HashSet<Uuid> = blocks::all_ids(&source).into_iter().collect();
    assert!(
        blocks::all_ids(&copied)
            .iter()
            .all(|id| !source_ids.contains(id))
    );
    assert_eq!(copies.len(), 1);
    assert_eq!(copies[0].source_exercise_id, id("ex"));
    assert_eq!(
        blocks::exercise_id(&copied[1]),
        Some(copies[0].new_exercise_id)
    );
    assert_eq!(copied[0].inner_blocks[0].attributes["content"], json!("x"));
}

#[test]
fn copied_exercise_keeps_settings_under_new_ids() {
    let bundles = exercise_bundles(&bundle_page());
    let ids = SequentialIds::new();
    let copy = copy_exercise(&bundles[&id("ex")], id("ex2"), &ids);
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
    let source = bundle_page();
    let mut bundles = exercise_bundles(&source);
    let mut record = PageRecord::from(&source);
    record.content.push(para("p1", "text"));
    let snapshot = assemble_page_snapshot(id("course"), &record, &bundles).unwrap();
    assert_eq!(
        snapshot,
        PageSnapshot {
            content: record.content.clone(),
            ..source.clone()
        }
    );

    record.content.retain(|b| !blocks::is_exercise(b));
    let without = assemble_page_snapshot(id("course"), &record, &bundles).unwrap();
    assert!(without.exercises.is_empty() && without.exercise_tasks.is_empty());

    record.content.push(exercise_block("other", "missing"));
    bundles.remove(&id("ex"));
    assert_eq!(
        assemble_page_snapshot(id("course"), &record, &bundles),
        Err(vec![id("missing")])
    );
}
