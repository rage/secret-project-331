use std::collections::HashMap;
use std::sync::Arc;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use sqlx::types::Json;

use super::{
    ChapterSnapshot, ContentEntity, ContentEntityType, CourseAudienceSnapshot,
    CourseDefaultReviewConfigSnapshot, CourseSettingsSnapshot, EntityKey, EntitySnapshot,
    GlossaryTermSnapshot, ModuleSnapshot, PageSnapshot, ReferenceSnapshot, with_snapshot_type,
};
use crate::{course_modules, prelude::*};

/// The course's default review config, if it has one.
pub async fn load_course_default_review_config(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Option<CourseDefaultReviewConfigSnapshot>> {
    Ok(sqlx::query_as!(
        CourseDefaultReviewConfigSnapshot,
        r#"
SELECT id,
  course_id,
  review_instructions
FROM peer_or_self_review_configs
WHERE course_id = $1
  AND exercise_id IS NULL
  AND deleted_at IS NULL
        "#,
        course_id
    )
    .fetch_optional(conn)
    .await?)
}

/// The live state of each entity, `None` for one that does not exist or is deleted. Pages that
/// belong to an exam are treated as not existing: changesets only hold course content.
pub async fn load_live_many(
    conn: &mut PgConnection,
    keys: &[EntityKey],
) -> ModelResult<HashMap<EntityKey, Option<EntitySnapshot>>> {
    let mut snapshots: HashMap<EntityKey, Option<EntitySnapshot>> =
        keys.iter().map(|key| (*key, None)).collect();
    let mut ids_by_type: HashMap<ContentEntityType, Vec<Uuid>> = HashMap::new();
    for EntityKey {
        entity_type,
        entity_id,
    } in snapshots.keys()
    {
        ids_by_type
            .entry(*entity_type)
            .or_default()
            .push(*entity_id);
    }
    for (entity_type, ids) in ids_by_type {
        with_snapshot_type!(entity_type, T => {
            for (id, snapshot) in T::load_live(conn, &ids).await? {
                snapshots.insert(EntityKey::new(entity_type, id), Some(snapshot.into()));
            }
        });
    }
    Ok(snapshots)
}

/// [`load_live_many`] of one entity.
pub async fn load_live(
    conn: &mut PgConnection,
    key: EntityKey,
) -> ModelResult<Option<EntitySnapshot>> {
    Ok(load_live_many(conn, &[key]).await?.remove(&key).flatten())
}

/// The live page, as [`load_live_many`] has it.
pub async fn load_page(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Option<PageSnapshot>> {
    Ok(load_pages(conn, &[page_id]).await?.remove(&page_id))
}

/// The live pages, as [`load_live_many`] has them, by id; the pages that don't exist are left out.
pub async fn load_pages(
    conn: &mut PgConnection,
    page_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, PageSnapshot>> {
    if page_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let pages = sqlx::query!(
        r#"
SELECT id,
  course_id AS "course_id!",
  chapter_id,
  url_path,
  title,
  hidden,
  order_number,
  content AS "content: Json<Vec<GutenbergBlock>>"
FROM pages
WHERE id = ANY($1)
  AND course_id IS NOT NULL
  AND exam_id IS NULL
  AND deleted_at IS NULL
        "#,
        page_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut exercises = crate::pages::exercises_of_pages(
        conn,
        &pages.iter().map(|page| page.id).collect::<Vec<_>>(),
    )
    .await?;
    let mut snapshots = HashMap::with_capacity(pages.len());
    for page in pages {
        let page_exercises = exercises.remove(&page.id).unwrap_or_default();
        let mut snapshot = PageSnapshot {
            id: page.id,
            course_id: page.course_id,
            chapter_id: page.chapter_id,
            url_path: page.url_path,
            title: page.title,
            hidden: page.hidden,
            order_number: page.order_number,
            content: Arc::new(page.content.0),
            exercises: page_exercises.exercises,
            exercise_slides: page_exercises.exercise_slides,
            exercise_tasks: page_exercises.exercise_tasks,
            joins_page_language_group_id: None,
        };
        snapshot.sort();
        snapshots.insert(snapshot.id, snapshot);
    }
    Ok(snapshots)
}

impl From<course_modules::CourseModule> for ModuleSnapshot {
    fn from(module: course_modules::CourseModule) -> Self {
        Self {
            id: module.id,
            course_id: module.course_id,
            name: module.name,
            order_number: module.order_number,
            completion_policy: module.completion_policy,
            certification_enabled: module.certification_enabled,
            uh_course_code: module.uh_course_code,
            ects_credits: module.ects_credits,
            completion_registration_link_override: module.completion_registration_link_override,
            completions_can_be_registered_to_sisu: module.completions_can_be_registered_to_sisu,
        }
    }
}

impl From<crate::chapters::DatabaseChapter> for ChapterSnapshot {
    fn from(chapter: crate::chapters::DatabaseChapter) -> Self {
        Self {
            id: chapter.id,
            course_id: chapter.course_id,
            course_module_id: chapter.course_module_id,
            name: chapter.name,
            color: chapter.color,
            chapter_number: chapter.chapter_number,
            front_page_id: chapter.front_page_id,
            opens_at: chapter.opens_at,
            deadline: chapter.deadline,
            chapter_image_path: chapter.chapter_image_path,
        }
    }
}

/// The settings of a fetched course; only its audiences are read.
pub async fn course_settings_of(
    conn: &mut PgConnection,
    course: &crate::courses::Course,
) -> ModelResult<CourseSettingsSnapshot> {
    let mut audiences: Vec<CourseAudienceSnapshot> =
        crate::course_audiences::get_edit_course_audiences_by_course_id(conn, course.id)
            .await?
            .into_iter()
            .map(|audience| CourseAudienceSnapshot {
                id: audience.id,
                audience: audience.audience,
            })
            .collect();
    audiences.sort_by_key(|audience| audience.id);
    Ok(CourseSettingsSnapshot {
        course_id: course.id,
        name: course.name.clone(),
        description: course.description.clone(),
        is_draft: course.is_draft,
        is_test_mode: course.is_test_mode,
        is_unlisted: course.is_unlisted,
        can_add_chatbot: course.can_add_chatbot,
        is_joinable_by_code_only: course.is_joinable_by_code_only,
        ask_marketing_consent: course.ask_marketing_consent,
        flagged_answers_threshold: course.flagged_answers_threshold,
        flagged_answers_skip_manual_review_and_allow_retry: course
            .flagged_answers_skip_manual_review_and_allow_retry,
        closed_at: course.closed_at,
        closed_additional_message: course.closed_additional_message.clone(),
        closed_course_successor_id: course.closed_course_successor_id,
        chapter_locking_enabled: course.chapter_locking_enabled,
        ai_policy: course.ai_policy,
        course_material_ai_instructions: course.course_material_ai_instructions,
        base_module_completion_requires_n_submodule_completions: course
            .base_module_completion_requires_n_submodule_completions,
        audiences,
    })
}

impl From<crate::glossary::Term> for GlossaryTermSnapshot {
    fn from(term: crate::glossary::Term) -> Self {
        Self {
            id: term.id,
            course_id: term.course_id,
            term: term.term,
            definition: term.definition,
        }
    }
}

impl From<crate::material_references::MaterialReference> for ReferenceSnapshot {
    fn from(reference: crate::material_references::MaterialReference) -> Self {
        Self {
            id: reference.id,
            course_id: reference.course_id,
            citation_key: reference.citation_key,
            reference: reference.reference,
        }
    }
}
