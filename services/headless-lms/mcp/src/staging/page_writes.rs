//! Full page snapshots for the pages a call changed, with the exercises that follow their blocks.

use std::collections::{HashMap, HashSet};

use headless_lms_models::{
    library::{
        agent_changesets::{
            StagedEntity,
            course_state::{CourseState, CourseView, ExerciseEditError, ExerciseReviewConfig},
        },
        entity_snapshots::{
            ContentEntityType, EntityKey, EntitySnapshot, ExerciseBundle, PageSnapshot,
        },
    },
    peer_or_self_review_configs::{self, CmsPeerOrSelfReviewConfiguration},
};
use sqlx::PgConnection;
use uuid::Uuid;

use super::stale_read;
use crate::engine::blocks::ExerciseCopy;
use crate::ids::IdGenerator;
use crate::tools::ToolError;

/// Full page snapshots for the changed pages of a state, and the live snapshots of the pages
/// among them that the user has no staged changes to.
pub struct PageWrites {
    pub writes: Vec<StagedEntity>,
    pub live_pages: HashMap<Uuid, PageSnapshot>,
}

/// Writes the changes of `after`'s exercise records since `before` into `bundle`, if its exercise
/// has any, and tells whether it had. `page_id` is the page the bundle was read from.
fn edit_exercise(
    before: &CourseState,
    after: &CourseState,
    course_default: Option<&CmsPeerOrSelfReviewConfiguration>,
    ids: &dyn IdGenerator,
    page_id: Uuid,
    bundle: &mut ExerciseBundle,
) -> Result<bool, ToolError> {
    let exercise_id = bundle.exercise.id;
    let (Some(before), Some(after)) = (before.exercise(exercise_id), after.exercise(exercise_id))
    else {
        return Ok(false);
    };
    if after.has_same_content(before) {
        return Ok(false);
    }
    after
        .apply_to(before, bundle, course_default, || ids.new_id())
        .map_err(|error| match error {
            ExerciseEditError::ChangedSinceRead => {
                stale_read(&[EntityKey::new(ContentEntityType::Page, page_id)])
            }
            ExerciseEditError::NoCourseDefault => ToolError::InvalidArguments {
                message: "the course has no default review config to copy".into(),
            },
            ExerciseEditError::UnsupportedReviewConfigChange => ToolError::Internal(format!(
                "exercise {exercise_id} got a review config change staging can't write"
            )),
        })?;
    Ok(true)
}

/// The course default review config with its questions, if `after` copies it to an exercise.
async fn course_default_to_copy(
    conn: &mut PgConnection,
    before: &CourseState,
    after: &CourseState,
) -> Result<Option<CmsPeerOrSelfReviewConfiguration>, ToolError> {
    let copies = after.exercises_changed_since(before).iter().any(|id| {
        matches!(
            (before.exercise(*id), after.exercise(*id)),
            (Some(before), Some(after))
                if before.review_config == ExerciseReviewConfig::CourseDefault
                    && matches!(after.review_config, ExerciseReviewConfig::Own { .. })
        )
    });
    if !copies {
        return Ok(None);
    }
    Ok(
        peer_or_self_review_configs::get_course_default_cms_peer_review_configuration(
            conn,
            after.course_id(),
        )
        .await?,
    )
}

/// Builds full page snapshots for the changed pages of `after`. Exercises follow their blocks,
/// across pages too; `copies` are created from their source exercises.
pub async fn page_writes(
    conn: &mut PgConnection,
    view: &CourseView,
    after: &CourseState,
    page_ids: &[Uuid],
    copies: &[ExerciseCopy],
    ids: &dyn IdGenerator,
) -> Result<PageWrites, ToolError> {
    let copy_sources: HashSet<Uuid> = copies.iter().map(|c| c.source_exercise_id).collect();
    let written_pages: HashSet<Uuid> = page_ids.iter().copied().collect();
    let mut source_pages: Vec<Uuid> = page_ids.to_vec();
    if !copy_sources.is_empty() {
        let mut is_source_page = written_pages.clone();
        for page in &view.staged.pages {
            let has_source = page
                .content
                .iter()
                .any(|b| b.exercise_id().is_some_and(|id| copy_sources.contains(&id)));
            if has_source && is_source_page.insert(page.id) {
                source_pages.push(page.id);
            }
        }
    }
    let mut current = view.current_page_snapshots(conn, &source_pages).await?;
    let course_default = course_default_to_copy(conn, &view.staged, after).await?;
    let mut live_pages: HashMap<Uuid, PageSnapshot> = HashMap::new();
    let mut bundles: HashMap<Uuid, ExerciseBundle> = HashMap::new();
    let mut edited: HashSet<Uuid> = HashSet::new();
    for page_id in &source_pages {
        let Some(snapshot) = current.get(page_id) else {
            continue;
        };
        for mut bundle in snapshot.exercise_bundles() {
            if edit_exercise(
                &view.staged,
                after,
                course_default.as_ref(),
                ids,
                *page_id,
                &mut bundle,
            )? {
                edited.insert(bundle.exercise.id);
            }
            bundles.insert(bundle.exercise.id, bundle);
        }
        if view
            .staged_row(EntityKey::new(ContentEntityType::Page, *page_id))
            .is_none()
            && written_pages.contains(page_id)
        {
            live_pages.insert(*page_id, snapshot.clone());
        }
    }
    for copy in copies {
        let source = bundles.get(&copy.source_exercise_id).ok_or_else(|| {
            ToolError::Internal(format!(
                "copied exercise {} wasn't found on any page",
                copy.source_exercise_id
            ))
        })?;
        let copied = source.copy_with_new_ids(copy.new_exercise_id, || ids.new_id());
        bundles.insert(copy.new_exercise_id, copied);
    }

    let mut writes = Vec::new();
    for page_id in page_ids {
        let Some(record) = after.page(*page_id) else {
            writes.push(StagedEntity::Delete(EntityKey::new(
                ContentEntityType::Page,
                *page_id,
            )));
            continue;
        };
        let snapshot = match current.remove(page_id) {
            Some(base) if base.content == record.content => {
                let mut snapshot = PageSnapshot {
                    chapter_id: record.chapter_id,
                    url_path: record.url_path.clone(),
                    title: record.title.clone(),
                    hidden: record.hidden,
                    order_number: record.order_number,
                    joins_page_language_group_id: record.joins_page_language_group_id,
                    ..base
                };
                if snapshot.exercises.iter().any(|e| edited.contains(&e.id)) {
                    let exercise_ids: Vec<Uuid> = snapshot.exercises.iter().map(|e| e.id).collect();
                    snapshot
                        .set_exercise_bundles(exercise_ids.iter().filter_map(|id| bundles.get(id)));
                }
                snapshot
            }
            _ => PageSnapshot::from_record_and_bundles(after.course_id(), record, &bundles)
                .map_err(|missing| {
                    ToolError::Internal(format!(
                        "page {page_id} names exercises that weren't found: {missing:?}"
                    ))
                })?,
        };
        writes.push(StagedEntity::Write(EntitySnapshot::Page(snapshot)));
    }
    Ok(PageWrites { writes, live_pages })
}
