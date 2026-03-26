use std::collections::{HashMap, HashSet, VecDeque};

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use uuid::Uuid;

use crate::{
    ModelError, ModelErrorType, ModelResult,
    pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, CmsPageUpdate},
    prelude::*,
};

use super::content::extract_top_level_exercise_ids;

/// Forks duplicated exercise blocks (same exercise id repeated) into distinct exercises.
///
/// Uses `old_exercise_ids` to keep the pre-existing occurrence stable:
/// - If `old_exercise_ids` is empty, the first occurrence of each exercise id is kept and later
///   duplicates are forked.
/// - Otherwise, greedily matches `old_exercise_ids` as a subsequence of the new ids and forks any
///   extra occurrences.
pub fn dedupe_fork_duplicate_exercises(
    page_update: &mut CmsPageUpdate,
    old_exercise_ids: &[Uuid],
) -> ModelResult<()> {
    let exercise_block_positions: Vec<usize> = page_update
        .content
        .iter()
        .enumerate()
        .filter(|(_, block)| block.name == "moocfi/exercise")
        .map(|(index, _)| index)
        .collect();

    if exercise_block_positions.len() != page_update.exercises.len() {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Exercise blocks and exercises payload are out of sync.".to_string(),
            None,
        ));
    }

    let new_exercise_ids = extract_top_level_exercise_ids(&page_update.content);
    if new_exercise_ids.len() != exercise_block_positions.len() {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Exercise block id attributes are invalid.".to_string(),
            None,
        ));
    }

    let mut should_fork = Vec::with_capacity(new_exercise_ids.len());
    if old_exercise_ids.is_empty() {
        let mut seen = HashSet::new();
        for exercise_id in new_exercise_ids.iter() {
            should_fork.push(!seen.insert(*exercise_id));
        }
    } else {
        let mut old_index = 0;
        for exercise_id in new_exercise_ids.iter() {
            if old_index < old_exercise_ids.len() && old_exercise_ids[old_index] == *exercise_id {
                should_fork.push(false);
                old_index += 1;
            } else {
                should_fork.push(true);
            }
        }
    }

    let mut grouped_slides: HashMap<Uuid, VecDeque<CmsPageExerciseSlide>> = HashMap::new();
    for slide in page_update.exercise_slides.drain(..) {
        grouped_slides
            .entry(slide.exercise_id)
            .or_default()
            .push_back(slide);
    }

    let mut grouped_tasks: HashMap<Uuid, VecDeque<CmsPageExerciseTask>> = HashMap::new();
    for task in page_update.exercise_tasks.drain(..) {
        grouped_tasks
            .entry(task.exercise_slide_id)
            .or_default()
            .push_back(task);
    }

    let original_exercises: Vec<CmsPageExercise> = std::mem::take(&mut page_update.exercises);
    let mut rewritten_exercises = Vec::with_capacity(original_exercises.len());
    let mut rewritten_slides = vec![];
    let mut rewritten_tasks = vec![];

    for (index, mut exercise) in original_exercises.into_iter().enumerate() {
        let is_fork = should_fork[index];
        let old_exercise_id = exercise.id;
        let target_exercise_id = if is_fork {
            Uuid::new_v4()
        } else {
            old_exercise_id
        };
        exercise.id = target_exercise_id;

        let block: &mut GutenbergBlock = page_update
            .content
            .get_mut(exercise_block_positions[index])
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "Exercise block index is out of range.".to_string(),
                    None,
                )
            })?;
        block.attributes.insert(
            "id".to_string(),
            serde_json::Value::String(target_exercise_id.to_string()),
        );

        rewritten_exercises.push(exercise);
        let exercise_slides = consume_slides_for_one_exercise(&mut grouped_slides, old_exercise_id);
        for mut slide in exercise_slides {
            let old_slide_id = slide.id;
            let target_slide_id = if is_fork {
                Uuid::new_v4()
            } else {
                old_slide_id
            };
            slide.id = target_slide_id;
            slide.exercise_id = target_exercise_id;
            rewritten_slides.push(slide);

            let exercise_tasks = consume_tasks_for_one_slide(&mut grouped_tasks, old_slide_id);
            for mut task in exercise_tasks {
                task.id = if is_fork { Uuid::new_v4() } else { task.id };
                task.exercise_slide_id = target_slide_id;
                rewritten_tasks.push(task);
            }
        }
    }

    page_update.exercises = rewritten_exercises;
    page_update.exercise_slides = rewritten_slides;
    page_update.exercise_tasks = rewritten_tasks;

    Ok(())
}

/// Consumes slides for a single exercise occurrence from the grouped slide queue.
fn consume_slides_for_one_exercise(
    grouped_slides: &mut HashMap<Uuid, VecDeque<CmsPageExerciseSlide>>,
    exercise_id: Uuid,
) -> Vec<CmsPageExerciseSlide> {
    let Some(slides) = grouped_slides.get_mut(&exercise_id) else {
        return vec![];
    };
    let mut consumed = vec![];
    while let Some(slide) = slides.pop_front() {
        let order_number = slide.order_number;
        consumed.push(slide);
        if !consumed.is_empty()
            && slides
                .front()
                .is_some_and(|next_slide| next_slide.order_number <= order_number)
        {
            break;
        }
    }
    consumed
}

/// Consumes tasks for a single slide occurrence from the grouped task queue.
fn consume_tasks_for_one_slide(
    grouped_tasks: &mut HashMap<Uuid, VecDeque<CmsPageExerciseTask>>,
    slide_id: Uuid,
) -> Vec<CmsPageExerciseTask> {
    let Some(tasks) = grouped_tasks.get_mut(&slide_id) else {
        return vec![];
    };
    let mut consumed = vec![];
    while let Some(task) = tasks.pop_front() {
        let order_number = task.order_number;
        consumed.push(task);
        if !consumed.is_empty()
            && tasks
                .front()
                .is_some_and(|next_task| next_task.order_number <= order_number)
        {
            break;
        }
    }
    consumed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_exercise_block(exercise_id: Uuid) -> GutenbergBlock {
        let mut attributes = serde_json::Map::new();
        attributes.insert(
            "id".to_string(),
            serde_json::Value::String(exercise_id.to_string()),
        );
        GutenbergBlock {
            client_id: Uuid::new_v4(),
            name: "moocfi/exercise".to_string(),
            is_valid: true,
            attributes,
            inner_blocks: vec![],
        }
    }

    fn create_exercise(id: Uuid, order_number: i32) -> CmsPageExercise {
        CmsPageExercise {
            id,
            name: format!("exercise-{order_number}"),
            order_number,
            score_maximum: 1,
            max_tries_per_slide: None,
            limit_number_of_tries: false,
            deadline: None,
            needs_peer_review: false,
            needs_self_review: false,
            peer_or_self_review_config: None,
            peer_or_self_review_questions: None,
            use_course_default_peer_or_self_review_config: false,
            teacher_reviews_answer_after_locking: true,
        }
    }

    fn create_slide(id: Uuid, exercise_id: Uuid, order_number: i32) -> CmsPageExerciseSlide {
        CmsPageExerciseSlide {
            id,
            exercise_id,
            order_number,
        }
    }

    fn create_task(id: Uuid, slide_id: Uuid, order_number: i32) -> CmsPageExerciseTask {
        CmsPageExerciseTask {
            id,
            exercise_slide_id: slide_id,
            assignment: serde_json::json!([]),
            exercise_type: "example-exercise".to_string(),
            private_spec: None,
            order_number,
        }
    }

    #[test]
    fn dedupe_forks_second_duplicate_when_old_has_one() {
        let exercise_id = Uuid::new_v4();
        let first_slide = Uuid::new_v4();
        let second_slide = Uuid::new_v4();
        let first_task = Uuid::new_v4();
        let second_task = Uuid::new_v4();
        let mut update = CmsPageUpdate {
            content: vec![
                create_exercise_block(exercise_id),
                create_exercise_block(exercise_id),
            ],
            exercises: vec![
                create_exercise(exercise_id, 0),
                create_exercise(exercise_id, 1),
            ],
            exercise_slides: vec![
                create_slide(first_slide, exercise_id, 0),
                create_slide(second_slide, exercise_id, 0),
            ],
            exercise_tasks: vec![
                create_task(first_task, first_slide, 0),
                create_task(second_task, second_slide, 0),
            ],
            url_path: "/x".to_string(),
            title: "x".to_string(),
            chapter_id: None,
        };

        dedupe_fork_duplicate_exercises(&mut update, &[exercise_id]).unwrap();

        assert_eq!(update.exercises.len(), 2);
        assert_eq!(update.exercises[0].id, exercise_id);
        assert_ne!(update.exercises[1].id, exercise_id);
        let second_exercise_id = update.exercises[1].id;
        let second_content_exercise_id = update.content[1]
            .attributes
            .get("id")
            .and_then(serde_json::Value::as_str)
            .and_then(|id| Uuid::parse_str(id).ok())
            .unwrap();
        assert_eq!(second_content_exercise_id, second_exercise_id);
        assert_eq!(update.exercise_slides[0].id, first_slide);
        assert_eq!(update.exercise_slides[0].exercise_id, exercise_id);
        assert_ne!(update.exercise_slides[1].id, second_slide);
        assert_eq!(update.exercise_slides[1].exercise_id, second_exercise_id);
        assert_eq!(update.exercise_tasks[0].id, first_task);
        assert_eq!(update.exercise_tasks[0].exercise_slide_id, first_slide);
        assert_ne!(update.exercise_tasks[1].id, second_task);
        assert_eq!(
            update.exercise_tasks[1].exercise_slide_id,
            update.exercise_slides[1].id
        );
    }

    #[test]
    fn dedupe_forks_second_duplicate_on_first_save() {
        let exercise_id = Uuid::new_v4();
        let first_slide = Uuid::new_v4();
        let second_slide = Uuid::new_v4();
        let mut update = CmsPageUpdate {
            content: vec![
                create_exercise_block(exercise_id),
                create_exercise_block(exercise_id),
            ],
            exercises: vec![
                create_exercise(exercise_id, 0),
                create_exercise(exercise_id, 1),
            ],
            exercise_slides: vec![
                create_slide(first_slide, exercise_id, 0),
                create_slide(second_slide, exercise_id, 0),
            ],
            exercise_tasks: vec![],
            url_path: "/x".to_string(),
            title: "x".to_string(),
            chapter_id: None,
        };

        dedupe_fork_duplicate_exercises(&mut update, &[]).unwrap();
        assert_eq!(update.exercises[0].id, exercise_id);
        assert_ne!(update.exercises[1].id, exercise_id);
        assert_eq!(update.exercise_slides[0].id, first_slide);
        assert_ne!(update.exercise_slides[1].id, second_slide);
    }

    #[test]
    fn dedupe_does_not_change_when_no_new_duplicates() {
        let first_exercise_id = Uuid::new_v4();
        let second_exercise_id = Uuid::new_v4();
        let first_slide = Uuid::new_v4();
        let second_slide = Uuid::new_v4();
        let mut update = CmsPageUpdate {
            content: vec![
                create_exercise_block(first_exercise_id),
                create_exercise_block(second_exercise_id),
            ],
            exercises: vec![
                create_exercise(first_exercise_id, 0),
                create_exercise(second_exercise_id, 1),
            ],
            exercise_slides: vec![
                create_slide(first_slide, first_exercise_id, 0),
                create_slide(second_slide, second_exercise_id, 0),
            ],
            exercise_tasks: vec![],
            url_path: "/x".to_string(),
            title: "x".to_string(),
            chapter_id: None,
        };

        dedupe_fork_duplicate_exercises(&mut update, &[first_exercise_id, second_exercise_id])
            .unwrap();
        assert_eq!(update.exercises[0].id, first_exercise_id);
        assert_eq!(update.exercises[1].id, second_exercise_id);
        assert_eq!(update.exercise_slides[0].id, first_slide);
        assert_eq!(update.exercise_slides[1].id, second_slide);
    }
}
