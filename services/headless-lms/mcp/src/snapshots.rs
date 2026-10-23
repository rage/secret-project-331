//! Conversions between the stored entity snapshots and the documents the edit engines work on,
//! and the exercise bookkeeping that keeps a page's exercises in step with its blocks.

use std::collections::{HashMap, HashSet};

use headless_lms_models::{
    course_modules::{AutomaticCompletionRequirements, CompletionPolicy as ModelCompletionPolicy},
    courses::CourseAiPolicy,
    library::entity_snapshots::{
        ChapterSnapshot, CourseAudienceSnapshot, GlossaryTermSnapshot, ModuleSnapshot,
        PageSnapshot, ReferenceSnapshot,
    },
    pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask},
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::json;
use uuid::Uuid;

use crate::course_state::{CourseState, PageRecord};
use crate::engine::blocks;
use crate::engine::course_settings::{
    AiPolicy, Audience, CompletionPolicy, CompletionPolicyKind, CourseSettings,
    CourseSettingsCourse, ModuleSettings,
};
use crate::engine::course_structure::{
    CourseStructure, StructureChapter, StructureCourse, StructureModule, StructurePage,
};
use crate::engine::glossary_references::{GlossaryAndReferences, GlossaryTerm, Reference};
use crate::engine::{PageDocument, PageType};
use crate::ids::IdGenerator;

fn sorted_pages<'a>(
    pages: impl Iterator<Item = &'a PageRecord>,
    first: Option<Uuid>,
) -> Vec<&'a PageRecord> {
    let mut pages: Vec<&PageRecord> = pages.collect();
    pages.sort_by(|a, b| {
        (Some(a.id) != first, a.order_number, &a.url_path).cmp(&(
            Some(b.id) != first,
            b.order_number,
            &b.url_path,
        ))
    });
    pages
}

fn structure_page(page: &PageRecord, has_submissions: &HashSet<Uuid>) -> StructurePage {
    StructurePage {
        id: page.id,
        title: page.title.clone(),
        url_path: page.url_path.clone(),
        hidden: page.hidden,
        block_count: blocks::count_blocks(&page.content) as u32,
        exercise_count: page
            .content
            .iter()
            .filter(|b| blocks::is_exercise(b))
            .count() as u32,
        has_submissions: has_submissions.contains(&page.id),
    }
}

/// The course tree the structure engine edits. `pages_with_submissions` marks pages for risk
/// awareness.
pub fn structure(state: &CourseState, pages_with_submissions: &HashSet<Uuid>) -> CourseStructure {
    let course_front_page = state
        .pages
        .iter()
        .find(|p| p.chapter_id.is_none() && p.url_path == "/")
        .map(|p| p.id);
    let top_level = sorted_pages(
        state.pages.iter().filter(|p| p.chapter_id.is_none()),
        course_front_page,
    );
    let mut modules: Vec<&ModuleSnapshot> = state.modules.iter().collect();
    modules.sort_by_key(|m| (m.name.is_some(), m.order_number, m.id));
    let modules = modules
        .into_iter()
        .map(|module| {
            let mut chapters: Vec<&ChapterSnapshot> = state
                .chapters
                .iter()
                .filter(|c| c.course_module_id == module.id)
                .collect();
            chapters.sort_by_key(|c| (c.chapter_number, c.id));
            StructureModule {
                id: module.id,
                default: module.name.is_none(),
                name: module.name.clone(),
                chapters: chapters
                    .into_iter()
                    .map(|chapter| StructureChapter {
                        id: chapter.id,
                        chapter_number: chapter.chapter_number,
                        name: chapter.name.clone(),
                        color: chapter.color.clone(),
                        opens_at: chapter.opens_at,
                        deadline: chapter.deadline,
                        pages: sorted_pages(
                            state
                                .pages
                                .iter()
                                .filter(|p| p.chapter_id == Some(chapter.id)),
                            chapter.front_page_id,
                        )
                        .into_iter()
                        .map(|p| structure_page(p, pages_with_submissions))
                        .collect(),
                    })
                    .collect(),
            }
        })
        .collect();
    CourseStructure {
        course: StructureCourse {
            id: state.course_id,
            pages: top_level
                .into_iter()
                .map(|p| structure_page(p, pages_with_submissions))
                .collect(),
            modules,
        },
    }
}

/// The page with its editor context, or `None` if the course has no such page.
pub fn page_document(
    state: &CourseState,
    structure: &CourseStructure,
    page_id: Uuid,
) -> Option<PageDocument> {
    let page = state.page(page_id)?;
    Some(PageDocument {
        page_id,
        page_type: structure.page_type(page_id).unwrap_or(PageType::CoursePage),
        blocks: page.content.clone(),
    })
}

/// Every page of the course with its editor context.
pub fn page_documents(state: &CourseState, structure: &CourseStructure) -> Vec<PageDocument> {
    state
        .pages
        .iter()
        .filter_map(|p| page_document(state, structure, p.id))
        .collect()
}

/// Sets the blocks of each page in `documents`.
pub fn apply_page_documents<'a>(
    state: &mut CourseState,
    documents: impl IntoIterator<Item = &'a PageDocument>,
) {
    for document in documents {
        if let Some(page) = state.page_mut(document.page_id) {
            page.content = document.blocks.clone();
        }
    }
}

fn new_module(course_id: Uuid, id: Uuid) -> ModuleSnapshot {
    ModuleSnapshot {
        id,
        course_id,
        name: None,
        order_number: 0,
        completion_policy: ModelCompletionPolicy::Manual,
        certification_enabled: false,
        uh_course_code: None,
        ects_credits: None,
        completion_registration_link_override: None,
        completions_can_be_registered_to_sisu: true,
    }
}

fn new_chapter(course_id: Uuid, id: Uuid, module_id: Uuid) -> ChapterSnapshot {
    ChapterSnapshot {
        id,
        course_id,
        course_module_id: module_id,
        name: String::new(),
        color: None,
        chapter_number: 0,
        front_page_id: None,
        opens_at: None,
        deadline: None,
        chapter_image_path: None,
    }
}

fn page_lists(structure: &CourseStructure) -> Vec<(Option<Uuid>, &[StructurePage])> {
    std::iter::once((None, structure.course.pages.as_slice()))
        .chain(
            structure
                .chapters()
                .map(|c| (Some(c.id), c.pages.as_slice())),
        )
        .collect()
}

/// The state after the structure engine turned `before` into `after`. `contents` holds the blocks
/// of new pages. Order numbers change only in lists whose order changed.
pub fn apply_structure(
    state: &CourseState,
    before: &CourseStructure,
    after: &CourseStructure,
    contents: &HashMap<Uuid, Vec<GutenbergBlock>>,
) -> CourseState {
    let mut next = state.clone();

    let module_ids = |s: &CourseStructure| s.modules().map(|m| m.id).collect::<Vec<_>>();
    let renumber_modules = module_ids(before) != module_ids(after);
    let modules_before: HashSet<Uuid> = module_ids(before).into_iter().collect();
    let mut modules: Vec<ModuleSnapshot> = state
        .modules
        .iter()
        .filter(|m| !modules_before.contains(&m.id))
        .cloned()
        .collect();
    for (index, structure_module) in after.modules().enumerate() {
        let mut module = state
            .modules
            .iter()
            .find(|m| m.id == structure_module.id)
            .cloned()
            .unwrap_or_else(|| new_module(state.course_id, structure_module.id));
        module.name = structure_module.name.clone();
        if renumber_modules {
            module.order_number = index as i32;
        }
        modules.push(module);
    }
    next.modules = modules;

    let chapters_before: HashSet<Uuid> = before.chapters().map(|c| c.id).collect();
    let mut chapters: Vec<ChapterSnapshot> = state
        .chapters
        .iter()
        .filter(|c| !chapters_before.contains(&c.id))
        .cloned()
        .collect();
    for structure_module in after.modules() {
        for structure_chapter in &structure_module.chapters {
            let mut chapter = state
                .chapters
                .iter()
                .find(|c| c.id == structure_chapter.id)
                .cloned()
                .unwrap_or_else(|| {
                    new_chapter(state.course_id, structure_chapter.id, structure_module.id)
                });
            chapter.course_module_id = structure_module.id;
            chapter.name = structure_chapter.name.clone();
            chapter.color = structure_chapter.color.clone();
            chapter.opens_at = structure_chapter.opens_at;
            chapter.deadline = structure_chapter.deadline;
            chapter.chapter_number = structure_chapter.chapter_number;
            chapter.front_page_id = structure_chapter.pages.first().map(|p| p.id);
            chapters.push(chapter);
        }
    }
    next.chapters = chapters;

    let lists_before: HashMap<Option<Uuid>, Vec<Uuid>> = page_lists(before)
        .into_iter()
        .map(|(chapter, pages)| (chapter, pages.iter().map(|p| p.id).collect()))
        .collect();
    let pages_before: HashSet<Uuid> = lists_before.values().flatten().copied().collect();
    let mut pages: Vec<PageRecord> = state
        .pages
        .iter()
        .filter(|p| !pages_before.contains(&p.id))
        .cloned()
        .collect();
    for (chapter_id, list) in page_lists(after) {
        let ids: Vec<Uuid> = list.iter().map(|p| p.id).collect();
        let renumber = lists_before.get(&chapter_id) != Some(&ids);
        for (index, structure_page) in list.iter().enumerate() {
            let mut page = state
                .page(structure_page.id)
                .cloned()
                .unwrap_or_else(|| PageRecord {
                    id: structure_page.id,
                    chapter_id,
                    url_path: String::new(),
                    title: String::new(),
                    hidden: false,
                    order_number: index as i32,
                    content: contents
                        .get(&structure_page.id)
                        .cloned()
                        .unwrap_or_default(),
                });
            page.chapter_id = chapter_id;
            page.title = structure_page.title.clone();
            page.url_path = structure_page.url_path.clone();
            page.hidden = structure_page.hidden;
            if renumber {
                page.order_number = index as i32;
            }
            pages.push(page);
        }
    }
    next.pages = pages;
    next
}

/// The blocks a new chapter's front page gets when the agent gave none, as in the web UI.
pub fn default_chapter_front_page_content(chapter_name: &str) -> Vec<GutenbergBlock> {
    vec![
        GutenbergBlock::hero_section(chapter_name, ""),
        GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string()),
    ]
}

impl From<CourseAiPolicy> for AiPolicy {
    fn from(policy: CourseAiPolicy) -> Self {
        match policy {
            CourseAiPolicy::NotSet => AiPolicy::NotSet,
            CourseAiPolicy::NoAi => AiPolicy::NoAi,
            CourseAiPolicy::PlanningOnly => AiPolicy::PlanningOnly,
            CourseAiPolicy::Limited => AiPolicy::Limited,
            CourseAiPolicy::FullUse => AiPolicy::FullUse,
            CourseAiPolicy::Required => AiPolicy::Required,
        }
    }
}

impl From<AiPolicy> for CourseAiPolicy {
    fn from(policy: AiPolicy) -> Self {
        match policy {
            AiPolicy::NotSet => CourseAiPolicy::NotSet,
            AiPolicy::NoAi => CourseAiPolicy::NoAi,
            AiPolicy::PlanningOnly => CourseAiPolicy::PlanningOnly,
            AiPolicy::Limited => CourseAiPolicy::Limited,
            AiPolicy::FullUse => CourseAiPolicy::FullUse,
            AiPolicy::Required => CourseAiPolicy::Required,
        }
    }
}

fn completion_policy(policy: &ModelCompletionPolicy) -> CompletionPolicy {
    match policy {
        ModelCompletionPolicy::Automatic(requirements) => CompletionPolicy {
            policy: CompletionPolicyKind::Automatic,
            number_of_points_treshold: requirements.number_of_points_treshold,
            number_of_exercises_attempted_treshold: requirements
                .number_of_exercises_attempted_treshold,
            requires_exam: requirements.requires_exam,
        },
        ModelCompletionPolicy::Manual => CompletionPolicy::manual(),
    }
}

fn model_completion_policy(module_id: Uuid, policy: &CompletionPolicy) -> ModelCompletionPolicy {
    match policy.policy {
        CompletionPolicyKind::Automatic => {
            ModelCompletionPolicy::Automatic(AutomaticCompletionRequirements {
                course_module_id: module_id,
                number_of_exercises_attempted_treshold: policy
                    .number_of_exercises_attempted_treshold,
                number_of_points_treshold: policy.number_of_points_treshold,
                requires_exam: policy.requires_exam,
            })
        }
        CompletionPolicyKind::Manual => ModelCompletionPolicy::Manual,
    }
}

/// The settings document of the settings tool: the course's own settings and its modules'.
pub fn settings_document(state: &CourseState) -> CourseSettings {
    let settings = &state.settings;
    let mut modules: Vec<&ModuleSnapshot> = state.modules.iter().collect();
    modules.sort_by_key(|m| (m.name.is_some(), m.order_number, m.id));
    CourseSettings {
        course: CourseSettingsCourse {
            id: state.course_id,
            slug: state.slug.clone(),
            language_code: state.language_code.clone(),
            name: settings.name.clone(),
            description: settings.description.clone(),
            is_draft: settings.is_draft,
            is_test_mode: settings.is_test_mode,
            is_unlisted: settings.is_unlisted,
            chapter_locking_enabled: settings.chapter_locking_enabled,
            base_module_completion_requires_n_submodule_completions: settings
                .base_module_completion_requires_n_submodule_completions,
            ai_policy: settings.ai_policy.into(),
            audiences: settings
                .audiences
                .iter()
                .map(|a| Audience {
                    id: a.id,
                    name: a.audience.clone(),
                })
                .collect(),
            closed_at: settings.closed_at,
        },
        modules: modules
            .into_iter()
            .map(|m| ModuleSettings {
                id: m.id,
                name: m.name.clone(),
                completion_policy: completion_policy(&m.completion_policy),
                certification_enabled: m.certification_enabled,
            })
            .collect(),
    }
}

/// Writes the editable fields of the settings document back. Read-only fields are left alone.
pub fn apply_settings(state: &mut CourseState, document: &CourseSettings) {
    let course = &document.course;
    let settings = &mut state.settings;
    settings.name = course.name.clone();
    settings.description = course.description.clone();
    settings.is_unlisted = course.is_unlisted;
    settings.chapter_locking_enabled = course.chapter_locking_enabled;
    settings.base_module_completion_requires_n_submodule_completions =
        course.base_module_completion_requires_n_submodule_completions;
    settings.ai_policy = course.ai_policy.into();
    settings.audiences = course
        .audiences
        .iter()
        .map(|a| CourseAudienceSnapshot {
            id: a.id,
            audience: a.name.clone(),
        })
        .collect();
    settings.audiences.sort_by_key(|a| a.id);
    for module_settings in &document.modules {
        if let Some(module) = state
            .modules
            .iter_mut()
            .find(|m| m.id == module_settings.id)
        {
            module.completion_policy =
                model_completion_policy(module.id, &module_settings.completion_policy);
            module.certification_enabled = module_settings.certification_enabled;
        }
    }
}

/// The glossary and references document of the glossary tool.
pub fn glossary_document(state: &CourseState) -> GlossaryAndReferences {
    let mut glossary: Vec<GlossaryTerm> = state
        .glossary
        .iter()
        .map(|t| GlossaryTerm {
            id: t.id,
            term: t.term.clone(),
            definition: t.definition.clone(),
        })
        .collect();
    glossary.sort_by_key(|t| t.term.to_lowercase());
    let mut references: Vec<Reference> = state
        .references
        .iter()
        .map(|r| Reference {
            id: r.id,
            citation_key: r.citation_key.clone(),
            bibtex: r.reference.clone(),
        })
        .collect();
    references.sort_by(|a, b| a.citation_key.cmp(&b.citation_key));
    GlossaryAndReferences {
        glossary,
        references,
    }
}

/// Replaces the glossary terms and references with the document's.
pub fn apply_glossary(state: &mut CourseState, document: &GlossaryAndReferences) {
    state.glossary = document
        .glossary
        .iter()
        .map(|t| GlossaryTermSnapshot {
            id: t.id,
            course_id: state.course_id,
            term: t.term.clone(),
            definition: t.definition.clone(),
        })
        .collect();
    state.references = document
        .references
        .iter()
        .map(|r| ReferenceSnapshot {
            id: r.id,
            course_id: state.course_id,
            citation_key: r.citation_key.clone(),
            reference: r.bibtex.clone(),
        })
        .collect();
}

/// An exercise copy an edit created: the new exercise is built from the source's settings.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExerciseCopy {
    pub source_exercise_id: Uuid,
    pub new_exercise_id: Uuid,
}

/// Copies blocks with new client ids. Exercise blocks get new exercise ids, listed in the result.
pub fn copy_blocks(
    source: &[GutenbergBlock],
    ids: &dyn IdGenerator,
) -> (Vec<GutenbergBlock>, Vec<ExerciseCopy>) {
    let mut copies = Vec::new();
    let mut blocks = source.to_vec();
    blocks::walk_mut(&mut blocks, &mut |block| {
        block.client_id = ids.new_id();
        if blocks::is_exercise(block)
            && let Some(source_exercise_id) = blocks::exercise_id(block)
        {
            let new_exercise_id = ids.new_id();
            block.attributes.insert("id".into(), json!(new_exercise_id));
            copies.push(ExerciseCopy {
                source_exercise_id,
                new_exercise_id,
            });
        }
    });
    (blocks, copies)
}

/// One exercise with its slides and tasks, as a page snapshot stores them.
#[derive(Debug, Clone, PartialEq)]
pub struct ExerciseBundle {
    pub exercise: CmsPageExercise,
    pub slides: Vec<CmsPageExerciseSlide>,
    pub tasks: Vec<CmsPageExerciseTask>,
}

/// The exercises of a page snapshot keyed by exercise id.
pub fn exercise_bundles(page: &PageSnapshot) -> HashMap<Uuid, ExerciseBundle> {
    page.exercises
        .iter()
        .map(|exercise| {
            let slides: Vec<CmsPageExerciseSlide> = page
                .exercise_slides
                .iter()
                .filter(|s| s.exercise_id == exercise.id)
                .cloned()
                .collect();
            let tasks = page
                .exercise_tasks
                .iter()
                .filter(|t| slides.iter().any(|s| s.id == t.exercise_slide_id))
                .cloned()
                .collect();
            (
                exercise.id,
                ExerciseBundle {
                    exercise: exercise.clone(),
                    slides,
                    tasks,
                },
            )
        })
        .collect()
}

/// A new exercise with the source's settings, slides and tasks under new ids. Stored files the
/// tasks reference are shared, not duplicated.
pub fn copy_exercise(
    source: &ExerciseBundle,
    new_exercise_id: Uuid,
    ids: &dyn IdGenerator,
) -> ExerciseBundle {
    let mut exercise = source.exercise.clone();
    exercise.id = new_exercise_id;
    if let Some(config) = exercise.peer_or_self_review_config.as_mut() {
        let new_config_id = ids.new_id();
        config.id = new_config_id;
        config.exercise_id = Some(new_exercise_id);
        if let Some(questions) = exercise.peer_or_self_review_questions.as_mut() {
            for question in questions {
                question.id = ids.new_id();
                question.peer_or_self_review_config_id = new_config_id;
            }
        }
    } else if let Some(questions) = exercise.peer_or_self_review_questions.as_mut() {
        for question in questions {
            question.id = ids.new_id();
        }
    }
    let slide_ids: HashMap<Uuid, Uuid> =
        source.slides.iter().map(|s| (s.id, ids.new_id())).collect();
    let slides = source
        .slides
        .iter()
        .map(|s| CmsPageExerciseSlide {
            id: slide_ids[&s.id],
            exercise_id: new_exercise_id,
            order_number: s.order_number,
        })
        .collect();
    let tasks = source
        .tasks
        .iter()
        .map(|t| {
            let mut task = t.clone();
            task.id = ids.new_id();
            task.exercise_slide_id = slide_ids
                .get(&t.exercise_slide_id)
                .copied()
                .unwrap_or(t.exercise_slide_id);
            task
        })
        .collect();
    ExerciseBundle {
        exercise,
        slides,
        tasks,
    }
}

/// The full snapshot of a page after an edit: `record`'s fields and blocks, with exactly the
/// exercises its exercise blocks name, taken from `bundles`. Errors with the exercise ids
/// `bundles` doesn't have.
pub fn assemble_page_snapshot(
    course_id: Uuid,
    record: &PageRecord,
    bundles: &HashMap<Uuid, ExerciseBundle>,
) -> Result<PageSnapshot, Vec<Uuid>> {
    let mut snapshot = PageSnapshot {
        id: record.id,
        course_id,
        chapter_id: record.chapter_id,
        url_path: record.url_path.clone(),
        title: record.title.clone(),
        hidden: record.hidden,
        order_number: record.order_number,
        content: record.content.clone(),
        exercises: Vec::new(),
        exercise_slides: Vec::new(),
        exercise_tasks: Vec::new(),
    };
    let mut missing = Vec::new();
    for block in record.content.iter().filter(|b| blocks::is_exercise(b)) {
        let Some(exercise_id) = blocks::exercise_id(block) else {
            continue;
        };
        match bundles.get(&exercise_id) {
            Some(bundle) => {
                snapshot.exercises.push(bundle.exercise.clone());
                snapshot
                    .exercise_slides
                    .extend(bundle.slides.iter().cloned());
                snapshot.exercise_tasks.extend(bundle.tasks.iter().cloned());
            }
            None => missing.push(exercise_id),
        }
    }
    snapshot.exercises.sort_by_key(|e| (e.order_number, e.id));
    snapshot
        .exercise_slides
        .sort_by_key(|s| (s.exercise_id, s.order_number, s.id));
    snapshot
        .exercise_tasks
        .sort_by_key(|t| (t.exercise_slide_id, t.order_number, t.id));
    if missing.is_empty() {
        Ok(snapshot)
    } else {
        Err(missing)
    }
}

#[cfg(test)]
#[path = "snapshots_tests.rs"]
pub(crate) mod tests;
