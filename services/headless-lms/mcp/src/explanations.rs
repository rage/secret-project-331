//! What the typed risk reasons and publish blockers of models mean, in words for agents.

use headless_lms_models::{
    agent_changeset_entities::{AgentChangesetEntityOperation, ChangesetEntitySummary, RiskReason},
    library::{agent_changesets::PublishBlocker, entity_snapshots::EntityRef},
};
use serde::Serialize;

/// A risk reason with what it means and what publishing it does to students.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ExplainedRiskReason {
    #[serde(flatten)]
    pub reason: RiskReason,
    pub message: String,
    pub consequence: &'static str,
}

impl From<RiskReason> for ExplainedRiskReason {
    fn from(reason: RiskReason) -> Self {
        let (message, consequence) = match &reason {
            RiskReason::ExerciseWithSubmissionsRemoved { exercise_id } => (
                format!("removes exercise {exercise_id}, which has submissions"),
                "students' answers and points for this exercise stop counting",
            ),
            RiskReason::PageWithSubmissionsRemoved => (
                "removes the page, which has exercises with submissions".to_string(),
                "students' answers and points on this page stop counting",
            ),
            RiskReason::ChapterWithSubmissionsRemoved => (
                "removes the chapter, which has exercises with submissions".to_string(),
                "students' answers and points in this chapter stop counting",
            ),
            RiskReason::VisiblePageRemoved => (
                "removes the page, which students can see".to_string(),
                "the page disappears for students and its address gets no redirect",
            ),
            RiskReason::OpenChapterRemoved => (
                "removes the chapter, which is open to students".to_string(),
                "the chapter and its pages disappear for students, without redirects",
            ),
            RiskReason::DeadlineMovedEarlier { before, after } => (
                format!("moves the deadline of the open chapter earlier, from {before} to {after}"),
                "students get less time; answers after the new deadline no longer count",
            ),
            RiskReason::DeadlineAddedToOpenChapter { deadline } => (
                format!("adds the deadline {deadline} to the open chapter"),
                "answers after the deadline no longer count",
            ),
            RiskReason::ExerciseDeadlineMovedEarlier {
                exercise_id,
                before,
                after,
            } => (
                format!(
                    "moves the deadline of open exercise {exercise_id} earlier, from {before} to {after}"
                ),
                "students get less time; answers after the new deadline no longer count",
            ),
            RiskReason::ExerciseDeadlineAdded {
                exercise_id,
                deadline,
            } => (
                format!("adds the deadline {deadline} to open exercise {exercise_id}"),
                "answers after the deadline no longer count",
            ),
            RiskReason::OpeningMovedLater { opens_at } => (
                format!("moves the opening time of the open chapter later, to {opens_at}"),
                "students lose access to the chapter until it opens again",
            ),
            RiskReason::CompletionPolicyChangedAfterCompletions => (
                "changes the completion policy of a module that students have already completed"
                    .to_string(),
                "who completes the module changes from now on, while existing completions stay",
            ),
            RiskReason::CompletionRequirementChangedAfterCompletions => (
                "changes how many module completions the base module requires after completions exist"
                    .to_string(),
                "students who have completed modules may gain or lose the course completion",
            ),
            RiskReason::ChapterLockingToggled { is_enabled } => (
                format!(
                    "turns chapter locking {}",
                    if *is_enabled { "on" } else { "off" }
                ),
                "students' access to later chapters changes immediately",
            ),
        };
        Self {
            reason,
            message,
            consequence,
        }
    }
}

/// A staged entity as agents read it: a [`ChangesetEntitySummary`] with its risk reasons
/// explained.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ExplainedEntity {
    #[serde(flatten)]
    pub entity: EntityRef,
    pub operation: AgentChangesetEntityOperation,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub risk_reasons: Vec<ExplainedRiskReason>,
}

impl From<ChangesetEntitySummary> for ExplainedEntity {
    fn from(summary: ChangesetEntitySummary) -> Self {
        Self {
            entity: summary.entity,
            operation: summary.operation,
            risk_reasons: summary.risk_reasons.into_iter().map(Into::into).collect(),
        }
    }
}

/// A publish blocker with what it means.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ExplainedBlocker {
    #[serde(flatten)]
    pub blocker: PublishBlocker,
    pub message: String,
}

fn named(entity: &EntityRef) -> String {
    format!("\"{}\" ({})", entity.label, entity.entity_id)
}

impl From<PublishBlocker> for ExplainedBlocker {
    fn from(blocker: PublishBlocker) -> Self {
        let message = match &blocker {
            PublishBlocker::PageInMissingChapter { page, chapter_id } => format!(
                "page {} would be in chapter {chapter_id}, which wouldn't exist",
                named(page)
            ),
            PublishBlocker::DuplicatePath { url_path, pages } => {
                format!("{} pages would have the url_path {url_path}", pages.len())
            }
            PublishBlocker::DuplicatePageOrderNumber {
                chapter,
                order_number,
                pages,
            } => format!(
                "{} pages would share the order number {order_number} {}",
                pages.len(),
                match chapter {
                    Some(chapter) => format!("in chapter {}", named(chapter)),
                    None => "among the top-level pages".to_string(),
                }
            ),
            PublishBlocker::ChapterInMissingModule { chapter, module_id } => format!(
                "chapter {} would be in module {module_id}, which wouldn't exist",
                named(chapter)
            ),
            PublishBlocker::MissingFrontPage {
                chapter,
                front_page_id,
            } => format!(
                "chapter {} would have front page {front_page_id}, which wouldn't exist",
                named(chapter)
            ),
            PublishBlocker::FrontPageInOtherChapter {
                chapter,
                front_page,
            } => format!(
                "chapter {} would have front page {}, which would be in another chapter",
                named(chapter),
                named(front_page)
            ),
            PublishBlocker::FrontPageOffPath {
                chapter,
                front_page,
                url_path,
                expected_url_path,
            } => format!(
                "chapter {} would have front page {} at {url_path} instead of {expected_url_path}",
                named(chapter),
                named(front_page)
            ),
            PublishBlocker::DuplicateChapterNumber {
                chapter_number,
                chapters,
            } => format!(
                "{} chapters would have the number {chapter_number}",
                chapters.len()
            ),
            PublishBlocker::DuplicateModuleOrderNumber {
                order_number,
                modules,
            } => format!(
                "{} modules would have the order number {order_number}",
                modules.len()
            ),
        };
        Self { blocker, message }
    }
}

/// The blockers, each explained.
pub fn explain_blockers(blockers: Vec<PublishBlocker>) -> Vec<ExplainedBlocker> {
    blockers.into_iter().map(Into::into).collect()
}
