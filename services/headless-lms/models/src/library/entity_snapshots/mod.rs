//! Full snapshots of course content entities.
//!
//! Agent changesets stage these, `entity_history` stores them, and publishing and restoring write
//! them back through the existing save paths. A snapshot holds every field its save path writes,
//! so writing back an unchanged snapshot is a no-op.

mod content_entity;
mod loading;
mod types;

pub(crate) use content_entity::ContentEntity;
pub use loading::{
    course_settings_of, load_course_default_review_config, load_live, load_live_many, load_page,
    load_pages,
};
pub use types::{
    ChapterSnapshot, CourseAudienceSnapshot, CourseDefaultReviewConfigSnapshot,
    CourseSettingsSnapshot, EntitySnapshot, ExerciseBundle, GlossaryTermSnapshot, ModuleSnapshot,
    PageSnapshot, ReferenceSnapshot, exercise_bundles,
};
pub(crate) use types::{json_digest, match_snapshot, with_snapshot_type};

use utoipa::ToSchema;

use crate::prelude::*;

/// A kind of course content entity that agent changesets stage and history records.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, Type, ToSchema,
)]
#[sqlx(type_name = "content_entity_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ContentEntityType {
    Page,
    Chapter,
    Module,
    CourseSettings,
    GlossaryTerm,
    Reference,
    CourseDefaultReviewConfig,
}

/// An entity kind and id, which together identify one content entity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct EntityKey {
    pub entity_type: ContentEntityType,
    /// The entity's id; the course id for course settings.
    pub entity_id: Uuid,
}

impl EntityKey {
    /// The key of the entity.
    pub fn new(entity_type: ContentEntityType, entity_id: Uuid) -> Self {
        Self {
            entity_type,
            entity_id,
        }
    }

    /// The types and ids of `keys` as two lists in the same order, for `UNNEST` parameters.
    pub fn unzip(keys: &[EntityKey]) -> (Vec<ContentEntityType>, Vec<Uuid>) {
        keys.iter()
            .map(|key| (key.entity_type, key.entity_id))
            .unzip()
    }
}

/// A content entity and what people call it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct EntityRef {
    pub entity_type: ContentEntityType,
    /// The entity's id; the course id for course settings.
    pub entity_id: Uuid,
    /// A page title, chapter, module or course name, glossary term or citation key; empty for the
    /// default module and the course default review config.
    pub label: String,
}

impl EntityRef {
    /// The entity, labelled from `preferred` if it exists and from `fallback` otherwise; with an
    /// empty label if neither does.
    pub fn of(
        EntityKey {
            entity_type,
            entity_id,
        }: EntityKey,
        preferred: Option<&EntitySnapshot>,
        fallback: Option<&EntitySnapshot>,
    ) -> Self {
        Self {
            entity_type,
            entity_id,
            label: preferred
                .or(fallback)
                .map(|snapshot| snapshot.label().to_string())
                .unwrap_or_default(),
        }
    }

    /// The entity's key.
    pub fn key(&self) -> EntityKey {
        EntityKey::new(self.entity_type, self.entity_id)
    }
}
