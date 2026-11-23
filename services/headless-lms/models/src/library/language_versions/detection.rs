//! Detects what is wrong with the links between a course's language versions.

use std::collections::{HashMap, HashSet};

use super::{
    counterpart_index::{CounterpartIndex, fingerprint, is_live_exercise, is_live_page},
    join_candidates::is_likely_language_version,
    snapshot::{LanguageGroupSnapshot, SnapshotPage},
    suggestions::{CopyLineage, match_exercises, match_pages},
    types::{
        JoinCandidate, LanguageVersionExercise, LanguageVersionPage, LanguageVersionProblem,
        LanguageVersionProblemKind, LanguageVersionProblemSeverity, LeftoverExerciseLink,
        LeftoverPageLink, LinkedPagePair, MissingChapterNumbers, ProblemDismissal,
        SuggestionReason,
    },
};
use crate::prelude::*;

use LanguageVersionProblemSeverity::{AffectsStudents, CheckIntended, ShouldFix};

/// Every problem of the group, most urgent first, with `dismissal` set on problems the teacher
/// marked as intended in their current state. `join_candidates` are the courses the user may
/// see (from [super::join_candidates::get_join_candidates], filtered by edit rights); only likely
/// translations among them are reported.
pub fn detect_problems(
    snapshot: &LanguageGroupSnapshot,
    lineage: &CopyLineage,
    dismissals: &[ProblemDismissal],
    join_candidates: &[JoinCandidate],
) -> Vec<LanguageVersionProblem> {
    let index = CounterpartIndex::new(snapshot);
    let mut problems = Vec::new();
    missing_page_counterparts(&index, &mut problems);
    duplicate_pages(&index, lineage, &mut problems);
    foreign_course_links(&index, &mut problems);
    exercise_counterparts_on_other_pages(&index, &mut problems);
    unlinked_exercises(&index, lineage, &mut problems);
    leftover_links(&index, &mut problems);
    duplicate_exercises(&index, &mut problems);
    likely_separate_language_versions(join_candidates, &mut problems);
    page_order_differs(&index, &mut problems);
    chapter_count_differs(&index, &mut problems);
    pages_in_other_chapter_numbers(&index, &mut problems);
    missing_exercise_counterparts(&index, &mut problems);

    let severity_rank = |s: LanguageVersionProblemSeverity| match s {
        AffectsStudents => 0,
        ShouldFix => 1,
        CheckIntended => 2,
    };
    problems.sort_by_key(|p| severity_rank(p.severity));
    let dismissals_by_key: HashMap<&str, &ProblemDismissal> = dismissals
        .iter()
        .map(|d| (d.problem_key.as_str(), d))
        .collect();
    for problem in &mut problems {
        problem.dismissal = dismissals_by_key
            .get(problem.key.as_str())
            .filter(|d| d.fingerprint == problem.fingerprint)
            .map(|d| (*d).clone());
    }
    problems
}

fn problem(
    key: String,
    fingerprint: String,
    severity: LanguageVersionProblemSeverity,
    kind: LanguageVersionProblemKind,
) -> LanguageVersionProblem {
    LanguageVersionProblem {
        key,
        fingerprint,
        severity,
        kind,
        dismissal: None,
    }
}

fn page_ids(pages: &[LanguageVersionPage]) -> impl Iterator<Item = String> + '_ {
    pages.iter().map(|p| p.id.to_string())
}

fn exercise_ids(exercises: &[LanguageVersionExercise]) -> impl Iterator<Item = String> + '_ {
    exercises.iter().map(|e| e.id.to_string())
}

/// Ordered pairs of different courses.
fn course_pairs(index: &CounterpartIndex<'_>) -> Vec<(Uuid, Uuid)> {
    let ids = index.course_ids();
    ids.iter()
        .flat_map(|a| ids.iter().filter(move |b| *b != a).map(move |b| (*a, *b)))
        .collect()
}

fn missing_page_counterparts(
    index: &CounterpartIndex<'_>,
    problems: &mut Vec<LanguageVersionProblem>,
) {
    for (course_id, counterpart_course_id) in course_pairs(index) {
        let pages: Vec<LanguageVersionPage> = index
            .live_pages(course_id)
            .filter(|p| {
                index
                    .page_counterpart_in(&p.page, counterpart_course_id)
                    .is_none()
            })
            .map(|p| p.page.clone())
            .collect();
        if pages.is_empty() {
            continue;
        }
        problems.push(problem(
            format!("missing_page_counterpart:{course_id}:{counterpart_course_id}"),
            fingerprint(page_ids(&pages)),
            AffectsStudents,
            LanguageVersionProblemKind::MissingPageCounterpart {
                course_id,
                counterpart_course_id,
                pages,
            },
        ));
    }
}

fn duplicate_pages(
    index: &CounterpartIndex<'_>,
    lineage: &CopyLineage,
    problems: &mut Vec<LanguageVersionProblem>,
) {
    for course_id in index.course_ids() {
        let mut seen_groups = HashSet::new();
        for page in index.live_pages(course_id) {
            let Some(group_id) = page.page.page_language_group_id else {
                continue;
            };
            if !seen_groups.insert(group_id) {
                continue;
            }
            let members = index.page_group_members(&page.page);
            let pages: Vec<&SnapshotPage> = members
                .iter()
                .copied()
                .filter(|p| p.page.course_id == course_id && is_live_page(p))
                .collect();
            if pages.len() < 2 {
                continue;
            }
            let linked_pages: Vec<LanguageVersionPage> = index
                .page_counterparts(&page.page)
                .map(|p| p.page.clone())
                .collect();
            let (suggested_page_id, suggestion_reason) =
                pick_duplicate_to_keep(&pages, &linked_pages, lineage);
            let pages: Vec<LanguageVersionPage> = pages.iter().map(|p| p.page.clone()).collect();
            problems.push(problem(
                format!("duplicate_pages_in_group:{course_id}:{group_id}"),
                fingerprint(page_ids(&pages).chain(page_ids(&linked_pages))),
                AffectsStudents,
                LanguageVersionProblemKind::DuplicatePagesInGroup {
                    course_id,
                    pages,
                    linked_pages,
                    suggested_page_id,
                    suggestion_reason,
                },
            ));
        }
    }
}

/// The duplicate that matches the linked pages best, if exactly one does.
fn pick_duplicate_to_keep(
    pages: &[&SnapshotPage],
    linked_pages: &[LanguageVersionPage],
    lineage: &CopyLineage,
) -> (Option<Uuid>, Option<SuggestionReason>) {
    let score = |page: &SnapshotPage| {
        if linked_pages
            .iter()
            .any(|l| lineage.are_related(page.page.id, l.id))
        {
            return Some((0, SuggestionReason::CopyHistory));
        }
        let same_position = |l: &&LanguageVersionPage| {
            l.chapter_number == page.page.chapter_number && l.position == page.page.position
        };
        if linked_pages
            .iter()
            .filter(same_position)
            .any(|l| l.exercise_count == page.page.exercise_count)
        {
            return Some((1, SuggestionReason::SamePositionAndExerciseCount));
        }
        if linked_pages.iter().any(|l| same_position(&l)) {
            return Some((2, SuggestionReason::SamePosition));
        }
        None
    };
    let scored: Vec<(Uuid, (i32, SuggestionReason))> = pages
        .iter()
        .filter_map(|p| score(p).map(|s| (p.page.id, s)))
        .collect();
    let Some(best) = scored.iter().map(|(_, (rank, _))| *rank).min() else {
        return (None, None);
    };
    let mut best_pages = scored.iter().filter(|(_, (rank, _))| *rank == best);
    match (best_pages.next(), best_pages.next()) {
        (Some((id, (_, reason))), None) => (Some(*id), Some(*reason)),
        _ => (None, None),
    }
}

fn foreign_course_links(index: &CounterpartIndex<'_>, problems: &mut Vec<LanguageVersionProblem>) {
    let mut seen_foreign = HashSet::new();
    for course_id in index.course_ids() {
        for page in index.live_pages(course_id) {
            for foreign in index
                .page_group_members(&page.page)
                .iter()
                .filter(|p| p.is_foreign && !p.page.is_deleted)
            {
                if !seen_foreign.insert(foreign.page.id) {
                    continue;
                }
                let foreign_course_name = index
                    .snapshot
                    .foreign_courses
                    .iter()
                    .find(|c| c.id == foreign.page.course_id)
                    .map(|c| c.name.clone())
                    .unwrap_or_default();
                let linked_pages: Vec<LanguageVersionPage> = index
                    .page_counterparts(&page.page)
                    .map(|p| p.page.clone())
                    .collect();
                problems.push(problem(
                    format!("foreign_course_link:{}", foreign.page.id),
                    fingerprint(
                        [page.page.id.to_string(), foreign.page.id.to_string()]
                            .into_iter()
                            .chain(page_ids(&linked_pages)),
                    ),
                    ShouldFix,
                    LanguageVersionProblemKind::ForeignCourseLink {
                        page: page.page.clone(),
                        foreign_page: foreign.page.clone(),
                        foreign_course_name,
                        linked_pages,
                    },
                ));
            }
        }
    }
}

/// Reported once per exercise pair. Pairs whose pages aren't linked at all are left to
/// [missing_page_counterparts].
fn exercise_counterparts_on_other_pages(
    index: &CounterpartIndex<'_>,
    problems: &mut Vec<LanguageVersionProblem>,
) {
    let mut seen_pairs = HashSet::new();
    for course_id in index.course_ids() {
        for exercise in index.live_exercises(course_id) {
            let Some(page) = index.page(exercise.exercise.page_id) else {
                continue;
            };
            for counterpart in index.exercise_counterparts(&exercise.exercise) {
                let pair = if exercise.exercise.id < counterpart.exercise.id {
                    (exercise.exercise.id, counterpart.exercise.id)
                } else {
                    (counterpart.exercise.id, exercise.exercise.id)
                };
                if seen_pairs.contains(&pair) {
                    continue;
                }
                let expected_page =
                    index.page_counterpart_in(&page.page, counterpart.exercise.course_id);
                if expected_page.is_some_and(|p| p.page.id == counterpart.exercise.page_id) {
                    continue;
                }
                let counterpart_page_is_linked_here = index
                    .page(counterpart.exercise.page_id)
                    .is_some_and(|p| index.page_counterpart_in(&p.page, course_id).is_some());
                if expected_page.is_none() && !counterpart_page_is_linked_here {
                    continue;
                }
                seen_pairs.insert(pair);
                problems.push(problem(
                    format!("exercise_counterpart_on_other_page:{}:{}", pair.0, pair.1),
                    fingerprint(
                        [
                            exercise.exercise.id,
                            exercise.exercise.page_id,
                            counterpart.exercise.id,
                            counterpart.exercise.page_id,
                        ]
                        .iter()
                        .map(Uuid::to_string)
                        .chain(expected_page.map(|p| p.page.id.to_string())),
                    ),
                    ShouldFix,
                    LanguageVersionProblemKind::ExerciseCounterpartOnOtherPage {
                        exercise: exercise.exercise.clone(),
                        counterpart: counterpart.exercise.clone(),
                        expected_page: expected_page.map(|p| p.page.clone()),
                    },
                ));
            }
        }
    }
}

fn unlinked_exercises(
    index: &CounterpartIndex<'_>,
    lineage: &CopyLineage,
    problems: &mut Vec<LanguageVersionProblem>,
) {
    let course_ids = index.course_ids();
    if course_ids.len() < 2 {
        return;
    }
    for course_id in &course_ids {
        let unlinked: Vec<&LanguageVersionExercise> = index
            .live_exercises(*course_id)
            .filter(|e| index.exercise_counterparts(&e.exercise).next().is_none())
            .map(|e| &e.exercise)
            .collect();
        if unlinked.is_empty() {
            continue;
        }
        let mut suggested: HashSet<Uuid> = HashSet::new();
        for other in course_ids.iter().filter(|id| *id != course_id) {
            let page_matches = match_pages(index, lineage, *course_id, *other);
            let exercise_matches =
                match_exercises(index, lineage, *course_id, *other, &page_matches);
            suggested.extend(
                exercise_matches
                    .iter()
                    .filter(|(_, m)| !m.is_linked)
                    .map(|(id, _)| *id),
            );
        }
        let suggestion_count = unlinked
            .iter()
            .filter(|e| suggested.contains(&e.id))
            .count();
        problems.push(problem(
            format!("unlinked_exercises:{course_id}"),
            fingerprint(unlinked.iter().map(|e| e.id.to_string())),
            ShouldFix,
            LanguageVersionProblemKind::UnlinkedExercises {
                course_id: *course_id,
                exercise_count: unlinked.len() as i64,
                suggestion_count: suggestion_count as i64,
            },
        ));
    }
}

fn leftover_links(index: &CounterpartIndex<'_>, problems: &mut Vec<LanguageVersionProblem>) {
    let mut pages = Vec::new();
    let mut exercises = Vec::new();
    for course_id in index.course_ids() {
        for page in index.live_pages(course_id) {
            for deleted in index
                .page_group_members(&page.page)
                .iter()
                .filter(|p| p.page.is_deleted)
            {
                pages.push(LeftoverPageLink {
                    page: page.page.clone(),
                    deleted_page: deleted.page.clone(),
                });
            }
        }
        for exercise in index.live_exercises(course_id) {
            for deleted in index
                .exercise_group_members(&exercise.exercise)
                .iter()
                .filter(|e| e.exercise.is_deleted)
            {
                exercises.push(LeftoverExerciseLink {
                    exercise: exercise.exercise.clone(),
                    deleted_exercise: deleted.exercise.clone(),
                });
            }
        }
    }
    if pages.is_empty() && exercises.is_empty() {
        return;
    }
    let parts: Vec<String> = pages
        .iter()
        .flat_map(|l| [l.page.id, l.deleted_page.id])
        .chain(
            exercises
                .iter()
                .flat_map(|l| [l.exercise.id, l.deleted_exercise.id]),
        )
        .map(|id| id.to_string())
        .collect();
    problems.push(problem(
        "leftover_links".to_string(),
        fingerprint(parts),
        ShouldFix,
        LanguageVersionProblemKind::LeftoverLinks { pages, exercises },
    ));
}

fn duplicate_exercises(index: &CounterpartIndex<'_>, problems: &mut Vec<LanguageVersionProblem>) {
    for course_id in index.course_ids() {
        let mut seen_groups = HashSet::new();
        for exercise in index.live_exercises(course_id) {
            let Some(group_id) = exercise.exercise.exercise_language_group_id else {
                continue;
            };
            if !seen_groups.insert(group_id) {
                continue;
            }
            let exercises: Vec<LanguageVersionExercise> = index
                .exercise_group_members(&exercise.exercise)
                .iter()
                .filter(|e| e.exercise.course_id == course_id && is_live_exercise(e))
                .map(|e| e.exercise.clone())
                .collect();
            if exercises.len() < 2 {
                continue;
            }
            let linked_exercises: Vec<LanguageVersionExercise> = index
                .exercise_counterparts(&exercise.exercise)
                .map(|e| e.exercise.clone())
                .collect();
            problems.push(problem(
                format!("duplicate_exercises_in_group:{course_id}:{group_id}"),
                fingerprint(exercise_ids(&exercises).chain(exercise_ids(&linked_exercises))),
                ShouldFix,
                LanguageVersionProblemKind::DuplicateExercisesInGroup {
                    course_id,
                    exercises,
                    linked_exercises,
                },
            ));
        }
    }
}

fn likely_separate_language_versions(
    join_candidates: &[JoinCandidate],
    problems: &mut Vec<LanguageVersionProblem>,
) {
    let candidates: Vec<JoinCandidate> = join_candidates
        .iter()
        .filter(|c| is_likely_language_version(c))
        .cloned()
        .collect();
    if candidates.is_empty() {
        return;
    }
    let mut ids: Vec<String> = candidates.iter().map(|c| c.course.id.to_string()).collect();
    ids.sort();
    problems.push(problem(
        "likely_separate_language_versions".to_string(),
        fingerprint(ids),
        ShouldFix,
        LanguageVersionProblemKind::LikelySeparateLanguageVersions { candidates },
    ));
}

fn page_order_differs(index: &CounterpartIndex<'_>, problems: &mut Vec<LanguageVersionProblem>) {
    for chapter_number in index.chapter_numbers() {
        for (course_id, pages) in index.out_of_order_pages(chapter_number) {
            let chapter_name = index
                .snapshot
                .chapters
                .iter()
                .find(|c| c.course_id == course_id && c.chapter_number == chapter_number)
                .map(|c| c.name.clone())
                .unwrap_or_default();
            problems.push(problem(
                format!("page_order_differs:{course_id}:{chapter_number}"),
                fingerprint(pages.iter().map(|d| {
                    format!("{}:{}:{}", d.page.id, d.page.position, d.reference_position)
                })),
                CheckIntended,
                LanguageVersionProblemKind::PageOrderDiffers {
                    course_id,
                    chapter_number,
                    chapter_name,
                    pages,
                },
            ));
        }
    }
}

fn chapter_count_differs(index: &CounterpartIndex<'_>, problems: &mut Vec<LanguageVersionProblem>) {
    let all_numbers = index.chapter_numbers();
    let mut numbers_by_course: HashMap<Uuid, HashSet<i32>> = HashMap::new();
    for chapter in &index.snapshot.chapters {
        numbers_by_course
            .entry(chapter.course_id)
            .or_default()
            .insert(chapter.chapter_number);
    }
    let missing_chapters: Vec<MissingChapterNumbers> = index
        .course_ids()
        .into_iter()
        .filter_map(|course_id| {
            let present = numbers_by_course.get(&course_id);
            let chapter_numbers: Vec<i32> = all_numbers
                .iter()
                .copied()
                .filter(|n| present.is_none_or(|p| !p.contains(n)))
                .collect();
            (!chapter_numbers.is_empty()).then_some(MissingChapterNumbers {
                course_id,
                chapter_numbers,
            })
        })
        .collect();
    if missing_chapters.is_empty() {
        return;
    }
    let parts: Vec<String> = missing_chapters
        .iter()
        .map(|m| format!("{}:{:?}", m.course_id, m.chapter_numbers))
        .collect();
    problems.push(problem(
        "chapter_count_differs".to_string(),
        fingerprint(parts),
        CheckIntended,
        LanguageVersionProblemKind::ChapterCountDiffers { missing_chapters },
    ));
}

/// Reported once per course pair, from the older course's side.
fn pages_in_other_chapter_numbers(
    index: &CounterpartIndex<'_>,
    problems: &mut Vec<LanguageVersionProblem>,
) {
    let course_ids = index.course_ids();
    for (i, course_id) in course_ids.iter().enumerate() {
        for counterpart_course_id in &course_ids[i + 1..] {
            let pages: Vec<LinkedPagePair> = index
                .live_pages(*course_id)
                .filter_map(|p| {
                    index
                        .page_counterpart_in(&p.page, *counterpart_course_id)
                        .filter(|c| c.page.chapter_number != p.page.chapter_number)
                        .map(|c| LinkedPagePair {
                            page: p.page.clone(),
                            counterpart: c.page.clone(),
                        })
                })
                .collect();
            if pages.is_empty() {
                continue;
            }
            problems.push(problem(
                format!("page_in_other_chapter_number:{course_id}:{counterpart_course_id}"),
                fingerprint(pages.iter().map(|p| {
                    format!(
                        "{}:{:?}:{}:{:?}",
                        p.page.id,
                        p.page.chapter_number,
                        p.counterpart.id,
                        p.counterpart.chapter_number
                    )
                })),
                CheckIntended,
                LanguageVersionProblemKind::PageInOtherChapterNumber {
                    course_id: *course_id,
                    counterpart_course_id: *counterpart_course_id,
                    pages,
                },
            ));
        }
    }
}

fn missing_exercise_counterparts(
    index: &CounterpartIndex<'_>,
    problems: &mut Vec<LanguageVersionProblem>,
) {
    for (course_id, counterpart_course_id) in course_pairs(index) {
        let exercises: Vec<LanguageVersionExercise> = index
            .live_exercises(course_id)
            .filter(|e| {
                index.exercise_counterparts(&e.exercise).next().is_some()
                    && index
                        .exercise_counterpart_in(&e.exercise, counterpart_course_id)
                        .is_none()
            })
            .map(|e| e.exercise.clone())
            .collect();
        if exercises.is_empty() {
            continue;
        }
        problems.push(problem(
            format!("missing_exercise_counterparts:{course_id}:{counterpart_course_id}"),
            fingerprint(exercise_ids(&exercises)),
            CheckIntended,
            LanguageVersionProblemKind::MissingExerciseCounterparts {
                course_id,
                counterpart_course_id,
                exercises,
            },
        ));
    }
}
