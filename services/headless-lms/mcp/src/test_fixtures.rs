use std::sync::Arc;

use headless_lms_models::{
    courses::{Course, CourseAiPolicy},
    library::agent_changesets::course_state::{CourseState, PageRecord},
    library::entity_snapshots::{
        ChapterSnapshot, CourseDefaultReviewConfigSnapshot, CourseSettingsSnapshot, EntitySnapshot,
        ModuleSnapshot, PageSnapshot,
    },
    pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask},
    peer_or_self_review_configs::{CmsPeerOrSelfReviewConfig, PeerReviewProcessingStrategy},
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::engine::EditError;
use crate::engine::course_structure::{StructureChapter, StructurePage};
use crate::engine::op::{Op, PatchTarget, parse_ops};
use crate::engine::read::ReadOptions;
use crate::engine::{DocumentRef, PageDocument, PageType};

/// A stable id for a short test name, so fixtures can say `id("p1")`.
pub fn id(name: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, name.as_bytes())
}

/// `/<id of name>`.
pub fn p(name: &str) -> String {
    format!("/{}", id(name))
}

/// The ops of a JSON array, parsed for `target`'s tool.
pub fn ops(raw: Value, target: PatchTarget) -> Result<Vec<Op>, EditError> {
    parse_ops(
        raw.as_array().map(Vec::as_slice).unwrap_or_default(),
        target,
    )
}

pub fn block(
    name: &str,
    block_name: &str,
    attributes: Value,
    children: Vec<GutenbergBlock>,
) -> GutenbergBlock {
    let attributes: Map<String, Value> = match attributes {
        Value::Object(map) => map,
        _ => Map::new(),
    };
    GutenbergBlock::block_with_name_attributes_and_inner_blocks(block_name, attributes, children)
        .with_id(id(name))
}

pub fn para(name: &str, text: &str) -> GutenbergBlock {
    GutenbergBlock::paragraph(text).with_id(id(name))
}

pub fn heading(name: &str, text: &str) -> GutenbergBlock {
    block(
        name,
        "core/heading",
        json!({"content": text, "level": 2}),
        vec![],
    )
}

pub fn infobox(name: &str, children: Vec<GutenbergBlock>) -> GutenbergBlock {
    block(name, "moocfi/infobox", json!({}), children)
}

pub fn exercise(name: &str, exercise_name: &str) -> GutenbergBlock {
    block(
        name,
        "moocfi/exercise",
        json!({"id": id(exercise_name).to_string()}),
        vec![],
    )
}

pub fn page(name: &str, page_type: PageType, blocks: Vec<GutenbergBlock>) -> PageDocument {
    PageDocument {
        page_id: id(name),
        page_type,
        blocks,
    }
}

/// A structure page without exercises or submissions.
pub fn structure_page(name: &str, title: &str, url_path: &str) -> StructurePage {
    StructurePage {
        id: id(name),
        title: title.to_string(),
        url_path: url_path.to_string(),
        hidden: false,
        block_count: 3,
        exercise_count: 0,
        has_submissions: false,
        page_language_group_id: None,
    }
}

/// A structure chapter without a colour or dates.
pub fn structure_chapter(
    name: &str,
    number: i32,
    title: &str,
    pages: Vec<StructurePage>,
) -> StructureChapter {
    StructureChapter {
        id: id(name),
        chapter_number: number,
        name: title.to_string(),
        color: None,
        opens_at: None,
        deadline: None,
        pages,
    }
}

/// The pages borrowed, as the course-wide engines take them.
pub fn document_refs(pages: &[PageDocument]) -> Vec<DocumentRef<'_>> {
    pages
        .iter()
        .map(|page| DocumentRef::from(page.as_page_ref()))
        .collect()
}

/// Read settings with `budget_bytes` and no staged changes to mark.
pub fn read_options(budget_bytes: usize) -> ReadOptions<'static> {
    ReadOptions {
        budget_bytes,
        pending: None,
    }
}

/// The blocks' ids, for order assertions.
pub fn top_level(blocks: &[GutenbergBlock]) -> Vec<Uuid> {
    blocks.iter().map(|b| b.client_id).collect()
}

fn module(name: &str, label: Option<&str>, order_number: i32) -> ModuleSnapshot {
    ModuleSnapshot {
        name: label.map(str::to_string),
        order_number,
        ..ModuleSnapshot::new(id(name), id("course"))
    }
}

fn chapter(name: &str, module_name: &str, number: i32, front: &str) -> ChapterSnapshot {
    ChapterSnapshot {
        name: name.to_string(),
        chapter_number: number,
        front_page_id: Some(id(front)),
        ..ChapterSnapshot::new(id(name), id("course"), id(module_name))
    }
}

fn page_record(name: &str, chapter: Option<&str>, url_path: &str, order_number: i32) -> PageRecord {
    PageRecord {
        id: id(name),
        chapter_id: chapter.map(id),
        url_path: url_path.to_string(),
        title: name.to_string(),
        hidden: false,
        order_number,
        content: Arc::new(vec![para(&format!("{name}-p"), "text")]),
        joins_page_language_group_id: None,
    }
}

/// The `courses` row of [`course`].
pub fn course_row() -> Course {
    Course {
        id: id("course"),
        slug: "course".into(),
        created_at: chrono::DateTime::UNIX_EPOCH,
        updated_at: chrono::DateTime::UNIX_EPOCH,
        name: "Course".into(),
        description: None,
        organization_id: id("organization"),
        deleted_at: None,
        language_code: "en".into(),
        copied_from: None,
        content_search_language: None,
        course_language_group_id: id("language-group"),
        is_draft: false,
        is_test_mode: false,
        is_unlisted: false,
        base_module_completion_requires_n_submodule_completions: 0,
        can_add_chatbot: false,
        is_joinable_by_code_only: false,
        join_code: None,
        ask_marketing_consent: false,
        flagged_answers_threshold: None,
        flagged_answers_skip_manual_review_and_allow_retry: false,
        closed_at: None,
        closed_additional_message: None,
        closed_course_successor_id: None,
        chapter_locking_enabled: false,
        cheater_detection_enabled: false,
        ai_policy: CourseAiPolicy::NotSet,
        course_material_ai_instructions: None,
    }
}

/// A live course with a default and a named module, two chapters with front pages, the course
/// front page and a top-level page, listed out of order.
pub fn course() -> CourseState {
    CourseState {
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
            page_record("faq", None, "/faq", 1),
            page_record("ch1-b", Some("ch1"), "/chapter-1/b", 2),
            page_record("front", None, "/", 0),
            page_record("ch1-a", Some("ch1"), "/chapter-1/a", 1),
            page_record("ch1-front", Some("ch1"), "/chapter-1", 0),
            page_record("ch2-front", Some("ch2"), "/chapter-2", 0),
        ],
        glossary: vec![],
        references: vec![],
        course_default_review_config: None,
        exercises: None,
        exercise_deadlines: Default::default(),
    }
}

/// A chapter page whose one block is the exercise `ex`, with one slide and one task.
pub fn page_with_exercise() -> PageSnapshot {
    PageSnapshot {
        id: id("p"),
        course_id: id("course"),
        chapter_id: Some(id("ch1")),
        url_path: "/chapter-1/p".into(),
        title: "P".into(),
        hidden: false,
        order_number: 1,
        content: Arc::new(vec![exercise("exb", "ex")]),
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
        joins_page_language_group_id: None,
    }
}

/// [`course`] with exercise records and the course default review config "default-review", whose
/// instructions are a paragraph "def-p". Page `p` holds exercise `ex`, which uses the default with
/// peer reviews, and exercise `own`, which has its own config "own-config" with a paragraph
/// "own-p"; each has one task, `task` and `own-task`, whose instructions are a paragraph.
pub fn course_with_exercises() -> CourseState {
    let mut state = course();
    state.exercises = Some(Default::default());
    state.course_default_review_config = Some(CourseDefaultReviewConfigSnapshot {
        id: id("default-review"),
        course_id: id("course"),
        review_instructions: Some(json!([para("def-p", "Review the loop.")])),
    });
    let mut page = page_with_exercise();
    page.exercises[0].needs_peer_review = true;
    page.exercise_tasks[0].assignment = json!([para("task-p", "Write a loop.")]);
    let mut own = page.exercises[0].clone();
    own.id = id("own");
    own.order_number = 1;
    own.use_course_default_peer_or_self_review_config = false;
    own.peer_or_self_review_config = Some(CmsPeerOrSelfReviewConfig {
        id: id("own-config"),
        course_id: id("course"),
        exercise_id: Some(id("own")),
        peer_reviews_to_give: 2,
        peer_reviews_to_receive: 1,
        accepting_threshold: 2.0,
        processing_strategy: PeerReviewProcessingStrategy::AutomaticallyGradeByAverage,
        points_are_all_or_nothing: false,
        reset_answer_if_zero_points_from_review: false,
        review_instructions: Some(json!([para("own-p", "Own loop review.")])),
    });
    own.peer_or_self_review_questions = Some(vec![]);
    page.exercises.push(own);
    page.exercise_slides.push(CmsPageExerciseSlide {
        id: id("own-slide"),
        exercise_id: id("own"),
        order_number: 0,
    });
    page.exercise_tasks.push(CmsPageExerciseTask {
        id: id("own-task"),
        exercise_slide_id: id("own-slide"),
        assignment: json!([para("own-task-p", "Write another loop.")]),
        ..page.exercise_tasks[0].clone()
    });
    Arc::make_mut(&mut page.content).push(exercise("ownb", "own"));
    let page = EntitySnapshot::Page(page);
    state.set_entity(page.key(), Some(&page));
    state
}
