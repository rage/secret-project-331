//! Lookups over a [LanguageGroupSnapshot] shared by detection, suggestions and the structure
//! comparison.

use std::collections::{HashMap, HashSet};

use super::{
    snapshot::{LanguageGroupSnapshot, SnapshotExercise, SnapshotPage},
    types::{LanguageVersionExercise, LanguageVersionPage, PagePositionDifference},
};
use crate::prelude::*;

/// The snapshot indexed by id and by language group. "Live" means not deleted and in a course of
/// the snapshot's group (or a candidate course loaded with it).
pub(crate) struct CounterpartIndex<'a> {
    pub snapshot: &'a LanguageGroupSnapshot,
    pages_by_group: HashMap<Uuid, Vec<&'a SnapshotPage>>,
    exercises_by_group: HashMap<Uuid, Vec<&'a SnapshotExercise>>,
    pages_by_id: HashMap<Uuid, &'a SnapshotPage>,
    /// Live items in structure order.
    live_pages_by_course: HashMap<Uuid, Vec<&'a SnapshotPage>>,
    live_exercises_by_course: HashMap<Uuid, Vec<&'a SnapshotExercise>>,
    live_exercises_by_page: HashMap<Uuid, Vec<&'a SnapshotExercise>>,
}

pub(crate) fn is_live_page(page: &SnapshotPage) -> bool {
    !page.is_foreign && !page.page.is_deleted
}

pub(crate) fn is_live_exercise(exercise: &SnapshotExercise) -> bool {
    !exercise.is_foreign && !exercise.exercise.is_deleted
}

impl<'a> CounterpartIndex<'a> {
    pub fn new(snapshot: &'a LanguageGroupSnapshot) -> Self {
        let mut pages_by_group: HashMap<Uuid, Vec<&SnapshotPage>> = HashMap::new();
        let mut pages_by_id = HashMap::new();
        let mut live_pages_by_course: HashMap<Uuid, Vec<&SnapshotPage>> = HashMap::new();
        for page in &snapshot.pages {
            pages_by_id.insert(page.page.id, page);
            if let Some(group_id) = page.page.page_language_group_id {
                pages_by_group.entry(group_id).or_default().push(page);
            }
            if is_live_page(page) {
                live_pages_by_course
                    .entry(page.page.course_id)
                    .or_default()
                    .push(page);
            }
        }
        let mut exercises_by_group: HashMap<Uuid, Vec<&SnapshotExercise>> = HashMap::new();
        let mut live_exercises_by_course: HashMap<Uuid, Vec<&SnapshotExercise>> = HashMap::new();
        let mut live_exercises_by_page: HashMap<Uuid, Vec<&SnapshotExercise>> = HashMap::new();
        for exercise in &snapshot.exercises {
            if let Some(group_id) = exercise.exercise.exercise_language_group_id {
                exercises_by_group
                    .entry(group_id)
                    .or_default()
                    .push(exercise);
            }
            if is_live_exercise(exercise) {
                live_exercises_by_course
                    .entry(exercise.exercise.course_id)
                    .or_default()
                    .push(exercise);
                live_exercises_by_page
                    .entry(exercise.exercise.page_id)
                    .or_default()
                    .push(exercise);
            }
        }
        Self {
            snapshot,
            pages_by_group,
            exercises_by_group,
            pages_by_id,
            live_pages_by_course,
            live_exercises_by_course,
            live_exercises_by_page,
        }
    }

    pub fn course_ids(&self) -> Vec<Uuid> {
        self.snapshot.courses.iter().map(|c| c.id).collect()
    }

    pub fn page(&self, page_id: Uuid) -> Option<&'a SnapshotPage> {
        self.pages_by_id.get(&page_id).copied()
    }

    /// Live pages of the course in structure order.
    pub fn live_pages(&self, course_id: Uuid) -> impl Iterator<Item = &'a SnapshotPage> + '_ {
        self.live_pages_by_course
            .get(&course_id)
            .into_iter()
            .flatten()
            .copied()
    }

    /// Live exercises of the course in structure order.
    pub fn live_exercises(
        &self,
        course_id: Uuid,
    ) -> impl Iterator<Item = &'a SnapshotExercise> + '_ {
        self.live_exercises_by_course
            .get(&course_id)
            .into_iter()
            .flatten()
            .copied()
    }

    /// Live exercises on the page in structure order.
    pub fn live_exercises_on_page(
        &self,
        page_id: Uuid,
    ) -> impl Iterator<Item = &'a SnapshotExercise> + '_ {
        self.live_exercises_by_page
            .get(&page_id)
            .into_iter()
            .flatten()
            .copied()
    }

    /// Every page sharing the page's language group, the page itself included, foreign and
    /// deleted ones too.
    pub fn page_group_members(&self, page: &LanguageVersionPage) -> &[&'a SnapshotPage] {
        page.page_language_group_id
            .and_then(|id| self.pages_by_group.get(&id))
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    pub fn exercise_group_members(
        &self,
        exercise: &LanguageVersionExercise,
    ) -> &[&'a SnapshotExercise] {
        exercise
            .exercise_language_group_id
            .and_then(|id| self.exercises_by_group.get(&id))
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Live pages of other courses linked to the page.
    pub fn page_counterparts(
        &self,
        page: &LanguageVersionPage,
    ) -> impl Iterator<Item = &'a SnapshotPage> + '_ {
        let course_id = page.course_id;
        self.page_group_members(page)
            .iter()
            .copied()
            .filter(move |p| p.page.course_id != course_id && is_live_page(p))
    }

    /// The page's live counterpart in the course; the first one if there are several.
    pub fn page_counterpart_in(
        &self,
        page: &LanguageVersionPage,
        course_id: Uuid,
    ) -> Option<&'a SnapshotPage> {
        self.page_group_members(page)
            .iter()
            .copied()
            .find(|p| p.page.course_id == course_id && p.page.id != page.id && is_live_page(p))
    }

    pub fn exercise_counterparts(
        &self,
        exercise: &LanguageVersionExercise,
    ) -> impl Iterator<Item = &'a SnapshotExercise> + '_ {
        let course_id = exercise.course_id;
        self.exercise_group_members(exercise)
            .iter()
            .copied()
            .filter(move |e| e.exercise.course_id != course_id && is_live_exercise(e))
    }

    pub fn exercise_counterpart_in(
        &self,
        exercise: &LanguageVersionExercise,
        course_id: Uuid,
    ) -> Option<&'a SnapshotExercise> {
        self.exercise_group_members(exercise)
            .iter()
            .copied()
            .find(|e| {
                e.exercise.course_id == course_id
                    && e.exercise.id != exercise.id
                    && is_live_exercise(e)
            })
    }

    /// Chapter numbers with live pages or chapters in any course, ascending.
    pub fn chapter_numbers(&self) -> Vec<i32> {
        let mut numbers: Vec<i32> = self
            .snapshot
            .chapters
            .iter()
            .map(|c| c.chapter_number)
            .collect();
        numbers.sort_unstable();
        numbers.dedup();
        numbers
    }

    /// Pages of the chapter number whose order among linked pages differs from the reference
    /// course's, by course. The reference is the course whose order disagrees least with the
    /// others (the oldest on a tie), so a single reordered version is the one reported.
    pub fn out_of_order_pages(
        &self,
        chapter_number: i32,
    ) -> Vec<(Uuid, Vec<PagePositionDifference>)> {
        let course_ids = self.course_ids();
        let chapter_pages: Vec<Vec<&'a SnapshotPage>> = course_ids
            .iter()
            .map(|course_id| {
                self.live_pages(*course_id)
                    .filter(|p| p.page.chapter_number == Some(chapter_number))
                    .collect()
            })
            .collect();
        // For each page of `pages`, the position of its counterpart in `other`, in `pages` order.
        let counterpart_positions =
            |pages: &[&'a SnapshotPage], other_course: Uuid| -> Vec<(&'a SnapshotPage, i32)> {
                pages
                    .iter()
                    .filter_map(|p| {
                        self.page_counterpart_in(&p.page, other_course)
                            .filter(|c| c.page.chapter_number == Some(chapter_number))
                            .map(|c| (*p, c.page.position))
                    })
                    .collect()
            };
        let disagreement = |a: usize, b: usize| {
            let positions: Vec<i32> = counterpart_positions(&chapter_pages[a], course_ids[b])
                .into_iter()
                .map(|(_, position)| position)
                .collect();
            positions.len() - longest_increasing_subsequence(&positions).len()
        };
        let reference = (0..course_ids.len())
            .min_by_key(|a| {
                (0..course_ids.len())
                    .filter(|b| b != a)
                    .map(|b| disagreement(*a, b))
                    .sum::<usize>()
            })
            .unwrap_or(0);

        let mut res = Vec::new();
        for (i, course_id) in course_ids.iter().enumerate() {
            if i == reference {
                continue;
            }
            let pairs = counterpart_positions(&chapter_pages[i], course_ids[reference]);
            let positions: Vec<i32> = pairs.iter().map(|(_, position)| *position).collect();
            let kept: HashSet<usize> = longest_increasing_subsequence(&positions)
                .into_iter()
                .collect();
            let differences: Vec<PagePositionDifference> = pairs
                .iter()
                .enumerate()
                .filter(|(j, _)| !kept.contains(j))
                .map(|(_, (page, reference_position))| PagePositionDifference {
                    page: page.page.clone(),
                    reference_position: *reference_position,
                })
                .collect();
            if !differences.is_empty() {
                res.push((*course_id, differences));
            }
        }
        res
    }
}

/// Indices of one longest strictly increasing subsequence.
fn longest_increasing_subsequence(values: &[i32]) -> Vec<usize> {
    let n = values.len();
    let mut lengths = vec![1usize; n];
    let mut previous: Vec<Option<usize>> = vec![None; n];
    for i in 0..n {
        for j in 0..i {
            if values[j] < values[i] && lengths[j] + 1 > lengths[i] {
                lengths[i] = lengths[j] + 1;
                previous[i] = Some(j);
            }
        }
    }
    let Some(mut current) = (0..n).max_by_key(|i| (lengths[*i], std::cmp::Reverse(*i))) else {
        return Vec::new();
    };
    let mut res = vec![current];
    while let Some(p) = previous[current] {
        res.push(p);
        current = p;
    }
    res.reverse();
    res
}

/// A stable hash of the ids (and numbers) behind a problem, in order.
pub(crate) fn fingerprint<I, S>(parts: I) -> String
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_ref().as_bytes());
        hasher.update(b"\n");
    }
    hex::encode(&hasher.finalize()[..16])
}
