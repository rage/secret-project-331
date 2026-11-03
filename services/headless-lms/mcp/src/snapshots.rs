//! Conversions between the stored entity snapshots and the documents the edit engines work on.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use headless_lms_models::{
    course_modules::{AutomaticCompletionRequirements, CompletionPolicy as ModelCompletionPolicy},
    courses::{Course, CourseAiPolicy},
    library::agent_changesets::course_state::{CourseState, PageRecord},
    library::entity_snapshots::{
        ChapterSnapshot, CourseAudienceSnapshot, GlossaryTermSnapshot, ModuleSnapshot,
        ReferenceSnapshot,
    },
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use uuid::Uuid;

use crate::engine::blocks;
use crate::engine::course_settings::{
    AiPolicy, Audience, CompletionPolicy, CompletionPolicyKind, CourseSettings,
    CourseSettingsCourse, ModuleSettings,
};
use crate::engine::course_structure::{
    CourseStructure, StructureChapter, StructureModule, StructurePage,
};
use crate::engine::glossary_references::{GlossaryAndReferences, GlossaryTerm, Reference};
use crate::engine::{PageDocument, PageRef, PageType};

fn structure_page(page: &PageRecord, facts: &PageFacts) -> StructurePage {
    let (block_count, exercise_count) = blocks::content_counts(&page.content);
    StructurePage {
        id: page.id,
        title: page.title.clone(),
        url_path: page.url_path.clone(),
        hidden: page.hidden,
        block_count,
        exercise_count,
        has_submissions: facts.pages_with_submissions.contains(&page.id),
        page_language_group_id: facts
            .page_language_groups
            .get(&page.id)
            .copied()
            .or(page.joins_page_language_group_id),
    }
}

/// Live facts about pages that the course tree shows.
pub struct PageFacts {
    pub pages_with_submissions: HashSet<Uuid>,
    /// By page id; pages not published yet have none.
    pub page_language_groups: HashMap<Uuid, Uuid>,
}

/// The course tree the structure engine edits, with the live facts of its pages.
pub fn structure(state: &CourseState, facts: &PageFacts) -> CourseStructure {
    let modules = state
        .modules_in_order()
        .into_iter()
        .map(|module| StructureModule {
            id: module.id,
            default: module.name.is_none(),
            name: module.name.clone(),
            chapters: state
                .chapters_in_order(module.id)
                .into_iter()
                .map(|chapter| StructureChapter {
                    id: chapter.id,
                    chapter_number: chapter.chapter_number,
                    name: chapter.name.clone(),
                    color: chapter.color.clone(),
                    opens_at: chapter.opens_at,
                    deadline: chapter.deadline,
                    pages: state
                        .pages_in_order(Some(chapter.id))
                        .into_iter()
                        .map(|p| structure_page(p, facts))
                        .collect(),
                })
                .collect(),
        })
        .collect();
    CourseStructure {
        id: state.course_id(),
        pages: state
            .pages_in_order(None)
            .into_iter()
            .map(|p| structure_page(p, facts))
            .collect(),
        modules,
    }
}

/// The editor context the page's blocks are checked in.
pub fn page_type(page: &PageRecord) -> PageType {
    PageType::of(page.chapter_id.is_some(), &page.url_path)
}

/// The page with its editor context, or `None` if the course has no such page.
pub fn page_document(state: &CourseState, page_id: Uuid) -> Option<PageDocument> {
    state.page(page_id).map(|page| page_ref(page).to_document())
}

/// The page with its editor context, borrowed.
pub fn page_ref(page: &PageRecord) -> PageRef<'_> {
    PageRef {
        page_id: page.id,
        page_type: page_type(page),
        blocks: &page.content,
    }
}

/// Every page of the course with its editor context, borrowed.
pub fn page_refs(state: &CourseState) -> Vec<PageRef<'_>> {
    state.pages.iter().map(|page| page_ref(page)).collect()
}

/// Sets the blocks of each page in `documents`.
pub fn apply_page_documents(
    state: &mut CourseState,
    documents: impl IntoIterator<Item = PageDocument>,
) {
    for document in documents {
        if let Some(page) = state.page_mut(document.page_id) {
            page.content = Arc::new(document.blocks);
        }
    }
}

fn page_lists(structure: &CourseStructure) -> Vec<(Option<Uuid>, &[StructurePage])> {
    std::iter::once((None, structure.pages.as_slice()))
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

    let modules_before: Vec<Uuid> = before.modules().map(|m| m.id).collect();
    let mut modules: Vec<ModuleSnapshot> = state
        .modules
        .iter()
        .filter(|m| !modules_before.contains(&m.id))
        .cloned()
        .collect();
    let modules_by_id: HashMap<Uuid, &ModuleSnapshot> =
        state.modules.iter().map(|m| (m.id, m)).collect();
    let module_order_numbers = list_order_numbers(
        Some(&modules_before),
        &after
            .modules()
            .map(|m| {
                (
                    m.id,
                    modules_by_id.get(&m.id).map(|module| module.order_number),
                )
            })
            .collect::<Vec<_>>(),
    );
    for (structure_module, order_number) in after.modules().zip(module_order_numbers) {
        let mut module = modules_by_id
            .get(&structure_module.id)
            .copied()
            .cloned()
            .unwrap_or_else(|| ModuleSnapshot::new(structure_module.id, state.course_id()));
        module.name = structure_module.name.clone();
        if let Some(order_number) = order_number {
            module.order_number = order_number;
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
    let chapters_by_id: HashMap<Uuid, &ChapterSnapshot> =
        state.chapters.iter().map(|c| (c.id, c)).collect();
    for structure_module in after.modules() {
        for structure_chapter in &structure_module.chapters {
            let mut chapter = chapters_by_id
                .get(&structure_chapter.id)
                .copied()
                .cloned()
                .unwrap_or_else(|| {
                    ChapterSnapshot::new(
                        structure_chapter.id,
                        state.course_id(),
                        structure_module.id,
                    )
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
    let pages_by_id: HashMap<Uuid, &PageRecord> = state.pages.iter().map(|p| (p.id, p)).collect();
    for (chapter_id, list) in page_lists(after) {
        let order_numbers = list_order_numbers(
            lists_before.get(&chapter_id).map(Vec::as_slice),
            &list
                .iter()
                .map(|p| (p.id, pages_by_id.get(&p.id).map(|page| page.order_number)))
                .collect::<Vec<_>>(),
        );
        for (structure_page, new_order_number) in list.iter().zip(order_numbers) {
            let mut page = pages_by_id
                .get(&structure_page.id)
                .copied()
                .cloned()
                .unwrap_or_else(|| PageRecord {
                    id: structure_page.id,
                    chapter_id,
                    url_path: String::new(),
                    title: String::new(),
                    hidden: false,
                    order_number: new_order_number.unwrap_or_default(),
                    content: Arc::new(
                        contents
                            .get(&structure_page.id)
                            .cloned()
                            .unwrap_or_default(),
                    ),
                    joins_page_language_group_id: None,
                });
            page.chapter_id = chapter_id;
            page.title = structure_page.title.clone();
            page.url_path = structure_page.url_path.clone();
            page.hidden = structure_page.hidden;
            page.order_number = new_order_number.unwrap_or(page.order_number);
            pages.push(page);
        }
    }
    next.pages = pages;
    next
}

/// New order numbers for the list `after` (entries with their current number, `None` if new), or
/// all `None` (keep every number) when the order equals `before_ids`. A list with no `before_ids`
/// is renumbered.
fn list_order_numbers(
    before_ids: Option<&[Uuid]>,
    after: &[(Uuid, Option<i32>)],
) -> Vec<Option<i32>> {
    let is_reordered =
        before_ids.is_none_or(|before| !before.iter().copied().eq(after.iter().map(|(id, _)| *id)));
    if is_reordered {
        increasing_order_numbers(after.iter().map(|(_, own)| *own))
            .into_iter()
            .map(Some)
            .collect()
    } else {
        vec![None; after.len()]
    }
}

/// Order numbers for a list in its new order, given each entry's current number (`None` if new).
/// The first gets 0, reserved for front pages and the default module; the others keep theirs while
/// strictly increasing, so only added, moved and pushed entries are renumbered.
fn increasing_order_numbers(current: impl Iterator<Item = Option<i32>>) -> Vec<i32> {
    let mut previous: Option<i32> = None;
    current
        .map(|own| {
            let next = match (own, previous) {
                (Some(own), Some(previous)) if own > previous => own,
                (_, Some(previous)) => previous + 1,
                (_, None) => 0,
            };
            previous = Some(next);
            next
        })
        .collect()
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
pub fn settings_document(state: &CourseState, course: &Course) -> CourseSettings {
    let settings = &state.settings;
    CourseSettings {
        course: CourseSettingsCourse {
            id: state.course_id(),
            slug: course.slug.clone(),
            language_code: course.language_code.clone(),
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
        modules: state
            .modules_in_order()
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
            course_id: state.course_id(),
            term: t.term.clone(),
            definition: t.definition.clone(),
        })
        .collect();
    state.references = document
        .references
        .iter()
        .map(|r| ReferenceSnapshot {
            id: r.id,
            course_id: state.course_id(),
            citation_key: r.citation_key.clone(),
            reference: r.bibtex.clone(),
        })
        .collect();
}

#[cfg(test)]
#[path = "snapshots_tests.rs"]
mod tests;
