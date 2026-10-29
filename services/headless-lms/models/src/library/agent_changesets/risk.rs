//! Risk rules: which staged changes only the user may publish, on the review page.
//!
//! Only live content is risky. Draft and test-mode courses, hidden pages and chapters that haven't
//! opened yet are free. Size alone never makes a change risky, and moving exercises never does:
//! an exercise's deadline counts only when its own deadline field changes.
//!
//! Risk belongs to the whole changeset against the live course, so it is judged on every staged
//! entity at once: an exercise moved off its page by one call and removed by another is still a
//! removal.

use std::borrow::Cow;
use std::collections::{BTreeMap, HashMap, HashSet};

use headless_lms_utils::document_schema_processor::walk;

use crate::{
    agent_changeset_entities::{self, AgentChangesetEntity, RiskReason},
    agent_changesets::AgentChangeset,
    course_module_completions, exercise_slide_submissions,
    library::{
        agent_changesets::course_state::{CourseParts, CourseState, CourseView, load_live_course},
        entity_snapshots::{ContentEntityType, EntityKey},
    },
    prelude::*,
};

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

/// What the caller has already loaded of the course a changeset's risk and publish blockers are
/// judged on.
pub enum RiskBaseline<'a> {
    /// Nothing: the course and the changeset are loaded in the caller's transaction.
    Current,
    /// The user's view of the course, with every part loaded. Its live course is the baseline, and
    /// its staged state stands in for the changeset's while the changeset is at the revision the
    /// view read.
    View(&'a CourseView),
}

/// A changeset as its risk and publish blockers are judged: the live course, the course with the
/// changeset laid over it, and the risk reasons stored with each staged entity.
pub(super) struct ChangesetState<'a> {
    pub live: Cow<'a, CourseState>,
    pub staged: Cow<'a, CourseState>,
    /// By staged entity; every entity the changeset stages has an entry.
    pub stored_reasons: HashMap<EntityKey, Vec<RiskReason>>,
}

impl<'a> ChangesetState<'a> {
    /// The state of a changeset with the staged `rows` over `live`.
    pub fn of_rows(live: Cow<'a, CourseState>, rows: &[AgentChangesetEntity]) -> Self {
        Self {
            staged: Cow::Owned(live.overlay(rows, CourseParts::All)),
            stored_reasons: rows
                .iter()
                .map(|row| (row.key(), row.risk_reasons.clone()))
                .collect(),
            live,
        }
    }
}

impl RiskBaseline<'_> {
    /// The state of `changeset`, which the caller has locked.
    pub(super) async fn changeset_state(
        &self,
        conn: &mut PgConnection,
        changeset: &AgentChangeset,
    ) -> ModelResult<ChangesetState<'_>> {
        let view = match self {
            RiskBaseline::View(view) => view,
            RiskBaseline::Current => {
                let course = crate::courses::get_course(conn, changeset.course_id).await?;
                let live = load_live_course(conn, &course, CourseParts::All).await?;
                let rows =
                    agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?;
                return Ok(ChangesetState::of_rows(Cow::Owned(live), &rows));
            }
        };
        let is_as_read = view
            .changeset
            .as_ref()
            .is_some_and(|read| read.id == changeset.id && read.revision == changeset.revision);
        if !is_as_read {
            let rows = agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?;
            return Ok(ChangesetState::of_rows(Cow::Borrowed(&view.live), &rows));
        }
        Ok(ChangesetState {
            live: Cow::Borrowed(&view.live),
            staged: Cow::Borrowed(&view.staged),
            stored_reasons: view
                .staged_entities
                .iter()
                .map(|(key, row)| (*key, row.risk_reasons.clone()))
                .collect(),
        })
    }
}

/// The risk reasons of each entity `staged` changes from `live`, at `now`.
pub fn classify(
    live: &CourseState,
    staged: &CourseState,
    activity: &StudentActivity,
    now: DateTime<Utc>,
) -> HashMap<EntityKey, Vec<RiskReason>> {
    if !live.is_live() {
        return HashMap::new();
    }
    let mut classifier = Classifier {
        live,
        staged,
        activity,
        now,
        reasons: HashMap::new(),
    };
    let pages_losing_submissions = classifier.classify_pages();
    classifier.classify_chapters(&pages_losing_submissions);
    classifier.classify_exercise_deadlines();
    classifier.classify_modules();
    classifier.classify_settings();
    classifier.reasons
}

/// The state of one [`classify`] call. The rule families run in a fixed order, since an entity's
/// reasons are compared with the stored ones as a list.
struct Classifier<'a> {
    live: &'a CourseState,
    staged: &'a CourseState,
    activity: &'a StudentActivity,
    now: DateTime<Utc>,
    reasons: HashMap<EntityKey, Vec<RiskReason>>,
}

impl Classifier<'_> {
    fn add(&mut self, entity_type: ContentEntityType, entity_id: Uuid, reason: RiskReason) {
        self.reasons
            .entry(EntityKey::new(entity_type, entity_id))
            .or_default()
            .push(reason);
    }

    fn chapter_is_open(&self, chapter_id: Uuid) -> bool {
        crate::chapters::is_open_at(
            self.live
                .chapters
                .iter()
                .find(|c| c.id == chapter_id)
                .and_then(|c| c.opens_at),
            self.now,
        )
    }

    /// Students can see the page now.
    fn page_is_live(&self, page_id: Uuid) -> bool {
        self.live.page(page_id).is_none_or(|page| {
            !page.hidden
                && page
                    .chapter_id
                    .is_none_or(|chapter_id| self.chapter_is_open(chapter_id))
        })
    }

    /// Removed pages and exercises with submissions. Returns the pages that lose submissions.
    fn classify_pages(&mut self) -> HashSet<Uuid> {
        let removed_pages: HashSet<Uuid> = self
            .live
            .pages
            .iter()
            .filter(|page| self.staged.page(page.id).is_none())
            .map(|page| page.id)
            .collect();
        // An exercise moved elsewhere keeps its blocks' client ids, so only blocks gone from every
        // changed page count as removed.
        let mut changed_pages: HashSet<Uuid> = removed_pages.clone();
        let mut staged_blocks: HashSet<Uuid> = HashSet::new();
        for page in self.staged.pages_changed_since(self.live) {
            changed_pages.insert(page.id);
            walk(&page.content, &mut |block, _| {
                staged_blocks.insert(block.client_id);
            });
        }
        let mut removed_with_submissions: Vec<(Uuid, Uuid)> = Vec::new();
        for page_id in &changed_pages {
            if let Some(page) = self.live.page(*page_id) {
                walk(&page.content, &mut |block, _| {
                    if !staged_blocks.contains(&block.client_id)
                        && let Some(exercise_id) = block.exercise_id()
                        && self
                            .activity
                            .exercises_with_submissions
                            .contains(&exercise_id)
                    {
                        removed_with_submissions.push((exercise_id, page.id));
                    }
                });
            }
        }
        let pages_losing_submissions: HashSet<Uuid> = removed_with_submissions
            .iter()
            .map(|(_, page)| *page)
            .collect();
        for (exercise_id, page) in removed_with_submissions {
            if removed_pages.contains(&page) || !self.page_is_live(page) {
                continue;
            }
            self.add(
                ContentEntityType::Page,
                page,
                RiskReason::ExerciseWithSubmissionsRemoved { exercise_id },
            );
        }

        for page in &self.live.pages {
            let page = page.id;
            if !removed_pages.contains(&page) || !self.page_is_live(page) {
                continue;
            }
            self.add(
                ContentEntityType::Page,
                page,
                if pages_losing_submissions.contains(&page) {
                    RiskReason::PageWithSubmissionsRemoved
                } else {
                    RiskReason::VisiblePageRemoved
                },
            );
        }
        pages_losing_submissions
    }

    /// Removed open chapters, and deadlines and openings of open chapters.
    fn classify_chapters(&mut self, pages_losing_submissions: &HashSet<Uuid>) {
        for live_chapter in &self.live.chapters {
            let chapter = live_chapter.id;
            if !self.chapter_is_open(chapter) {
                continue;
            }
            let Some(staged_chapter) = self.staged.chapters.iter().find(|c| c.id == chapter) else {
                let has_submissions = self.live.pages.iter().any(|page| {
                    page.chapter_id == Some(chapter) && pages_losing_submissions.contains(&page.id)
                });
                self.add(
                    ContentEntityType::Chapter,
                    chapter,
                    if has_submissions {
                        RiskReason::ChapterWithSubmissionsRemoved
                    } else {
                        RiskReason::OpenChapterRemoved
                    },
                );
                continue;
            };
            match (live_chapter.deadline, staged_chapter.deadline) {
                (Some(before), Some(after)) if after < before => self.add(
                    ContentEntityType::Chapter,
                    chapter,
                    RiskReason::DeadlineMovedEarlier { before, after },
                ),
                (None, Some(deadline)) => self.add(
                    ContentEntityType::Chapter,
                    chapter,
                    RiskReason::DeadlineAddedToOpenChapter { deadline },
                ),
                _ => {}
            }
            // The chapter is open now, so only an opening time still ahead closes it.
            if staged_chapter.opens_at != live_chapter.opens_at
                && let Some(opens_at) = staged_chapter.opens_at.filter(|after| *after > self.now)
            {
                self.add(
                    ContentEntityType::Chapter,
                    chapter,
                    RiskReason::OpeningMovedLater { opens_at },
                );
            }
        }
    }

    /// Own deadlines of exercises students can answer now.
    fn classify_exercise_deadlines(&mut self) {
        let staged_exercises: BTreeMap<Uuid, Uuid> =
            self.staged.exercise_page_ids().into_iter().collect();
        let live_exercise_pages = self.live.exercise_page_ids();
        for (exercise_id, page) in staged_exercises {
            let (Some(live_deadline), Some(staged_deadline)) = (
                self.live.exercise_deadlines.get(&exercise_id),
                self.staged.exercise_deadlines.get(&exercise_id),
            ) else {
                continue;
            };
            let Some(live_page) = live_exercise_pages
                .get(&exercise_id)
                .copied()
                .or_else(|| {
                    self.live
                        .exercise(exercise_id)
                        .map(|exercise| exercise.page_id)
                })
                .and_then(|id| self.live.page(id))
            else {
                continue;
            };
            let is_open = match live_deadline.chapter_id.or(live_page.chapter_id) {
                Some(chapter) => !live_page.hidden && self.chapter_is_open(chapter),
                None => self.page_is_live(live_page.id),
            };
            if live_deadline.own == staged_deadline.own || !is_open {
                continue;
            }
            match (
                self.live.effective_exercise_deadline(exercise_id),
                self.staged.effective_exercise_deadline(exercise_id),
            ) {
                (Some(before), Some(after)) if after < before => self.add(
                    ContentEntityType::Page,
                    page,
                    RiskReason::ExerciseDeadlineMovedEarlier {
                        exercise_id,
                        before,
                        after,
                    },
                ),
                (None, Some(deadline)) => self.add(
                    ContentEntityType::Page,
                    page,
                    RiskReason::ExerciseDeadlineAdded {
                        exercise_id,
                        deadline,
                    },
                ),
                _ => {}
            }
        }
    }

    /// Completion policies of modules with completions.
    fn classify_modules(&mut self) {
        for live_module in &self.live.modules {
            let module = live_module.id;
            let is_policy_changed = self
                .staged
                .modules
                .iter()
                .find(|m| m.id == module)
                .is_some_and(|staged_module| {
                    staged_module.completion_policy != live_module.completion_policy
                });
            if is_policy_changed && self.activity.modules_with_completions.contains(&module) {
                self.add(
                    ContentEntityType::Module,
                    module,
                    RiskReason::CompletionPolicyChangedAfterCompletions,
                );
            }
        }
    }

    /// The course's completion requirement and chapter locking.
    fn classify_settings(&mut self) {
        let course_id = self.live.course_id();
        if self
            .staged
            .settings
            .base_module_completion_requires_n_submodule_completions
            != self
                .live
                .settings
                .base_module_completion_requires_n_submodule_completions
            && !self.activity.modules_with_completions.is_empty()
        {
            self.add(
                ContentEntityType::CourseSettings,
                course_id,
                RiskReason::CompletionRequirementChangedAfterCompletions,
            );
        }
        if self.staged.settings.chapter_locking_enabled
            != self.live.settings.chapter_locking_enabled
        {
            self.add(
                ContentEntityType::CourseSettings,
                course_id,
                RiskReason::ChapterLockingToggled {
                    is_enabled: self.staged.settings.chapter_locking_enabled,
                },
            );
        }
    }
}

/// A changeset's risk reasons classified again.
pub(super) struct Reclassified {
    /// By staged entity; entities without reasons are left out.
    pub reasons: HashMap<EntityKey, Vec<RiskReason>>,
    /// Whether the new classification has a reason the stored one didn't.
    pub has_new_reasons: bool,
    pub has_changed_reasons: bool,
}

impl Reclassified {
    /// How many reasons the whole changeset holds.
    pub fn reason_count(&self) -> usize {
        self.reasons.values().map(Vec::len).sum()
    }
}

/// Classifies the changeset's staged state again, against its live course and student activity
/// now, and stores the reasons that changed.
pub(super) async fn reclassify(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    state: &ChangesetState<'_>,
) -> ModelResult<Reclassified> {
    let live = state.live.as_ref();
    // No rule looks at the activity of a course students can't see.
    let activity = if live.is_live() {
        load_student_activity(conn, live.course_id()).await?
    } else {
        StudentActivity::default()
    };
    let reasons = classify(live, &state.staged, &activity, Utc::now());
    let mut has_new_reasons = false;
    let mut changed = Vec::new();
    for (key, stored) in &state.stored_reasons {
        let classified = reasons.get(key).map_or(&[][..], Vec::as_slice);
        if classified != stored.as_slice() {
            has_new_reasons |= classified.iter().any(|reason| !stored.contains(reason));
            changed.push((*key, classified));
        }
    }
    agent_changeset_entities::set_risk_reasons(conn, changeset_id, &changed).await?;
    Ok(Reclassified {
        has_changed_reasons: !changed.is_empty(),
        reasons,
        has_new_reasons,
    })
}
