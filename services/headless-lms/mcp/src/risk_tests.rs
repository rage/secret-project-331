//! The risk rules on the states the MCP tools stage.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Duration, Utc};
use headless_lms_models::{
    agent_changeset_entities::RiskReason,
    course_modules::{AutomaticCompletionRequirements, CompletionPolicy},
    library::{
        agent_changesets::{
            course_state::{CourseState, ExerciseDeadline, StudentActivity},
            risk::classify,
        },
        entity_snapshots::{ChapterSnapshot, ContentEntityType, EntityKey},
    },
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use pretty_assertions::assert_eq;
use serde_json::json;

use crate::engine::blocks::EXERCISE_BLOCK;
use crate::test_fixtures::{block, course, id};

fn reasons_of(
    reasons: &HashMap<EntityKey, Vec<RiskReason>>,
    entity_type: ContentEntityType,
    name: &str,
) -> Vec<RiskReason> {
    reasons
        .get(&(entity_type, id(name)))
        .cloned()
        .unwrap_or_default()
}

fn classify_now(
    live: &CourseState,
    staged: &CourseState,
    activity: &StudentActivity,
) -> HashMap<EntityKey, Vec<RiskReason>> {
    classify(live, staged, activity, Utc::now())
}

fn with_exercise_on(page: &str) -> (CourseState, StudentActivity) {
    let mut live = course();
    let exercise = block("exb", EXERCISE_BLOCK, json!({"id": id("ex")}), vec![]);
    std::sync::Arc::make_mut(&mut live.page_mut(id(page)).unwrap().content).push(exercise);
    let activity = StudentActivity {
        exercises_with_submissions: HashSet::from([id("ex")]),
        pages_with_submissions: HashSet::from([id(page)]),
        ..Default::default()
    };
    (live, activity)
}

fn take_exercise(state: &mut CourseState, page: &str) -> Vec<GutenbergBlock> {
    let content = std::sync::Arc::make_mut(&mut state.page_mut(id(page)).unwrap().content);
    let taken = content
        .iter()
        .filter(|b| b.client_id == id("exb"))
        .cloned()
        .collect();
    content.retain(|b| b.client_id != id("exb"));
    taken
}

#[test]
fn removing_visible_content_of_a_live_course_is_risky() {
    let live = course();
    let mut staged = live.clone();
    staged.pages.retain(|p| p.id != id("faq"));
    let reasons = classify_now(&live, &staged, &StudentActivity::default());
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Page, "faq"),
        vec![RiskReason::VisiblePageRemoved]
    );

    let mut draft = live.clone();
    draft.settings.is_draft = true;
    let mut draft_staged = staged.clone();
    draft_staged.settings.is_draft = true;
    assert!(classify_now(&draft, &draft_staged, &StudentActivity::default()).is_empty());
}

#[test]
fn a_removed_chapter_and_its_pages_are_each_risky() {
    let live = course();
    let mut staged = live.clone();
    staged.chapters.retain(|c| c.id != id("ch1"));
    staged.pages.retain(|p| p.chapter_id != Some(id("ch1")));
    let reasons = classify_now(&live, &staged, &StudentActivity::default());
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Chapter, "ch1"),
        vec![RiskReason::OpenChapterRemoved]
    );
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Page, "ch1-a"),
        vec![RiskReason::VisiblePageRemoved]
    );
}

#[test]
fn removing_an_exercise_with_submissions_in_live_content_is_risky() {
    let (live, activity) = with_exercise_on("ch1-a");
    let mut staged = live.clone();
    take_exercise(&mut staged, "ch1-a");
    let reasons = classify_now(&live, &staged, &activity);
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Page, "ch1-a"),
        vec![RiskReason::ExerciseWithSubmissionsRemoved {
            exercise_id: id("ex")
        }]
    );

    let mut not_live = live.clone();
    not_live.settings.is_test_mode = true;
    assert!(classify_now(&not_live, &staged, &activity).is_empty());

    let mut not_open = live.clone();
    not_open
        .chapters
        .iter_mut()
        .find(|c| c.id == id("ch1"))
        .unwrap()
        .opens_at = Some(Utc::now() + Duration::days(7));
    assert!(classify_now(&not_open, &staged, &activity).is_empty());

    let mut hidden = live.clone();
    hidden.page_mut(id("ch1-a")).unwrap().hidden = true;
    assert!(classify_now(&hidden, &staged, &activity).is_empty());
}

#[test]
fn an_exercise_moved_by_one_call_and_removed_by_another_is_risky() {
    let (live, activity) = with_exercise_on("ch1-a");
    let mut moved = live.clone();
    let exercise = take_exercise(&mut moved, "ch1-a");
    std::sync::Arc::make_mut(&mut moved.page_mut(id("ch1-b")).unwrap().content).extend(exercise);
    assert!(classify_now(&live, &moved, &activity).is_empty());

    let mut removed = moved.clone();
    take_exercise(&mut removed, "ch1-b");
    let reasons = classify_now(&live, &removed, &activity);
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Page, "ch1-a"),
        vec![RiskReason::ExerciseWithSubmissionsRemoved {
            exercise_id: id("ex")
        }]
    );
}

#[test]
fn an_exercise_moved_to_a_page_that_is_then_removed_is_risky() {
    let (mut live, activity) = with_exercise_on("ch1-a");
    live.page_mut(id("ch1-b")).unwrap().hidden = true;
    let mut staged = live.clone();
    let exercise = take_exercise(&mut staged, "ch1-a");
    std::sync::Arc::make_mut(&mut staged.page_mut(id("ch1-b")).unwrap().content).extend(exercise);
    staged.pages.retain(|p| p.id != id("ch1-b"));
    let reasons = classify_now(&live, &staged, &activity);
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Page, "ch1-a"),
        vec![RiskReason::ExerciseWithSubmissionsRemoved {
            exercise_id: id("ex")
        }]
    );
}

#[test]
fn removing_a_page_whose_exercise_moved_away_is_not_a_submission_removal() {
    let (live, activity) = with_exercise_on("ch1-a");
    let mut staged = live.clone();
    let exercise = take_exercise(&mut staged, "ch1-a");
    std::sync::Arc::make_mut(&mut staged.page_mut(id("ch1-b")).unwrap().content).extend(exercise);
    staged.pages.retain(|p| p.id != id("ch1-a"));
    let reasons = classify_now(&live, &staged, &activity);
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Page, "ch1-a"),
        vec![RiskReason::VisiblePageRemoved]
    );
}

#[test]
fn removing_pages_and_chapters_with_submissions() {
    let (mut live, activity) = with_exercise_on("ch1-a");
    live.page_mut(id("ch1-b")).unwrap().hidden = true;
    live.chapters
        .iter_mut()
        .find(|c| c.id == id("ch2"))
        .unwrap()
        .opens_at = Some(Utc::now() + Duration::days(7));
    let mut staged = live.clone();
    staged.chapters.clear();
    staged
        .pages
        .retain(|p| p.chapter_id.is_none() && p.id != id("faq"));
    let reasons = classify_now(&live, &staged, &activity);
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Page, "ch1-a"),
        vec![RiskReason::PageWithSubmissionsRemoved]
    );
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Page, "faq"),
        vec![RiskReason::VisiblePageRemoved]
    );
    assert!(reasons_of(&reasons, ContentEntityType::Page, "ch1-b").is_empty());
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Chapter, "ch1"),
        vec![RiskReason::ChapterWithSubmissionsRemoved]
    );
    assert!(reasons_of(&reasons, ContentEntityType::Chapter, "ch2").is_empty());
    assert!(reasons_of(&reasons, ContentEntityType::Page, "ch2-front").is_empty());
}

#[test]
fn chapter_dates() {
    let now = Utc::now();
    let live = course();
    let with_dates = |state: &CourseState, deadline, opens_at| {
        let mut state = state.clone();
        let chapter = state
            .chapters
            .iter_mut()
            .find(|c| c.id == id("ch1"))
            .unwrap();
        chapter.deadline = deadline;
        chapter.opens_at = opens_at;
        state
    };
    let dates = |live: &CourseState, staged: &CourseState| {
        reasons_of(
            &classify_now(live, staged, &StudentActivity::default()),
            ContentEntityType::Chapter,
            "ch1",
        )
    };
    let due_in_ten = with_dates(&live, Some(now + Duration::days(10)), None);
    assert_eq!(
        dates(
            &due_in_ten,
            &with_dates(&live, Some(now + Duration::days(5)), None)
        ),
        vec![RiskReason::DeadlineMovedEarlier {
            before: now + Duration::days(10),
            after: now + Duration::days(5)
        }]
    );
    let due_now = with_dates(&live, Some(now), None);
    assert!(
        dates(
            &due_now,
            &with_dates(&live, Some(now + Duration::days(5)), None)
        )
        .is_empty()
    );
    assert_eq!(
        dates(&live, &with_dates(&live, Some(now), None)),
        vec![RiskReason::DeadlineAddedToOpenChapter { deadline: now }]
    );
    assert!(dates(&due_now, &live).is_empty());
    assert_eq!(
        dates(
            &live,
            &with_dates(&live, None, Some(now + Duration::days(1)))
        ),
        vec![RiskReason::OpeningMovedLater {
            opens_at: now + Duration::days(1)
        }]
    );
    assert!(
        dates(
            &live,
            &with_dates(&live, None, Some(now - Duration::days(30)))
        )
        .is_empty()
    );

    let not_open = with_dates(&live, None, Some(now + Duration::days(7)));
    assert!(
        dates(
            &not_open,
            &with_dates(&live, Some(now), Some(now + Duration::days(7)))
        )
        .is_empty()
    );
}

#[test]
fn settings_rules() {
    let live = course();
    let activity = StudentActivity {
        modules_with_completions: HashSet::from([id("default")]),
        ..Default::default()
    };
    let automatic = |module: &str| {
        CompletionPolicy::Automatic(AutomaticCompletionRequirements {
            course_module_id: id(module),
            number_of_exercises_attempted_treshold: Some(1),
            number_of_points_treshold: None,
            requires_exam: false,
        })
    };
    let with_policy = |module: &str| {
        let mut state = live.clone();
        state
            .modules
            .iter_mut()
            .find(|m| m.id == id(module))
            .unwrap()
            .completion_policy = automatic(module);
        state
    };
    let reasons = classify_now(&live, &with_policy("default"), &activity);
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::Module, "default"),
        vec![RiskReason::CompletionPolicyChangedAfterCompletions]
    );
    assert!(classify_now(&live, &with_policy("extra"), &activity).is_empty());

    let mut course_changed = live.clone();
    course_changed.settings.chapter_locking_enabled = true;
    course_changed
        .settings
        .base_module_completion_requires_n_submodule_completions = 1;
    course_changed.settings.name = "Renamed".into();
    let reasons = classify_now(&live, &course_changed, &activity);
    assert_eq!(
        reasons_of(&reasons, ContentEntityType::CourseSettings, "course"),
        vec![
            RiskReason::CompletionRequirementChangedAfterCompletions,
            RiskReason::ChapterLockingToggled { is_enabled: true }
        ]
    );
}

#[test]
fn unhiding_and_bulk_edits_are_not_risky() {
    let mut live = course();
    for page in live.pages.iter_mut() {
        page.hidden = true;
    }
    let mut staged = live.clone();
    for page in staged.pages.iter_mut() {
        page.hidden = false;
        page.title = format!("{} (edited)", page.title);
    }
    assert!(classify_now(&live, &staged, &StudentActivity::default()).is_empty());
}

/// [`course`] with exercise `ex` on page ch1-a, with the own deadline `own`, and chapter ch1 with
/// `chapter_deadline`.
fn with_exercise_deadline(
    own: Option<DateTime<Utc>>,
    chapter_deadline: Option<DateTime<Utc>>,
) -> CourseState {
    let (mut live, _) = with_exercise_on("ch1-a");
    live.exercise_deadlines.insert(
        id("ex"),
        ExerciseDeadline {
            own,
            chapter_id: Some(id("ch1")),
        },
    );
    chapter_mut(&mut live, "ch1").deadline = chapter_deadline;
    live
}

fn chapter_mut<'a>(state: &'a mut CourseState, name: &str) -> &'a mut ChapterSnapshot {
    state
        .chapters
        .iter_mut()
        .find(|c| c.id == id(name))
        .unwrap()
}

fn with_own_deadline(state: &CourseState, own: Option<DateTime<Utc>>) -> CourseState {
    let mut state = state.clone();
    state.set_exercise_deadline(id("ex"), own);
    state
}

fn exercise_reasons(live: &CourseState, staged: &CourseState, page: &str) -> Vec<RiskReason> {
    reasons_of(
        &classify_now(live, staged, &StudentActivity::default()),
        ContentEntityType::Page,
        page,
    )
}

#[test]
fn exercise_deadline_changes() {
    let now = Utc::now();
    let in_days = |days| Some(now + Duration::days(days));
    let earlier = |before: Option<DateTime<Utc>>, after: Option<DateTime<Utc>>| {
        vec![RiskReason::ExerciseDeadlineMovedEarlier {
            exercise_id: id("ex"),
            before: before.unwrap(),
            after: after.unwrap(),
        }]
    };

    let own = with_exercise_deadline(in_days(10), in_days(20));
    assert_eq!(
        exercise_reasons(&own, &with_own_deadline(&own, in_days(5)), "ch1-a"),
        earlier(in_days(10), in_days(5))
    );
    assert!(exercise_reasons(&own, &with_own_deadline(&own, in_days(15)), "ch1-a").is_empty());
    // Clearing lets the later chapter deadline apply.
    assert!(exercise_reasons(&own, &with_own_deadline(&own, None), "ch1-a").is_empty());
    let chapter_earlier = with_exercise_deadline(in_days(10), in_days(3));
    assert_eq!(
        exercise_reasons(
            &chapter_earlier,
            &with_own_deadline(&chapter_earlier, None),
            "ch1-a"
        ),
        earlier(in_days(10), in_days(3))
    );

    let none = with_exercise_deadline(None, None);
    assert_eq!(
        exercise_reasons(&none, &with_own_deadline(&none, in_days(5)), "ch1-a"),
        vec![RiskReason::ExerciseDeadlineAdded {
            exercise_id: id("ex"),
            deadline: in_days(5).unwrap(),
        }]
    );
    // An own deadline later than the chapter's moves nothing earlier.
    let chapter_only = with_exercise_deadline(None, in_days(10));
    assert!(
        exercise_reasons(
            &chapter_only,
            &with_own_deadline(&chapter_only, in_days(15)),
            "ch1-a"
        )
        .is_empty()
    );

    let mut draft = own.clone();
    draft.settings.is_draft = true;
    assert!(exercise_reasons(&draft, &with_own_deadline(&draft, in_days(5)), "ch1-a").is_empty());
    let mut hidden = own.clone();
    hidden.page_mut(id("ch1-a")).unwrap().hidden = true;
    assert!(exercise_reasons(&hidden, &with_own_deadline(&hidden, in_days(5)), "ch1-a").is_empty());
    let mut unopened = own.clone();
    chapter_mut(&mut unopened, "ch1").opens_at = in_days(1);
    assert!(
        exercise_reasons(
            &unopened,
            &with_own_deadline(&unopened, in_days(5)),
            "ch1-a"
        )
        .is_empty()
    );
}

#[test]
fn exercise_deadlines_ignore_moves_and_chapter_changes() {
    let now = Utc::now();
    let in_days = |days| Some(now + Duration::days(days));
    let mut live = with_exercise_deadline(None, in_days(10));
    chapter_mut(&mut live, "ch2").deadline = in_days(1);

    let mut chapter_earlier = live.clone();
    chapter_mut(&mut chapter_earlier, "ch1").deadline = in_days(5);
    assert!(exercise_reasons(&live, &chapter_earlier, "ch1-a").is_empty());

    let mut moved = live.clone();
    let exercise = take_exercise(&mut moved, "ch1-a");
    std::sync::Arc::make_mut(&mut moved.page_mut(id("ch2-front")).unwrap().content)
        .extend(exercise);
    moved
        .exercise_deadlines
        .get_mut(&id("ex"))
        .unwrap()
        .chapter_id = Some(id("ch2"));
    assert!(classify_now(&live, &moved, &StudentActivity::default()).is_empty());

    assert_eq!(
        exercise_reasons(&live, &with_own_deadline(&moved, in_days(3)), "ch2-front"),
        vec![RiskReason::ExerciseDeadlineMovedEarlier {
            exercise_id: id("ex"),
            before: in_days(10).unwrap(),
            after: in_days(3).unwrap(),
        }]
    );
}

#[test]
fn exercise_deadline_risk_follows_the_exercises_own_chapter() {
    let now = Utc::now();
    let in_days = |days| Some(now + Duration::days(days));
    // The exercise's chapter (ch2) differs from its page's (ch1), as after a page move.
    let mut live = with_exercise_deadline(in_days(30), in_days(5));
    live.exercise_deadlines
        .get_mut(&id("ex"))
        .unwrap()
        .chapter_id = Some(id("ch2"));
    chapter_mut(&mut live, "ch2").deadline = in_days(40);

    let mut cleared = with_own_deadline(&live, None);
    assert!(exercise_reasons(&live, &cleared, "ch1-a").is_empty());
    // Publishing the page moves the exercise into the page's chapter.
    cleared
        .exercise_deadlines
        .get_mut(&id("ex"))
        .unwrap()
        .chapter_id = Some(id("ch1"));
    assert_eq!(
        exercise_reasons(&live, &cleared, "ch1-a"),
        vec![RiskReason::ExerciseDeadlineMovedEarlier {
            exercise_id: id("ex"),
            before: in_days(30).unwrap(),
            after: in_days(5).unwrap(),
        }]
    );

    let mut unopened = live.clone();
    chapter_mut(&mut unopened, "ch2").opens_at = in_days(1);
    assert!(
        exercise_reasons(
            &unopened,
            &with_own_deadline(&unopened, in_days(1)),
            "ch1-a"
        )
        .is_empty()
    );
}
