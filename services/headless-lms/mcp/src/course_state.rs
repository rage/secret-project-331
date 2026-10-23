//! A course's editable content held in memory: as published, or as the user sees it with their
//! open changeset laid over it.

use std::collections::{HashMap, HashSet};

use chrono::Utc;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    ModelResult,
    agent_changeset_entities::{self, AgentChangesetEntity, AgentChangesetEntityType},
    agent_changesets::{self, AgentChangeset},
    chapters, course_module_completions, course_modules,
    courses::Course,
    exercise_slide_submissions, glossary,
    library::entity_snapshots::{
        self, ChapterSnapshot, CourseSettingsSnapshot, EntitySnapshot, GlossaryTermSnapshot,
        ModuleSnapshot, PageSnapshot, ReferenceSnapshot,
    },
    material_references, pages,
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::engine::read::ReadState;
use crate::risk::RiskFacts;

/// A page's structure fields and blocks; exercises stay in the full [`PageSnapshot`].
#[derive(Debug, Clone, PartialEq)]
pub struct PageRecord {
    pub id: Uuid,
    pub chapter_id: Option<Uuid>,
    pub url_path: String,
    pub title: String,
    pub hidden: bool,
    pub order_number: i32,
    pub content: Vec<GutenbergBlock>,
}

impl From<&PageSnapshot> for PageRecord {
    fn from(page: &PageSnapshot) -> Self {
        Self {
            id: page.id,
            chapter_id: page.chapter_id,
            url_path: page.url_path.clone(),
            title: page.title.clone(),
            hidden: page.hidden,
            order_number: page.order_number,
            content: page.content.clone(),
        }
    }
}

/// Every editable entity of one course.
#[derive(Debug, Clone, PartialEq)]
pub struct CourseState {
    pub course_id: Uuid,
    pub slug: String,
    pub language_code: String,
    pub settings: CourseSettingsSnapshot,
    pub modules: Vec<ModuleSnapshot>,
    pub chapters: Vec<ChapterSnapshot>,
    pub pages: Vec<PageRecord>,
    pub glossary: Vec<GlossaryTermSnapshot>,
    pub references: Vec<ReferenceSnapshot>,
}

fn upsert<T>(items: &mut Vec<T>, id: Uuid, item: Option<T>, id_of: impl Fn(&T) -> Uuid) {
    let position = items.iter().position(|existing| id_of(existing) == id);
    match (position, item) {
        (Some(index), Some(item)) => items[index] = item,
        (None, Some(item)) => items.push(item),
        (Some(index), None) => {
            items.remove(index);
        }
        (None, None) => {}
    }
}

impl CourseState {
    pub fn page(&self, page_id: Uuid) -> Option<&PageRecord> {
        self.pages.iter().find(|p| p.id == page_id)
    }

    pub fn page_mut(&mut self, page_id: Uuid) -> Option<&mut PageRecord> {
        self.pages.iter_mut().find(|p| p.id == page_id)
    }

    /// Replaces, adds or (with `None`) removes one entity.
    pub fn set_entity(
        &mut self,
        entity_type: AgentChangesetEntityType,
        entity_id: Uuid,
        snapshot: Option<&EntitySnapshot>,
    ) {
        match entity_type {
            AgentChangesetEntityType::Page => {
                let record = match snapshot {
                    Some(EntitySnapshot::Page(page)) => Some(PageRecord::from(page)),
                    _ => None,
                };
                upsert(&mut self.pages, entity_id, record, |p| p.id);
            }
            AgentChangesetEntityType::Chapter => {
                let chapter = match snapshot {
                    Some(EntitySnapshot::Chapter(chapter)) => Some(chapter.clone()),
                    _ => None,
                };
                upsert(&mut self.chapters, entity_id, chapter, |c| c.id);
            }
            AgentChangesetEntityType::Module => {
                let module = match snapshot {
                    Some(EntitySnapshot::Module(module)) => Some(module.clone()),
                    _ => None,
                };
                upsert(&mut self.modules, entity_id, module, |m| m.id);
            }
            AgentChangesetEntityType::CourseSettings => {
                if let Some(EntitySnapshot::CourseSettings(settings)) = snapshot {
                    self.settings = settings.clone();
                }
            }
            AgentChangesetEntityType::GlossaryTerm => {
                let term = match snapshot {
                    Some(EntitySnapshot::GlossaryTerm(term)) => Some(term.clone()),
                    _ => None,
                };
                upsert(&mut self.glossary, entity_id, term, |t| t.id);
            }
            AgentChangesetEntityType::Reference => {
                let reference = match snapshot {
                    Some(EntitySnapshot::Reference(reference)) => Some(reference.clone()),
                    _ => None,
                };
                upsert(&mut self.references, entity_id, reference, |r| r.id);
            }
        }
    }

    /// Students see this course: it is neither a draft nor in test mode.
    pub fn is_live(&self) -> bool {
        !self.settings.is_draft && !self.settings.is_test_mode
    }
}

/// The published course and the user's staged view of it.
#[derive(Debug, Clone)]
pub struct CourseView {
    pub course: Course,
    pub live: CourseState,
    pub staged: CourseState,
    pub changeset: Option<AgentChangeset>,
    pub staged_entities: Vec<AgentChangesetEntity>,
}

impl CourseView {
    pub fn state(&self, read_state: ReadState) -> &CourseState {
        match read_state {
            ReadState::Staged => &self.staged,
            ReadState::Published => &self.live,
        }
    }

    /// The page's full staged snapshot: `Some(None)` when the changeset deletes it, `None` when
    /// the changeset doesn't have it.
    pub fn staged_page_snapshot(&self, page_id: Uuid) -> ModelResult<Option<Option<PageSnapshot>>> {
        let Some(row) = self
            .staged_entities
            .iter()
            .find(|e| e.entity_type == AgentChangesetEntityType::Page && e.entity_id == page_id)
        else {
            return Ok(None);
        };
        let snapshot = row
            .after_snapshot
            .as_ref()
            .map(|value| EntitySnapshot::from_value(AgentChangesetEntityType::Page, value))
            .transpose()?;
        Ok(Some(match snapshot {
            Some(EntitySnapshot::Page(page)) => Some(page),
            _ => None,
        }))
    }

    /// The page's full snapshot as the user sees it, exercises included.
    pub async fn current_page_snapshot(
        &self,
        conn: &mut PgConnection,
        page_id: Uuid,
    ) -> ModelResult<Option<PageSnapshot>> {
        match self.staged_page_snapshot(page_id)? {
            Some(staged) => Ok(staged),
            None => entity_snapshots::load_page(conn, page_id).await,
        }
    }
}

/// Loads the course as published.
pub async fn load_live(conn: &mut PgConnection, course: &Course) -> ModelResult<CourseState> {
    let settings = entity_snapshots::load_course_settings(conn, course.id)
        .await?
        .ok_or_else(|| {
            <headless_lms_models::ModelError as BackendError>::new(
                headless_lms_models::ModelErrorType::NotFound,
                "Course not found",
                None,
            )
        })?;
    let modules = course_modules::get_by_course_id(conn, course.id)
        .await?
        .into_iter()
        .map(ModuleSnapshot::from)
        .collect();
    let chapters = chapters::get_course_chapters(conn, course.id)
        .await?
        .into_iter()
        .map(ChapterSnapshot::from)
        .collect();
    let mut page_records = Vec::new();
    for page in pages::get_pages_by_course_id(conn, course.id).await? {
        if page.exam_id.is_some() {
            continue;
        }
        page_records.push(PageRecord {
            id: page.id,
            chapter_id: page.chapter_id,
            url_path: page.url_path,
            title: page.title,
            hidden: page.hidden,
            order_number: page.order_number,
            content: serde_json::from_value(page.content)?,
        });
    }
    let glossary = glossary::fetch_for_course(conn, course.id)
        .await?
        .into_iter()
        .map(|term| GlossaryTermSnapshot {
            id: term.id,
            course_id: course.id,
            term: term.term,
            definition: term.definition,
        })
        .collect();
    let references = material_references::get_references_by_course_id(conn, course.id)
        .await?
        .into_iter()
        .map(|reference| ReferenceSnapshot {
            id: reference.id,
            course_id: reference.course_id,
            citation_key: reference.citation_key,
            reference: reference.reference,
        })
        .collect();
    Ok(CourseState {
        course_id: course.id,
        slug: course.slug.clone(),
        language_code: course.language_code.clone(),
        settings,
        modules,
        chapters,
        pages: page_records,
        glossary,
        references,
    })
}

/// Loads the published course and the user's open changeset for it.
pub async fn load_view(
    conn: &mut PgConnection,
    user_id: Uuid,
    course: Course,
) -> ModelResult<CourseView> {
    let live = load_live(conn, &course).await?;
    let mut staged = live.clone();
    let changeset = agent_changesets::get_open(conn, user_id, course.id).await?;
    let staged_entities = match &changeset {
        Some(changeset) => {
            agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?
        }
        None => Vec::new(),
    };
    for entity in &staged_entities {
        let snapshot = entity
            .after_snapshot
            .as_ref()
            .map(|value| EntitySnapshot::from_value(entity.entity_type, value))
            .transpose()?;
        staged.set_entity(entity.entity_type, entity.entity_id, snapshot.as_ref());
    }
    Ok(CourseView {
        course,
        live,
        staged,
        changeset,
        staged_entities,
    })
}

/// Published facts about student activity that make a change risky.
#[derive(Debug, Clone, Default)]
pub struct StudentActivity {
    pub exercises_with_submissions: HashSet<Uuid>,
    pub pages_with_submissions: HashSet<Uuid>,
    pub modules_with_completions: HashSet<Uuid>,
}

/// Which exercises have submissions and which modules have completions.
pub async fn load_student_activity(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<StudentActivity> {
    let exercises =
        exercise_slide_submissions::get_exercises_with_submissions_by_course_id(conn, course_id)
            .await?;
    let modules =
        course_module_completions::get_completed_module_ids_by_course_id(conn, course_id).await?;
    Ok(StudentActivity {
        exercises_with_submissions: exercises.iter().map(|e| e.exercise_id).collect(),
        pages_with_submissions: exercises.iter().map(|e| e.page_id).collect(),
        modules_with_completions: modules.into_iter().collect(),
    })
}

/// The risk rules' view of the published course.
pub fn risk_facts(live: &CourseState, activity: &StudentActivity) -> RiskFacts {
    RiskFacts {
        course_is_draft: live.settings.is_draft,
        course_is_test_mode: live.settings.is_test_mode,
        now: Utc::now(),
        hidden_pages: live
            .pages
            .iter()
            .filter(|p| p.hidden)
            .map(|p| p.id)
            .collect(),
        page_chapters: live
            .pages
            .iter()
            .filter_map(|p| Some((p.id, p.chapter_id?)))
            .collect::<HashMap<_, _>>(),
        chapter_opens_at: live.chapters.iter().map(|c| (c.id, c.opens_at)).collect(),
        exercises_with_submissions: activity.exercises_with_submissions.clone(),
        pages_with_submissions: activity.pages_with_submissions.clone(),
        modules_with_completions: activity.modules_with_completions.clone(),
    }
}
