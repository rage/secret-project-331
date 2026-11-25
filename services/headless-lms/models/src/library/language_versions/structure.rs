//! The language versions side by side: chapters by number, linked pages and exercises on rows.

use std::collections::{HashMap, HashSet};

use super::{
    counterpart_index::CounterpartIndex,
    snapshot::{LanguageGroupSnapshot, SnapshotExercise, SnapshotPage},
    types::{
        LanguageVersionStructure, StructureChapterRow, StructureExercise, StructureExerciseRow,
        StructureNote, StructurePage, StructurePageRow,
    },
};
use crate::prelude::*;

/// Builds the structure comparison. Rows are ordered by `course_id`'s page positions, with pages
/// it lacks placed by their own position.
pub fn build_structure(
    snapshot: &LanguageGroupSnapshot,
    course_id: Uuid,
) -> LanguageVersionStructure {
    let index = CounterpartIndex::new(snapshot);
    // `course_id` first, then the others in snapshot order.
    let mut course_ids = index.course_ids();
    course_ids.sort_by_key(|id| *id != course_id);
    let priority: HashMap<Uuid, usize> = course_ids
        .iter()
        .enumerate()
        .map(|(i, id)| (*id, i))
        .collect();

    let mut rows: Vec<Vec<&SnapshotPage>> = Vec::new();
    let mut assigned: HashSet<Uuid> = HashSet::new();
    for course in &course_ids {
        for page in index.live_pages(*course) {
            if !assigned.insert(page.page.id) {
                continue;
            }
            let mut row = vec![page];
            for other in &course_ids {
                if other == course {
                    continue;
                }
                if let Some(counterpart) = index
                    .page_counterparts(&page.page)
                    .find(|p| p.page.course_id == *other && !assigned.contains(&p.page.id))
                {
                    assigned.insert(counterpart.page.id);
                    row.push(counterpart);
                }
            }
            row.sort_by_key(|p| priority.get(&p.page.course_id).copied());
            rows.push(row);
        }
    }
    rows.sort_by_key(|row| {
        let anchor = row[0];
        (
            anchor.page.chapter_number,
            anchor.page.position,
            priority.get(&anchor.page.course_id).copied(),
        )
    });

    let reference_positions: HashMap<Uuid, i32> = index
        .chapter_numbers()
        .into_iter()
        .flat_map(|n| index.out_of_order_pages(n))
        .flat_map(|(_, differences)| differences)
        .map(|d| (d.page.id, d.reference_position))
        .collect();

    let mut chapter_numbers: Vec<Option<i32>> = rows
        .iter()
        .map(|row| row[0].page.chapter_number)
        .chain(snapshot.chapters.iter().map(|c| Some(c.chapter_number)))
        .collect();
    chapter_numbers.sort();
    chapter_numbers.dedup();

    let mut rows_by_chapter: HashMap<Option<i32>, Vec<&Vec<&SnapshotPage>>> = HashMap::new();
    for row in &rows {
        rows_by_chapter
            .entry(row[0].page.chapter_number)
            .or_default()
            .push(row);
    }
    let chapters = chapter_numbers
        .into_iter()
        .map(|chapter_number| StructureChapterRow {
            chapter_number,
            chapters: course_ids
                .iter()
                .filter_map(|course| {
                    snapshot.chapters.iter().find(|c| {
                        c.course_id == *course && Some(c.chapter_number) == chapter_number
                    })
                })
                .cloned()
                .collect(),
            rows: rows_by_chapter
                .get(&chapter_number)
                .into_iter()
                .flatten()
                .map(|row| {
                    build_row(
                        &index,
                        &course_ids,
                        row,
                        chapter_number,
                        &reference_positions,
                    )
                })
                .collect(),
        })
        .collect();

    LanguageVersionStructure {
        courses: course_ids
            .iter()
            .filter_map(|id| snapshot.courses.iter().find(|c| c.id == *id))
            .cloned()
            .collect(),
        chapters,
    }
}

/// `course_ids` in display order.
fn build_row(
    index: &CounterpartIndex<'_>,
    course_ids: &[Uuid],
    row: &[&SnapshotPage],
    chapter_number: Option<i32>,
    reference_positions: &HashMap<Uuid, i32>,
) -> StructurePageRow {
    let row_page_by_course: HashMap<Uuid, Uuid> =
        row.iter().map(|p| (p.page.course_id, p.page.id)).collect();
    let is_on_other_page = |exercise: &SnapshotExercise| {
        row_page_by_course.get(&exercise.exercise.course_id) != Some(&exercise.exercise.page_id)
    };

    let pages = row
        .iter()
        .map(|page| {
            let mut notes = Vec::new();
            if let Some(reference_position) = reference_positions.get(&page.page.id) {
                notes.push(StructureNote::DifferentPosition {
                    reference_position: *reference_position,
                });
            }
            if let Some(n) = chapter_number
                && page.page.chapter_number != Some(n)
            {
                notes.push(StructureNote::InOtherChapterNumber {
                    reference_chapter_number: n,
                });
            }
            if let Some(other) = index.page_group_members(&page.page).iter().find(|p| {
                p.page.course_id == page.page.course_id
                    && p.page.id != page.page.id
                    && super::counterpart_index::is_live_page(p)
            }) {
                notes.push(StructureNote::DuplicateInGroup {
                    other_page_id: other.page.id,
                });
            }
            if index
                .page_group_members(&page.page)
                .iter()
                .any(|p| p.is_foreign && !p.page.is_deleted)
            {
                notes.push(StructureNote::ForeignCourseLink);
            }
            let exercises_on_other_page = index
                .live_exercises_on_page(page.page.id)
                .filter(|e| {
                    index
                        .exercise_counterparts(&e.exercise)
                        .any(&is_on_other_page)
                })
                .count();
            if exercises_on_other_page > 0 {
                notes.push(StructureNote::ExercisesOnOtherPage {
                    exercise_count: exercises_on_other_page as i64,
                });
            }
            StructurePage {
                page: page.page.clone(),
                notes,
            }
        })
        .collect();

    let mut exercise_rows = Vec::new();
    let mut assigned: HashSet<Uuid> = HashSet::new();
    for page in row {
        for exercise in index.live_exercises_on_page(page.page.id) {
            if !assigned.insert(exercise.exercise.id) {
                continue;
            }
            let mut exercises = vec![StructureExercise {
                exercise: exercise.exercise.clone(),
                is_on_other_page: false,
            }];
            for other in course_ids.iter().copied() {
                if other == page.page.course_id {
                    continue;
                }
                if let Some(counterpart) = index
                    .exercise_counterparts(&exercise.exercise)
                    .find(|e| e.exercise.course_id == other && !assigned.contains(&e.exercise.id))
                {
                    assigned.insert(counterpart.exercise.id);
                    exercises.push(StructureExercise {
                        exercise: counterpart.exercise.clone(),
                        is_on_other_page: is_on_other_page(counterpart),
                    });
                }
            }
            exercise_rows.push(StructureExerciseRow { exercises });
        }
    }

    StructurePageRow {
        pages,
        exercise_rows,
    }
}
