//! Risk rules: which staged changes only the teacher may publish, on the review page.
//!
//! Only live content is risky. Draft and test-mode courses, hidden pages and chapters that haven't
//! opened yet are free. Size alone never makes a change risky, and moving exercises never does.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::diff::{ChangeKind, Diff, EntityChange, EntityType};

/// Published-state facts the rules need, loaded by the caller.
#[derive(Debug, Clone, Default)]
pub struct RiskFacts {
    pub course_is_draft: bool,
    pub course_is_test_mode: bool,
    pub now: DateTime<Utc>,
    /// Pages currently hidden from students.
    pub hidden_pages: HashSet<Uuid>,
    /// Chapter of every chapter page, as published.
    pub page_chapters: HashMap<Uuid, Uuid>,
    /// Opening times of chapters, as published; a chapter without one is open.
    pub chapter_opens_at: HashMap<Uuid, Option<DateTime<Utc>>>,
    pub exercises_with_submissions: HashSet<Uuid>,
    /// Pages holding an exercise that has submissions.
    pub pages_with_submissions: HashSet<Uuid>,
    /// Modules that have at least one completion.
    pub modules_with_completions: HashSet<Uuid>,
}

impl RiskFacts {
    fn is_live_course(&self) -> bool {
        !self.course_is_draft && !self.course_is_test_mode
    }

    fn chapter_is_open(&self, chapter: Uuid) -> bool {
        match self.chapter_opens_at.get(&chapter) {
            Some(Some(opens_at)) => *opens_at <= self.now,
            _ => true,
        }
    }

    /// Students can see the page now.
    fn page_is_live(&self, page: Uuid) -> bool {
        !self.hidden_pages.contains(&page)
            && self
                .page_chapters
                .get(&page)
                .is_none_or(|c| self.chapter_is_open(*c))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskCode {
    ExerciseWithSubmissionsRemoved,
    PageWithSubmissionsRemoved,
    ChapterWithSubmissionsRemoved,
    VisiblePageRemoved,
    OpenChapterRemoved,
    DeadlineMovedEarlier,
    DeadlineAddedToOpenChapter,
    OpeningMovedLater,
    CompletionPolicyChangedAfterCompletions,
    CompletionRequirementChangedAfterCompletions,
    ChapterLockingToggled,
}

/// Why a change needs the teacher's confirmation. Stored with the staged entity.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RiskReason {
    pub code: RiskCode,
    pub message: String,
    pub consequence: String,
    pub entity_type: EntityType,
    pub entity_id: Uuid,
}

pub fn classify(diff: &Diff, facts: &RiskFacts) -> Vec<RiskReason> {
    if !facts.is_live_course() {
        return Vec::new();
    }
    let mut reasons = Vec::new();
    let mut reason = |code, entity_type, entity_id, message: String, consequence: &str| {
        reasons.push(RiskReason {
            code,
            message,
            consequence: consequence.to_string(),
            entity_type,
            entity_id,
        });
    };

    let removed_pages: HashSet<Uuid> = diff
        .entities
        .iter()
        .filter(|e| e.entity_type == EntityType::Page && e.kind == ChangeKind::Removed)
        .map(|e| e.entity_id)
        .collect();
    for block in &diff.blocks {
        let (Some(exercise_id), ChangeKind::Removed, Some(page)) =
            (block.exercise_id, block.kind, block.page_before)
        else {
            continue;
        };
        if removed_pages.contains(&page)
            || !facts.exercises_with_submissions.contains(&exercise_id)
            || !facts.page_is_live(page)
        {
            continue;
        }
        reason(
            RiskCode::ExerciseWithSubmissionsRemoved,
            EntityType::Page,
            page,
            format!("removes exercise {exercise_id}, which has submissions"),
            "students' answers and points for this exercise stop counting",
        );
    }

    for change in &diff.entities {
        match (change.entity_type, change.kind) {
            (EntityType::Page, ChangeKind::Removed) => {
                let page = change.entity_id;
                if facts.pages_with_submissions.contains(&page) && facts.page_is_live(page) {
                    reason(
                        RiskCode::PageWithSubmissionsRemoved,
                        EntityType::Page,
                        page,
                        format!("removes page {page}, which has exercises with submissions"),
                        "students' answers and points on this page stop counting",
                    );
                } else if facts.page_is_live(page) {
                    reason(
                        RiskCode::VisiblePageRemoved,
                        EntityType::Page,
                        page,
                        format!("removes page {page}, which students can see"),
                        "the page disappears for students and its address gets no redirect",
                    );
                }
            }
            (EntityType::Chapter, ChangeKind::Removed) => {
                let chapter = change.entity_id;
                if !facts.chapter_is_open(chapter) {
                    continue;
                }
                let has_submissions = facts
                    .page_chapters
                    .iter()
                    .any(|(page, c)| *c == chapter && facts.pages_with_submissions.contains(page));
                if has_submissions {
                    reason(
                        RiskCode::ChapterWithSubmissionsRemoved,
                        EntityType::Chapter,
                        chapter,
                        format!("removes chapter {chapter}, which has exercises with submissions"),
                        "students' answers and points in this chapter stop counting",
                    );
                } else {
                    reason(
                        RiskCode::OpenChapterRemoved,
                        EntityType::Chapter,
                        chapter,
                        format!("removes chapter {chapter}, which is open to students"),
                        "the chapter and its pages disappear for students, without redirects",
                    );
                }
            }
            (EntityType::Chapter, ChangeKind::Changed) => chapter_dates(change, facts, &mut reason),
            (EntityType::ModuleSettings, ChangeKind::Changed) => {
                if field(change, "completion_policy").is_some()
                    && facts.modules_with_completions.contains(&change.entity_id)
                {
                    reason(RiskCode::CompletionPolicyChangedAfterCompletions, EntityType::ModuleSettings, change.entity_id, "changes the completion policy of a module that students have already completed".into(), "who completes the module changes from now on, while existing completions stay");
                }
            }
            (EntityType::Course, ChangeKind::Changed) => {
                if field(
                    change,
                    "base_module_completion_requires_n_submodule_completions",
                )
                .is_some()
                    && !facts.modules_with_completions.is_empty()
                {
                    reason(RiskCode::CompletionRequirementChangedAfterCompletions, EntityType::Course, change.entity_id, "changes how many module completions the base module requires after completions exist".into(), "students who have completed modules may gain or lose the course completion");
                }
                if field(change, "chapter_locking_enabled").is_some() {
                    reason(
                        RiskCode::ChapterLockingToggled,
                        EntityType::Course,
                        change.entity_id,
                        "turns chapter locking on or off".into(),
                        "students' access to later chapters changes immediately",
                    );
                }
            }
            _ => {}
        }
    }
    reasons
}

fn field<'a>(change: &'a EntityChange, name: &str) -> Option<&'a crate::diff::FieldChange> {
    change.fields.iter().find(|f| f.field == name)
}

fn date(value: &Value) -> Option<DateTime<Utc>> {
    value
        .as_str()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
}

fn chapter_dates(
    change: &EntityChange,
    facts: &RiskFacts,
    reason: &mut impl FnMut(RiskCode, EntityType, Uuid, String, &str),
) {
    let chapter = change.entity_id;
    if !facts.chapter_is_open(chapter) {
        return;
    }
    if let Some(deadline) = field(change, "deadline") {
        match (date(&deadline.before), date(&deadline.after)) {
            (Some(before), Some(after)) if after < before => reason(
                RiskCode::DeadlineMovedEarlier,
                EntityType::Chapter,
                chapter,
                format!(
                    "moves the deadline of open chapter {chapter} earlier, from {before} to {after}"
                ),
                "students get less time; answers after the new deadline no longer count",
            ),
            (None, Some(after)) => reason(
                RiskCode::DeadlineAddedToOpenChapter,
                EntityType::Chapter,
                chapter,
                format!("adds the deadline {after} to open chapter {chapter}"),
                "answers after the deadline no longer count",
            ),
            _ => {}
        }
    }
    if let Some(opens_at) = field(change, "opens_at") {
        let later = match (date(&opens_at.before), date(&opens_at.after)) {
            (_, None) => false,
            (None, Some(_)) => true,
            (Some(before), Some(after)) => after > before,
        };
        if later {
            reason(
                RiskCode::OpeningMovedLater,
                EntityType::Chapter,
                chapter,
                format!("moves the opening time of open chapter {chapter} later"),
                "students lose access to the chapter until it opens again",
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::*;
    use crate::diff::{BlockChange, FieldChange};
    use crate::test_fixtures::id;

    fn facts() -> RiskFacts {
        RiskFacts {
            now: Utc::now(),
            page_chapters: HashMap::from([
                (id("pg1"), id("ch1")),
                (id("pg2"), id("ch2")),
                (id("hidden"), id("ch1")),
            ]),
            chapter_opens_at: HashMap::from([
                (id("ch1"), None),
                (id("ch2"), Some(Utc::now() + Duration::days(7))),
            ]),
            hidden_pages: HashSet::from([id("hidden")]),
            exercises_with_submissions: HashSet::from([id("e1")]),
            pages_with_submissions: HashSet::from([id("pg1")]),
            modules_with_completions: HashSet::from([id("m1")]),
            ..Default::default()
        }
    }

    fn removed_exercise(page: &str) -> BlockChange {
        BlockChange {
            block_id: id("ex1"),
            name: "moocfi/exercise".into(),
            kind: ChangeKind::Removed,
            page_before: Some(id(page)),
            page_after: None,
            exercise_id: Some(id("e1")),
            changed_fields: vec![],
            is_moved: false,
        }
    }

    fn entity(
        entity_type: EntityType,
        name: &str,
        kind: ChangeKind,
        fields: Vec<FieldChange>,
    ) -> EntityChange {
        EntityChange {
            entity_type,
            entity_id: id(name),
            kind,
            fields,
            parent_before: None,
            parent_after: None,
            is_moved: false,
        }
    }

    fn codes(diff: &Diff, facts: &RiskFacts) -> Vec<RiskCode> {
        classify(diff, facts).into_iter().map(|r| r.code).collect()
    }

    #[test]
    fn removing_exercise_with_submissions_in_live_content() {
        let diff = Diff {
            blocks: vec![removed_exercise("pg1")],
            entities: vec![],
        };
        assert_eq!(
            codes(&diff, &facts()),
            vec![RiskCode::ExerciseWithSubmissionsRemoved]
        );
        let mut draft = facts();
        draft.course_is_draft = true;
        assert!(codes(&diff, &draft).is_empty());
        let mut test_mode = facts();
        test_mode.course_is_test_mode = true;
        assert!(codes(&diff, &test_mode).is_empty());
        let not_open = Diff {
            blocks: vec![removed_exercise("pg2")],
            entities: vec![],
        };
        assert!(codes(&not_open, &facts()).is_empty());
        let hidden = Diff {
            blocks: vec![removed_exercise("hidden")],
            entities: vec![],
        };
        assert!(codes(&hidden, &facts()).is_empty());
    }

    #[test]
    fn moving_exercises_is_never_risky() {
        let mut moved = removed_exercise("pg1");
        moved.kind = ChangeKind::Moved;
        moved.page_after = Some(id("pg2"));
        let diff = Diff {
            blocks: vec![moved],
            entities: vec![entity(EntityType::Page, "pg1", ChangeKind::Moved, vec![])],
        };
        assert!(codes(&diff, &facts()).is_empty());
    }

    #[test]
    fn removing_pages_and_chapters() {
        let diff = Diff {
            blocks: vec![removed_exercise("pg1")],
            entities: vec![
                entity(EntityType::Page, "pg1", ChangeKind::Removed, vec![]),
                entity(EntityType::Page, "pgx", ChangeKind::Removed, vec![]),
                entity(EntityType::Page, "hidden", ChangeKind::Removed, vec![]),
                entity(EntityType::Chapter, "ch1", ChangeKind::Removed, vec![]),
                entity(EntityType::Chapter, "ch2", ChangeKind::Removed, vec![]),
            ],
        };
        assert_eq!(
            codes(&diff, &facts()),
            vec![
                RiskCode::PageWithSubmissionsRemoved,
                RiskCode::VisiblePageRemoved,
                RiskCode::ChapterWithSubmissionsRemoved
            ]
        );
    }

    #[test]
    fn chapter_dates() {
        let now = Utc::now();
        let date = |d: DateTime<Utc>| json!(d.to_rfc3339());
        let change = |fields| Diff {
            blocks: vec![],
            entities: vec![entity(
                EntityType::Chapter,
                "ch1",
                ChangeKind::Changed,
                fields,
            )],
        };
        let earlier = change(vec![FieldChange {
            field: "deadline".into(),
            before: date(now + Duration::days(10)),
            after: date(now + Duration::days(5)),
        }]);
        assert_eq!(
            codes(&earlier, &facts()),
            vec![RiskCode::DeadlineMovedEarlier]
        );
        let later = change(vec![FieldChange {
            field: "deadline".into(),
            before: date(now),
            after: date(now + Duration::days(5)),
        }]);
        assert!(codes(&later, &facts()).is_empty());
        let added = change(vec![FieldChange {
            field: "deadline".into(),
            before: Value::Null,
            after: date(now),
        }]);
        assert_eq!(
            codes(&added, &facts()),
            vec![RiskCode::DeadlineAddedToOpenChapter]
        );
        let removed = change(vec![FieldChange {
            field: "deadline".into(),
            before: date(now),
            after: Value::Null,
        }]);
        assert!(codes(&removed, &facts()).is_empty());
        let opening = change(vec![FieldChange {
            field: "opens_at".into(),
            before: Value::Null,
            after: date(now + Duration::days(1)),
        }]);
        assert_eq!(codes(&opening, &facts()), vec![RiskCode::OpeningMovedLater]);
        let not_open = Diff {
            blocks: vec![],
            entities: vec![entity(
                EntityType::Chapter,
                "ch2",
                ChangeKind::Changed,
                vec![FieldChange {
                    field: "deadline".into(),
                    before: Value::Null,
                    after: date(now),
                }],
            )],
        };
        assert!(codes(&not_open, &facts()).is_empty());
    }

    #[test]
    fn settings_rules() {
        let policy = Diff {
            blocks: vec![],
            entities: vec![entity(
                EntityType::ModuleSettings,
                "m1",
                ChangeKind::Changed,
                vec![FieldChange {
                    field: "completion_policy".into(),
                    before: json!({}),
                    after: json!({}),
                }],
            )],
        };
        assert_eq!(
            codes(&policy, &facts()),
            vec![RiskCode::CompletionPolicyChangedAfterCompletions]
        );
        let other_module = Diff {
            blocks: vec![],
            entities: vec![entity(
                EntityType::ModuleSettings,
                "m2",
                ChangeKind::Changed,
                vec![FieldChange {
                    field: "completion_policy".into(),
                    before: json!({}),
                    after: json!({}),
                }],
            )],
        };
        assert!(codes(&other_module, &facts()).is_empty());
        let course = Diff {
            blocks: vec![],
            entities: vec![entity(
                EntityType::Course,
                "c1",
                ChangeKind::Changed,
                vec![
                    FieldChange {
                        field: "chapter_locking_enabled".into(),
                        before: json!(false),
                        after: json!(true),
                    },
                    FieldChange {
                        field: "base_module_completion_requires_n_submodule_completions".into(),
                        before: json!(0),
                        after: json!(1),
                    },
                    FieldChange {
                        field: "name".into(),
                        before: json!("a"),
                        after: json!("b"),
                    },
                ],
            )],
        };
        assert_eq!(
            codes(&course, &facts()),
            vec![
                RiskCode::CompletionRequirementChangedAfterCompletions,
                RiskCode::ChapterLockingToggled
            ]
        );
    }

    #[test]
    fn unhiding_and_bulk_edits_are_not_risky() {
        let entities = (0..200)
            .map(|n| {
                entity(
                    EntityType::Page,
                    &format!("p{n}"),
                    ChangeKind::Changed,
                    vec![FieldChange {
                        field: "hidden".into(),
                        before: json!(true),
                        after: json!(false),
                    }],
                )
            })
            .collect();
        assert!(
            codes(
                &Diff {
                    blocks: vec![],
                    entities
                },
                &facts()
            )
            .is_empty()
        );
    }
}
