//! History of chapters, course modules and course settings, and restoring them from it.
//!
//! Every save path of these entities records a snapshot after the save, from the web UI and from
//! agents alike. Page history lives in `page_history`.

use utoipa::ToSchema;

use crate::{
    chapter_history, course_module_history, course_settings_history,
    library::entity_snapshots::{
        self, ChapterSnapshot, CourseAudienceSnapshot, CourseSettingsSnapshot, ModuleSnapshot,
    },
    prelude::*,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, ToSchema)]
#[sqlx(type_name = "entity_history_change_reason", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EntityHistoryChangeReason {
    Saved,
    Deleted,
    Restored,
}

/// A row of `chapter_history`, `course_module_history` or `course_settings_history`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct EntityHistoryEntry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    /// The chapter or module id; the course id for course settings.
    pub entity_id: Uuid,
    pub course_id: Uuid,
    /// The entity's fields after the change, in its snapshot shape.
    pub snapshot: serde_json::Value,
    pub change_reason: EntityHistoryChangeReason,
    pub restored_from_id: Option<Uuid>,
    pub author_user_id: Uuid,
    /// The agent client the change was made through; `None` for the web UI.
    pub agent_client_name: Option<String>,
    pub agent_changeset_id: Option<Uuid>,
}

/// Writes the course settings of the snapshot through the course save paths. `live` is the
/// current state, used to skip the audience save (which recomputes embeddings) when audiences are
/// unchanged.
pub async fn write_course_settings(
    conn: &mut PgConnection,
    app_conf: &ApplicationConfiguration,
    snapshot: &CourseSettingsSnapshot,
    live: &CourseSettingsSnapshot,
) -> ModelResult<()> {
    if snapshot.course_id != live.course_id {
        return Err(model_err!(
            PreconditionFailed,
            "Course settings snapshot is for another course".to_string()
        ));
    }
    crate::courses::update_course(
        conn,
        app_conf,
        snapshot.course_id,
        crate::courses::CourseUpdate {
            name: snapshot.name.clone(),
            description: snapshot.description.clone(),
            is_draft: snapshot.is_draft,
            is_test_mode: snapshot.is_test_mode,
            can_add_chatbot: snapshot.can_add_chatbot,
            is_unlisted: snapshot.is_unlisted,
            is_joinable_by_code_only: snapshot.is_joinable_by_code_only,
            ask_marketing_consent: snapshot.ask_marketing_consent,
            flagged_answers_threshold: snapshot.flagged_answers_threshold.unwrap_or(0),
            flagged_answers_skip_manual_review_and_allow_retry: snapshot
                .flagged_answers_skip_manual_review_and_allow_retry,
            closed_at: snapshot.closed_at,
            closed_additional_message: snapshot.closed_additional_message.clone(),
            closed_course_successor_id: snapshot.closed_course_successor_id,
            chapter_locking_enabled: snapshot.chapter_locking_enabled,
            ai_policy: snapshot.ai_policy,
            course_material_ai_instructions: snapshot.course_material_ai_instructions,
        },
    )
    .await?;
    if snapshot.base_module_completion_requires_n_submodule_completions
        != live.base_module_completion_requires_n_submodule_completions
    {
        crate::courses::update_course_base_module_completion_count_requirement(
            conn,
            snapshot.course_id,
            snapshot.base_module_completion_requires_n_submodule_completions,
        )
        .await?;
    }
    if snapshot.audiences != live.audiences {
        let prerequisites = crate::course_prerequisites::get_by_course_id(conn, snapshot.course_id)
            .await?
            .into_iter()
            .map(|p| crate::course_prerequisites::EditCoursePrerequisite {
                id: p.id,
                course_id: p.course_id,
                prerequisite: p.prerequisite,
            })
            .collect();
        let audiences = snapshot
            .audiences
            .iter()
            .map(|CourseAudienceSnapshot { id, audience }| {
                crate::course_audiences::EditCourseAudience {
                    id: *id,
                    course_id: snapshot.course_id,
                    audience: audience.clone(),
                }
            })
            .collect();
        crate::courses::set_metadata(
            conn,
            app_conf,
            snapshot.course_id,
            crate::courses::CourseMetadataUpdate::new(
                snapshot.description.clone(),
                audiences,
                prerequisites,
            ),
        )
        .await?;
    }
    Ok(())
}

/// Puts the chapter back to the state of a `chapter_history` row, bringing it back if it was
/// deleted. Returns the id of the history row recording the restore.
pub async fn restore_chapter(
    conn: &mut PgConnection,
    history_id: Uuid,
    author_user_id: Uuid,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let entry = chapter_history::get_by_id(&mut tx, history_id).await?;
    let snapshot: ChapterSnapshot = serde_json::from_value(entry.snapshot)?;
    crate::chapters::upsert_from_snapshot(&mut tx, &snapshot).await?;
    let id = chapter_history::insert(
        &mut tx,
        &snapshot,
        EntityHistoryChangeReason::Restored,
        author_user_id,
        Some(history_id),
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(id)
}

/// Puts the module back to the state of a `course_module_history` row, bringing it back if it was
/// deleted. Returns the id of the history row recording the restore.
pub async fn restore_module(
    conn: &mut PgConnection,
    history_id: Uuid,
    author_user_id: Uuid,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let entry = course_module_history::get_by_id(&mut tx, history_id).await?;
    let snapshot: ModuleSnapshot = serde_json::from_value(entry.snapshot)?;
    crate::course_modules::upsert_from_snapshot(&mut tx, &snapshot).await?;
    let id = course_module_history::insert(
        &mut tx,
        &snapshot,
        EntityHistoryChangeReason::Restored,
        author_user_id,
        Some(history_id),
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(id)
}

/// Puts the course settings back to the state of a `course_settings_history` row. Returns the id
/// of the history row recording the restore.
pub async fn restore_course_settings(
    conn: &mut PgConnection,
    app_conf: &ApplicationConfiguration,
    history_id: Uuid,
    author_user_id: Uuid,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let entry = course_settings_history::get_by_id(&mut tx, history_id).await?;
    let snapshot: CourseSettingsSnapshot = serde_json::from_value(entry.snapshot)?;
    let live = entity_snapshots::load_course_settings(&mut tx, snapshot.course_id)
        .await?
        .ok_or_else(|| model_err!(NotFound, "Course not found".to_string()))?;
    write_course_settings(&mut tx, app_conf, &snapshot, &live).await?;
    let id = course_settings_history::insert(
        &mut tx,
        &snapshot,
        EntityHistoryChangeReason::Restored,
        author_user_id,
        Some(history_id),
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(id)
}

/// Records the current state of every chapter and module of the course that changed since its
/// latest history row, for web UI saves that rearrange the course structure.
pub async fn record_course_structure(
    conn: &mut PgConnection,
    course_id: Uuid,
    author_user_id: Uuid,
) -> ModelResult<()> {
    for chapter in crate::chapters::get_course_chapters(conn, course_id).await? {
        chapter_history::insert_current(conn, chapter.id, author_user_id, None).await?;
    }
    for module in crate::course_modules::get_by_course_id(conn, course_id).await? {
        course_module_history::insert_current(conn, module.id, author_user_id, None).await?;
    }
    Ok(())
}
