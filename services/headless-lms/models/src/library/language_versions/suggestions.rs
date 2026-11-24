//! Suggested counterparts for a course's pages and exercises in the other language versions.

use std::collections::{HashMap, HashSet};

use super::{
    ai_matching::AiPicksByCourse,
    counterpart_index::CounterpartIndex,
    snapshot::{LanguageGroupSnapshot, SnapshotExercise, SnapshotPage},
    types::{
        AiSuggestionStatus, ExerciseLinkSuggestion, LanguageVersionPage, LinkSuggestions,
        PageLinkSuggestion, SuggestedExerciseCounterpart, SuggestedPageCounterpart,
        SuggestionReason, SuggestionSureness,
    },
};
use crate::prelude::*;

/// How many copies deep the lineage query follows `copied_from`.
const MAX_COPY_DEPTH: i32 = 20;

/// Copy history of a snapshot's pages and exercises: every ancestor each was copied from,
/// directly or through other copies.
#[derive(Debug, Clone, Default)]
pub struct CopyLineage {
    ancestors: HashMap<Uuid, HashSet<Uuid>>,
}

impl CopyLineage {
    /// Whether one was copied from the other, or both from the same original.
    pub fn are_related(&self, a: Uuid, b: Uuid) -> bool {
        let empty = HashSet::new();
        let a_ancestors = self.ancestors.get(&a).unwrap_or(&empty);
        let b_ancestors = self.ancestors.get(&b).unwrap_or(&empty);
        a_ancestors.contains(&b)
            || b_ancestors.contains(&a)
            || !a_ancestors.is_disjoint(b_ancestors)
    }

    /// The item and its ancestors: two items are related exactly when these sets of theirs meet.
    fn self_and_ancestors(&self, id: Uuid) -> impl Iterator<Item = Uuid> + '_ {
        std::iter::once(id).chain(self.ancestors.get(&id).into_iter().flatten().copied())
    }
}

/// Positions in `ids` keyed by every id of their lineage, to find related items without comparing
/// every pair.
fn index_by_lineage(
    lineage: &CopyLineage,
    ids: impl Iterator<Item = Uuid>,
) -> HashMap<Uuid, Vec<usize>> {
    let mut res: HashMap<Uuid, Vec<usize>> = HashMap::new();
    for (i, id) in ids.enumerate() {
        for key in lineage.self_and_ancestors(id) {
            res.entry(key).or_default().push(i);
        }
    }
    res
}

/// The indices of `index` under `keys`, ascending and without duplicates.
fn lookup_all<K: std::hash::Hash + Eq>(
    index: &HashMap<K, Vec<usize>>,
    keys: impl IntoIterator<Item = K>,
) -> Vec<usize> {
    let mut res: Vec<usize> = keys
        .into_iter()
        .filter_map(|key| index.get(&key))
        .flatten()
        .copied()
        .collect();
    res.sort_unstable();
    res.dedup();
    res
}

/// Loads the copy history of the snapshot's pages and exercises.
pub async fn get_copy_lineage(
    conn: &mut PgConnection,
    snapshot: &LanguageGroupSnapshot,
) -> ModelResult<CopyLineage> {
    let page_ids: Vec<Uuid> = snapshot
        .pages
        .iter()
        .filter(|p| p.copied_from.is_some())
        .map(|p| p.page.id)
        .collect();
    let exercise_ids: Vec<Uuid> = snapshot
        .exercises
        .iter()
        .filter(|e| e.copied_from.is_some())
        .map(|e| e.exercise.id)
        .collect();
    let mut ancestors: HashMap<Uuid, HashSet<Uuid>> = HashMap::new();
    let page_rows = sqlx::query!(
        r#"
WITH RECURSIVE chain AS (
  SELECT p.id AS descendant_id,
    p.copied_from AS ancestor_id,
    1 AS depth
  FROM pages p
  WHERE p.id = ANY($1)
    AND p.copied_from IS NOT NULL
  UNION ALL
  SELECT chain.descendant_id,
    p.copied_from,
    chain.depth + 1
  FROM chain
    JOIN pages p ON p.id = chain.ancestor_id
  WHERE p.copied_from IS NOT NULL
    AND chain.depth < $2
)
SELECT descendant_id AS "descendant_id!",
  ancestor_id AS "ancestor_id!"
FROM chain
        "#,
        &page_ids,
        MAX_COPY_DEPTH
    )
    .fetch_all(&mut *conn)
    .await?;
    for row in page_rows {
        ancestors
            .entry(row.descendant_id)
            .or_default()
            .insert(row.ancestor_id);
    }
    let exercise_rows = sqlx::query!(
        r#"
WITH RECURSIVE chain AS (
  SELECT e.id AS descendant_id,
    e.copied_from AS ancestor_id,
    1 AS depth
  FROM exercises e
  WHERE e.id = ANY($1)
    AND e.copied_from IS NOT NULL
  UNION ALL
  SELECT chain.descendant_id,
    e.copied_from,
    chain.depth + 1
  FROM chain
    JOIN exercises e ON e.id = chain.ancestor_id
  WHERE e.copied_from IS NOT NULL
    AND chain.depth < $2
)
SELECT descendant_id AS "descendant_id!",
  ancestor_id AS "ancestor_id!"
FROM chain
        "#,
        &exercise_ids,
        MAX_COPY_DEPTH
    )
    .fetch_all(&mut *conn)
    .await?;
    for row in exercise_rows {
        ancestors
            .entry(row.descendant_id)
            .or_default()
            .insert(row.ancestor_id);
    }
    Ok(CopyLineage { ancestors })
}

/// The current or suggested counterpart of a page or exercise in one other course.
#[derive(Debug, Clone, Copy)]
pub(crate) struct Match<'a, T> {
    pub item: &'a T,
    pub is_linked: bool,
    pub sureness: SuggestionSureness,
    pub reason: Option<SuggestionReason>,
}

/// Matches `this` course's pages one-to-one with `other`'s, by this course's page id. Existing
/// links are kept; the rest are matched greedily, surest first, within chapter numbers (copy
/// history also across them).
pub(crate) fn match_pages<'a>(
    index: &CounterpartIndex<'a>,
    lineage: &CopyLineage,
    this: Uuid,
    other: Uuid,
) -> HashMap<Uuid, Match<'a, SnapshotPage>> {
    let mut res = HashMap::new();
    let mut free_this = Vec::new();
    for page in index.live_pages(this) {
        match index.page_counterpart_in(&page.page, other) {
            Some(counterpart) => {
                res.insert(
                    page.page.id,
                    Match {
                        item: counterpart,
                        is_linked: true,
                        sureness: SuggestionSureness::VerySure,
                        reason: Some(SuggestionReason::AlreadyLinked),
                    },
                );
            }
            None => free_this.push(page),
        }
    }
    let free_other: Vec<&SnapshotPage> = index
        .live_pages(other)
        .filter(|p| index.page_counterpart_in(&p.page, this).is_none())
        .collect();

    // Pairs outside these buckets get no tier below.
    let other_by_lineage = index_by_lineage(lineage, free_other.iter().map(|p| p.page.id));
    let mut other_by_place: HashMap<(Option<i32>, i32), Vec<usize>> = HashMap::new();
    let mut other_front_pages: HashMap<(bool, Option<i32>), Vec<usize>> = HashMap::new();
    for (i, o) in free_other.iter().enumerate() {
        other_by_place
            .entry((o.page.chapter_number, o.page.position))
            .or_default()
            .push(i);
        if o.page.url_path == "/" {
            other_front_pages.entry((true, None)).or_default().push(i);
        }
        if o.page.is_chapter_front_page {
            other_front_pages
                .entry((false, o.page.chapter_number))
                .or_default()
                .push(i);
        }
    }

    let mut candidates = Vec::new();
    for (order, t) in free_this.iter().enumerate() {
        let mut others = lookup_all(&other_by_lineage, lineage.self_and_ancestors(t.page.id));
        others.extend(lookup_all(
            &other_by_place,
            [(t.page.chapter_number, t.page.position)],
        ));
        others.extend(lookup_all(
            &other_front_pages,
            [
                (t.page.url_path == "/").then_some((true, None)),
                t.page
                    .is_chapter_front_page
                    .then_some((false, t.page.chapter_number)),
            ]
            .into_iter()
            .flatten(),
        ));
        others.sort_unstable();
        others.dedup();
        for o in others.iter().map(|i| &free_other[*i]) {
            let same_chapter = t.page.chapter_number == o.page.chapter_number;
            let same_position = same_chapter && t.page.position == o.page.position;
            // Pages outside chapters have no meaningful order, and two pages without exercises
            // match any other exercise-free page, so neither makes a position match sure.
            let in_chapter = t.page.chapter_number.is_some();
            let both_course_front_pages = t.page.url_path == "/" && o.page.url_path == "/";
            let both_chapter_front_pages =
                same_chapter && t.page.is_chapter_front_page && o.page.is_chapter_front_page;
            let tier = if lineage.are_related(t.page.id, o.page.id) {
                (
                    0,
                    SuggestionSureness::VerySure,
                    SuggestionReason::CopyHistory,
                )
            } else if both_course_front_pages || both_chapter_front_pages {
                (
                    1,
                    SuggestionSureness::VerySure,
                    SuggestionReason::SamePosition,
                )
            } else if same_position
                && in_chapter
                && t.page.exercise_count > 0
                && t.page.exercise_count == o.page.exercise_count
            {
                (
                    1,
                    SuggestionSureness::VerySure,
                    SuggestionReason::SamePositionAndExerciseCount,
                )
            } else if same_position && in_chapter {
                (
                    2,
                    SuggestionSureness::Likely,
                    SuggestionReason::SamePosition,
                )
            } else if same_position {
                (
                    3,
                    SuggestionSureness::Unsure,
                    SuggestionReason::SamePosition,
                )
            } else {
                continue;
            };
            let distance = (t.page.position - o.page.position).abs() + i32::from(!same_chapter);
            candidates.push((tier, distance, order, *t, *o));
        }
    }
    candidates.sort_by_key(|(tier, distance, order, _, _)| (tier.0, *distance, *order));
    let mut used_other: HashSet<Uuid> = HashSet::new();
    for ((_, sureness, reason), _, _, t, o) in candidates {
        if res.contains_key(&t.page.id) || used_other.contains(&o.page.id) {
            continue;
        }
        used_other.insert(o.page.id);
        res.insert(
            t.page.id,
            Match {
                item: o,
                is_linked: false,
                sureness,
                reason: Some(reason),
            },
        );
    }

    // What's left pairs up in order within each chapter number.
    let chapter_numbers: HashSet<Option<i32>> =
        free_this.iter().map(|p| p.page.chapter_number).collect();
    for chapter_number in chapter_numbers {
        let remaining_this = free_this
            .iter()
            .filter(|p| p.page.chapter_number == chapter_number && !res.contains_key(&p.page.id));
        let remaining_other: Vec<&SnapshotPage> = free_other
            .iter()
            .copied()
            .filter(|p| p.page.chapter_number == chapter_number && !used_other.contains(&p.page.id))
            .collect();
        let pairs: Vec<(Uuid, &SnapshotPage)> = remaining_this
            .zip(remaining_other)
            .map(|(t, o)| (t.page.id, o))
            .collect();
        for (t, o) in pairs {
            used_other.insert(o.page.id);
            res.insert(
                t,
                Match {
                    item: o,
                    is_linked: false,
                    sureness: SuggestionSureness::Unsure,
                    reason: None,
                },
            );
        }
    }
    res
}

/// Matches `this` course's exercises one-to-one with `other`'s, by exercise id, within the
/// page pairs of `page_matches` (copy history also across pages).
pub(crate) fn match_exercises<'a>(
    index: &CounterpartIndex<'a>,
    lineage: &CopyLineage,
    this: Uuid,
    other: Uuid,
    page_matches: &HashMap<Uuid, Match<'a, SnapshotPage>>,
) -> HashMap<Uuid, Match<'a, SnapshotExercise>> {
    let mut res = HashMap::new();
    let mut free_this = Vec::new();
    for exercise in index.live_exercises(this) {
        match index.exercise_counterpart_in(&exercise.exercise, other) {
            Some(counterpart) => {
                res.insert(
                    exercise.exercise.id,
                    Match {
                        item: counterpart,
                        is_linked: true,
                        sureness: SuggestionSureness::VerySure,
                        reason: Some(SuggestionReason::AlreadyLinked),
                    },
                );
            }
            None => free_this.push(exercise),
        }
    }
    let free_other: Vec<&SnapshotExercise> = index
        .live_exercises(other)
        .filter(|e| index.exercise_counterpart_in(&e.exercise, this).is_none())
        .collect();

    // Pairs outside these buckets get no tier below.
    let other_by_lineage = index_by_lineage(lineage, free_other.iter().map(|e| e.exercise.id));
    let mut other_by_place: HashMap<(Uuid, i32), Vec<usize>> = HashMap::new();
    let mut other_by_page: HashMap<Uuid, Vec<&SnapshotExercise>> = HashMap::new();
    for (i, o) in free_other.iter().enumerate() {
        other_by_place
            .entry((o.exercise.page_id, o.exercise.position))
            .or_default()
            .push(i);
        other_by_page
            .entry(o.exercise.page_id)
            .or_default()
            .push(*o);
    }

    let mut candidates = Vec::new();
    for (order, t) in free_this.iter().enumerate() {
        let page_match = page_matches.get(&t.exercise.page_id);
        let mut others = lookup_all(&other_by_lineage, lineage.self_and_ancestors(t.exercise.id));
        others.extend(lookup_all(
            &other_by_place,
            page_match.map(|m| (m.item.page.id, t.exercise.position)),
        ));
        others.sort_unstable();
        others.dedup();
        for o in others.iter().map(|i| &free_other[*i]) {
            let on_matched_page = page_match.is_some_and(|m| m.item.page.id == o.exercise.page_id);
            let tier = if lineage.are_related(t.exercise.id, o.exercise.id) {
                (
                    0,
                    SuggestionSureness::VerySure,
                    SuggestionReason::CopyHistory,
                )
            } else if on_matched_page
                && t.exercise.position == o.exercise.position
                && t.exercise.exercise_types == o.exercise.exercise_types
            {
                let page_pair_is_sure = page_match.is_some_and(|m| {
                    m.sureness == SuggestionSureness::VerySure
                        && index
                            .page(t.exercise.page_id)
                            .is_some_and(|p| p.page.exercise_count == m.item.page.exercise_count)
                });
                let sureness = if page_pair_is_sure {
                    SuggestionSureness::VerySure
                } else {
                    SuggestionSureness::Likely
                };
                (1, sureness, SuggestionReason::SamePositionAndExerciseTypes)
            } else if on_matched_page && t.exercise.position == o.exercise.position {
                (
                    3,
                    SuggestionSureness::Unsure,
                    SuggestionReason::SamePosition,
                )
            } else {
                continue;
            };
            candidates.push((tier, order, *t, *o));
        }
    }
    candidates.sort_by_key(|(tier, order, _, _)| (tier.0, *order));
    let mut used_other: HashSet<Uuid> = HashSet::new();
    let assign = |res: &mut HashMap<Uuid, Match<'a, SnapshotExercise>>,
                  used_other: &mut HashSet<Uuid>,
                  t: &SnapshotExercise,
                  o: &'a SnapshotExercise,
                  sureness,
                  reason| {
        used_other.insert(o.exercise.id);
        res.insert(
            t.exercise.id,
            Match {
                item: o,
                is_linked: false,
                sureness,
                reason,
            },
        );
    };
    let (strong, weak): (Vec<_>, Vec<_>) = candidates
        .into_iter()
        .partition(|((tier, _, _), _, _, _)| *tier < 3);
    for ((_, sureness, reason), _, t, o) in strong {
        if !res.contains_key(&t.exercise.id) && !used_other.contains(&o.exercise.id) {
            assign(&mut res, &mut used_other, t, o, sureness, Some(reason));
        }
    }
    // When a page lacks some exercises, positions shift; the next unmatched exercise of the same
    // types on the counterpart page is still a fair guess.
    for t in &free_this {
        if res.contains_key(&t.exercise.id) {
            continue;
        }
        let Some(page_match) = page_matches.get(&t.exercise.page_id) else {
            continue;
        };
        if let Some(o) = other_by_page
            .get(&page_match.item.page.id)
            .into_iter()
            .flatten()
            .copied()
            .find(|o| {
                !used_other.contains(&o.exercise.id)
                    && o.exercise.exercise_types == t.exercise.exercise_types
            })
        {
            assign(
                &mut res,
                &mut used_other,
                t,
                o,
                SuggestionSureness::Unsure,
                None,
            );
        }
    }
    for ((_, sureness, reason), _, t, o) in weak {
        if !res.contains_key(&t.exercise.id) && !used_other.contains(&o.exercise.id) {
            assign(&mut res, &mut used_other, t, o, sureness, Some(reason));
        }
    }
    res
}

/// Each item's matched counterpart id, keyed by this course's item id.
fn picked_ids<T>(
    matches: &HashMap<Uuid, Match<'_, T>>,
    id_of: impl Fn(&T) -> Uuid,
) -> HashMap<Uuid, Uuid> {
    matches
        .iter()
        .map(|(this, m)| (*this, id_of(m.item)))
        .collect()
}

/// Puts the AI's picks for one other course over the heuristic `matches`, keyed by this course's
/// item id. Links and copy history stay. An AI pick that agrees with `heuristic` (this item id →
/// other item id, from heuristics alone, never shaped by AI picks) becomes very sure; any other
/// pick replaces the match as an AI suggestion. Picks of items that are not live in the other
/// course are ignored. Returns the items the AI says have no counterpart.
fn apply_ai_picks<'a, T>(
    matches: &mut HashMap<Uuid, Match<'a, T>>,
    heuristic: &HashMap<Uuid, Uuid>,
    picks: &HashMap<Uuid, Option<Uuid>>,
    other_items: &HashMap<Uuid, &'a T>,
    id_of: impl Fn(&T) -> Uuid,
) -> HashSet<Uuid> {
    let is_fixed =
        |m: &Match<'a, T>| m.is_linked || m.reason == Some(SuggestionReason::CopyHistory);
    let fixed_other: HashSet<Uuid> = matches
        .values()
        .filter(|m| is_fixed(m))
        .map(|m| id_of(m.item))
        .collect();
    let mut no_counterpart = HashSet::new();
    let mut answered = HashSet::new();
    let mut picked_other = HashSet::new();
    let mut ai_matches = Vec::new();
    for (this, pick) in picks {
        if matches.get(this).is_some_and(is_fixed) {
            continue;
        }
        match pick {
            None => {
                no_counterpart.insert(*this);
            }
            Some(other) => {
                let Some(item) = other_items.get(other).copied() else {
                    continue;
                };
                if fixed_other.contains(other) || !picked_other.insert(*other) {
                    continue;
                }
                let agrees = heuristic.get(this) == Some(other);
                let (sureness, reason) = if agrees {
                    (
                        SuggestionSureness::VerySure,
                        SuggestionReason::AiAndPosition,
                    )
                } else {
                    (SuggestionSureness::AiSuggestion, SuggestionReason::Ai)
                };
                ai_matches.push((
                    *this,
                    Match {
                        item,
                        is_linked: false,
                        sureness,
                        reason: Some(reason),
                    },
                ));
            }
        }
        answered.insert(*this);
    }
    matches.retain(|this, m| {
        is_fixed(m) || (!answered.contains(this) && !picked_other.contains(&id_of(m.item)))
    });
    matches.extend(ai_matches);
    no_counterpart
}

/// Suggested counterparts for `course_id`'s pages and exercises in every other course of the
/// snapshot (load it with [super::snapshot::load_with_candidates] to include courses before a
/// join). `chapter_number` limits the rows and unmatched items to one chapter number. `ai` picks
/// outrank every heuristic but links and copy history (see [super::ai_matching]); the caller sets
/// `ai_status`.
pub fn suggest_links(
    snapshot: &LanguageGroupSnapshot,
    lineage: &CopyLineage,
    course_id: Uuid,
    chapter_number: Option<i32>,
    ai: Option<&AiPicksByCourse>,
) -> ModelResult<LinkSuggestions> {
    if !snapshot.courses.iter().any(|c| c.id == course_id) {
        return Err(model_err!(
            NotFound,
            "The course is not one of the language versions.".to_string()
        ));
    }
    let index = CounterpartIndex::new(snapshot);
    let other_courses: Vec<Uuid> = index
        .course_ids()
        .into_iter()
        .filter(|id| *id != course_id)
        .collect();
    let in_scope =
        |page_chapter: Option<i32>| chapter_number.is_none() || page_chapter == chapter_number;

    let mut page_matches = Vec::new();
    let mut exercise_matches = Vec::new();
    let mut ai_no_counterpart: HashSet<(Uuid, Uuid)> = HashSet::new();
    for other in &other_courses {
        let picks = ai.and_then(|ai| ai.get(other));
        let mut pages = match_pages(&index, lineage, course_id, *other);
        // Agreement is judged against heuristics alone: exercises matched within AI-picked pages
        // would otherwise "agree" with the AI and get accepted without review.
        let heuristic_pages = picked_ids(&pages, |p| p.page.id);
        let heuristic_exercises = picks.map(|_| {
            picked_ids(
                &match_exercises(&index, lineage, course_id, *other, &pages),
                |e| e.exercise.id,
            )
        });
        if let Some(picks) = picks {
            let other_pages = index.live_pages(*other).map(|p| (p.page.id, p)).collect();
            let none = apply_ai_picks(
                &mut pages,
                &heuristic_pages,
                &picks.pages,
                &other_pages,
                |p| p.page.id,
            );
            ai_no_counterpart.extend(none.into_iter().map(|id| (id, *other)));
        }
        let mut exercises = match_exercises(&index, lineage, course_id, *other, &pages);
        if let (Some(picks), Some(heuristic_exercises)) = (picks, &heuristic_exercises) {
            let other_exercises = index
                .live_exercises(*other)
                .map(|e| (e.exercise.id, e))
                .collect();
            let none = apply_ai_picks(
                &mut exercises,
                heuristic_exercises,
                &picks.exercises,
                &other_exercises,
                |e| e.exercise.id,
            );
            ai_no_counterpart.extend(none.into_iter().map(|id| (id, *other)));
        }
        page_matches.push(pages);
        exercise_matches.push(exercises);
    }
    // An explicit "no counterpart" from the AI is a suggestion too.
    let ai_sureness = |item: Uuid, other: Uuid, sureness: Option<SuggestionSureness>| {
        sureness.or(ai_no_counterpart
            .contains(&(item, other))
            .then_some(SuggestionSureness::AiSuggestion))
    };
    let ai_reason = |item: Uuid, other: Uuid, reason: Option<SuggestionReason>| {
        reason.or(ai_no_counterpart
            .contains(&(item, other))
            .then_some(SuggestionReason::Ai))
    };
    let mut pages_by_chapter: HashMap<(Uuid, Option<i32>), Vec<&SnapshotPage>> = HashMap::new();
    for other in &other_courses {
        for page in index.live_pages(*other) {
            pages_by_chapter
                .entry((*other, page.page.chapter_number))
                .or_default()
                .push(page);
        }
    }

    let pages = index
        .live_pages(course_id)
        .filter(|p| in_scope(p.page.chapter_number))
        .map(|reference| PageLinkSuggestion {
            reference: reference.page.clone(),
            counterparts: other_courses
                .iter()
                .zip(&page_matches)
                .map(|(other, matches)| {
                    let found = matches.get(&reference.page.id);
                    let alternatives: Vec<LanguageVersionPage> = pages_by_chapter
                        .get(&(*other, reference.page.chapter_number))
                        .into_iter()
                        .flatten()
                        .filter(|p| found.is_none_or(|m| m.item.page.id != p.page.id))
                        .map(|p| p.page.clone())
                        .collect();
                    SuggestedPageCounterpart {
                        course_id: *other,
                        page: found.map(|m| m.item.page.clone()),
                        is_linked: found.is_some_and(|m| m.is_linked),
                        sureness: ai_sureness(reference.page.id, *other, found.map(|m| m.sureness)),
                        reason: ai_reason(reference.page.id, *other, found.and_then(|m| m.reason)),
                        alternatives,
                    }
                })
                .collect(),
        })
        .collect();

    let exercises = index
        .live_exercises(course_id)
        .filter(|e| in_scope(e.exercise.chapter_number))
        .map(|reference| ExerciseLinkSuggestion {
            reference: reference.exercise.clone(),
            counterparts: other_courses
                .iter()
                .zip(page_matches.iter().zip(&exercise_matches))
                .map(|(other, (pages, exercises))| {
                    let found = exercises.get(&reference.exercise.id);
                    let counterpart_page_id = pages
                        .get(&reference.exercise.page_id)
                        .map(|m| m.item.page.id);
                    let alternatives_page_id =
                        counterpart_page_id.or(found.map(|m| m.item.exercise.page_id));
                    let alternatives = alternatives_page_id
                        .into_iter()
                        .flat_map(|page_id| index.live_exercises_on_page(page_id))
                        .filter(|e| found.is_none_or(|m| m.item.exercise.id != e.exercise.id))
                        .map(|e| e.exercise.clone())
                        .collect();
                    SuggestedExerciseCounterpart {
                        course_id: *other,
                        exercise: found.map(|m| m.item.exercise.clone()),
                        is_linked: found.is_some_and(|m| m.is_linked),
                        is_on_other_page: found.is_some_and(|m| {
                            m.is_linked
                                && counterpart_page_id
                                    .is_some_and(|id| id != m.item.exercise.page_id)
                        }),
                        sureness: ai_sureness(
                            reference.exercise.id,
                            *other,
                            found.map(|m| m.sureness),
                        ),
                        reason: ai_reason(
                            reference.exercise.id,
                            *other,
                            found.and_then(|m| m.reason),
                        ),
                        alternatives,
                    }
                })
                .collect(),
        })
        .collect();

    let used_pages: HashSet<Uuid> = page_matches
        .iter()
        .flat_map(|m| m.values().map(|m| m.item.page.id))
        .collect();
    let used_exercises: HashSet<Uuid> = exercise_matches
        .iter()
        .flat_map(|m| m.values().map(|m| m.item.exercise.id))
        .collect();
    let unmatched_pages = other_courses
        .iter()
        .flat_map(|other| index.live_pages(*other))
        .filter(|p| in_scope(p.page.chapter_number) && !used_pages.contains(&p.page.id))
        .map(|p| p.page.clone())
        .collect();
    let unmatched_exercises = other_courses
        .iter()
        .flat_map(|other| index.live_exercises(*other))
        .filter(|e| in_scope(e.exercise.chapter_number) && !used_exercises.contains(&e.exercise.id))
        .map(|e| e.exercise.clone())
        .collect();

    Ok(LinkSuggestions {
        courses: snapshot.courses.clone(),
        pages,
        exercises,
        unmatched_pages,
        unmatched_exercises,
        ai_status: AiSuggestionStatus::NotRequested,
    })
}

/// The page's suggested counterpart in each other course where it has none linked, by course id:
/// what [suggest_links] suggests for the page, computed for this page alone.
pub fn suggest_page_counterparts<'a>(
    snapshot: &'a LanguageGroupSnapshot,
    lineage: &CopyLineage,
    page: &LanguageVersionPage,
) -> HashMap<Uuid, (&'a LanguageVersionPage, SuggestionSureness)> {
    let index = CounterpartIndex::new(snapshot);
    index
        .course_ids()
        .into_iter()
        .filter(|id| *id != page.course_id)
        .filter_map(|other| {
            let matches = match_pages(&index, lineage, page.course_id, other);
            matches
                .get(&page.id)
                .filter(|m| !m.is_linked)
                .map(|m| (other, (&m.item.page, m.sureness)))
        })
        .collect()
}
