//! `list_exercises`: every exercise of a course, chapter or page with the facts course-wide checks
//! compare, without reading each exercise.

use std::collections::HashMap;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use headless_lms_models::{
    exercises,
    library::{
        agent_changesets::{
            course_state::{CourseState, CourseView, ExerciseReviewConfig},
            risk::load_student_activity,
        },
        entity_snapshots::{self, PageSnapshot},
    },
    pages::CmsPageExercise,
};
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use crate::access::{connection, open_course, state_of};
use crate::engine::read::ReadState;
use crate::state::McpState;
use crate::tools::args::{IdArgument, ListExercisesArgs};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

/// Handler of the `list_exercises` tool.
pub struct ListExercises;

const DEFAULT_LIMIT: usize = 100;
const MAX_LIMIT: usize = 300;

#[derive(Serialize)]
struct ListedPage<'a> {
    id: Uuid,
    title: &'a str,
    hidden: bool,
}

/// Which review settings an exercise with reviews uses.
#[derive(Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
enum ReviewSource {
    Own,
    Default,
    None,
}

#[derive(Serialize)]
struct ListedExercise<'a> {
    id: Uuid,
    name: &'a str,
    page: ListedPage<'a>,
    /// The chapter whose deadline applies without an own one.
    chapter_id: Option<Uuid>,
    /// 1-based position among the page's exercises.
    order: usize,
    task_types: Vec<&'a str>,
    score_maximum: i32,
    /// Tries per slide; `None` for unlimited.
    tries: Option<i32>,
    deadline_own: Option<DateTime<Utc>>,
    deadline_effective: Option<DateTime<Utc>>,
    review_source: ReviewSource,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    has_submissions: bool,
    copied_from: Option<Uuid>,
    exercise_language_group_id: Option<Uuid>,
}

/// The pages `scope` covers in course order: chapters by module and number, each chapter's pages
/// in order, then the top-level pages.
fn pages_in_scope(
    state: &CourseState,
    chapter: Option<Uuid>,
    page: Option<Uuid>,
) -> Result<Vec<Uuid>, ToolError> {
    let course_id = state.course_id();
    if let Some(page_id) = page {
        return match state.page(page_id) {
            Some(page) => Ok(vec![page.id]),
            None => Err(ToolError::NotFound {
                message: format!("course {course_id} has no page {page_id} in this state"),
            }),
        };
    }
    let chapters: Vec<Uuid> = match chapter {
        Some(chapter_id) if state.chapters.iter().any(|c| c.id == chapter_id) => {
            vec![chapter_id]
        }
        Some(chapter_id) => {
            return Err(ToolError::NotFound {
                message: format!("course {course_id} has no chapter {chapter_id} in this state"),
            });
        }
        None => state
            .modules_in_order()
            .into_iter()
            .flat_map(|module| state.chapters_in_order(module.id))
            .map(|chapter| chapter.id)
            .collect(),
    };
    let mut pages: Vec<Uuid> = chapters
        .into_iter()
        .flat_map(|chapter| state.pages_in_order(Some(chapter)))
        .map(|page| page.id)
        .collect();
    if chapter.is_none() {
        pages.extend(state.pages_in_order(None).into_iter().map(|page| page.id));
    }
    Ok(pages)
}

/// The page snapshots of `page_ids` in the read state, by id.
async fn page_snapshots(
    state: &McpState,
    view: &CourseView,
    read_state: ReadState,
    page_ids: &[Uuid],
) -> Result<HashMap<Uuid, PageSnapshot>, ToolError> {
    let mut conn = connection(state).await?;
    Ok(match read_state {
        ReadState::Staged => view.current_page_snapshots(&mut conn, page_ids).await?,
        ReadState::Published => entity_snapshots::load_pages(&mut conn, page_ids).await?,
    })
}

fn review_source(exercise: &CmsPageExercise) -> ReviewSource {
    if !exercise.needs_peer_review && !exercise.needs_self_review {
        return ReviewSource::None;
    }
    match ExerciseReviewConfig::of_exercise(exercise) {
        ExerciseReviewConfig::CourseDefault => ReviewSource::Default,
        ExerciseReviewConfig::Own { .. } => ReviewSource::Own,
        ExerciseReviewConfig::Unset => ReviewSource::None,
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for ListExercises {
    type Args = ListExercisesArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: ListExercisesArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let limit = args.limit.map_or(DEFAULT_LIMIT, |l| l as usize);
        if !(1..=MAX_LIMIT).contains(&limit) {
            return Err(ToolError::InvalidArguments {
                message: format!("limit is 1 to {MAX_LIMIT}"),
            });
        }
        let offset = args.offset.unwrap_or(0) as usize;
        let read_state = args.state.unwrap_or_default();
        let view = open_course(state, ctx, args.course.id()).await?;
        let course_state = state_of(&view, read_state);
        let page_ids = pages_in_scope(
            course_state,
            args.scope.and_then(|s| s.chapter).map(IdArgument::id),
            args.scope.and_then(|s| s.page).map(IdArgument::id),
        )?;
        let listed: Vec<(Uuid, Uuid, usize)> = page_ids
            .iter()
            .filter_map(|page_id| course_state.page(*page_id))
            .flat_map(|page| {
                page.content
                    .iter()
                    .filter_map(|block| block.exercise_id())
                    .enumerate()
                    .map(|(index, exercise_id)| (exercise_id, page.id, index + 1))
            })
            .collect();
        let total = listed.len();
        let window: Vec<(Uuid, Uuid, usize)> =
            listed.into_iter().skip(offset).take(limit).collect();
        let window_pages: Vec<Uuid> = window.iter().map(|(_, page, _)| *page).collect();
        let snapshots = page_snapshots(state, &view, read_state, &window_pages).await?;
        let window_exercises: Vec<Uuid> = window.iter().map(|(exercise, _, _)| *exercise).collect();
        let mut conn = connection(state).await?;
        let rows: HashMap<Uuid, exercises::Exercise> =
            exercises::get_course_exercises_by_ids(&mut conn, view.course.id, &window_exercises)
                .await?
                .into_iter()
                .map(|exercise| (exercise.id, exercise))
                .collect();
        let activity = load_student_activity(&mut conn, view.course.id).await?;
        drop(conn);

        let mut items = Vec::with_capacity(window.len());
        for (exercise_id, page_id, order) in &window {
            let (Some(page), Some(snapshot)) =
                (course_state.page(*page_id), snapshots.get(page_id))
            else {
                continue;
            };
            let Some(exercise) = snapshot.exercises.iter().find(|e| e.id == *exercise_id) else {
                continue;
            };
            let slide_ids: Vec<Uuid> = snapshot
                .exercise_slides
                .iter()
                .filter(|slide| slide.exercise_id == exercise.id)
                .map(|slide| slide.id)
                .collect();
            let row = rows.get(exercise_id);
            items.push(ListedExercise {
                id: exercise.id,
                name: &exercise.name,
                page: ListedPage {
                    id: page.id,
                    title: &page.title,
                    hidden: page.hidden,
                },
                chapter_id: course_state
                    .exercise_deadlines
                    .get(exercise_id)
                    .map_or(page.chapter_id, |deadline| deadline.chapter_id),
                order: *order,
                task_types: snapshot
                    .exercise_tasks
                    .iter()
                    .filter(|task| slide_ids.contains(&task.exercise_slide_id))
                    .map(|task| task.exercise_type.as_str())
                    .collect(),
                score_maximum: exercise.score_maximum,
                tries: exercise
                    .limit_number_of_tries
                    .then_some(exercise.max_tries_per_slide)
                    .flatten(),
                deadline_own: exercise.deadline,
                deadline_effective: course_state.effective_exercise_deadline(*exercise_id),
                review_source: review_source(exercise),
                has_submissions: activity.exercises_with_submissions.contains(exercise_id),
                copied_from: row.and_then(|row| row.copied_from),
                exercise_language_group_id: row.and_then(|row| row.exercise_language_group_id),
            });
        }
        let next_offset = offset + window.len();
        let has_more = next_offset < total;
        let mut result = json!({
            "total": total,
            "exercises": items,
            "has_more": has_more,
        });
        if has_more {
            result["next"] = json!({"offset": next_offset, "limit": limit});
        }
        Ok(ToolResult::success(result).into())
    }
}
